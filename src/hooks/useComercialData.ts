import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DadosComerciais,
  Registro,
  Vendedor,
  RegiaoSummary,
  EvolucaoMensal,
  KPIs,
} from "@/types/comercial";
import { isAdminUser } from "@/lib/adminUsers";
import { fetchRegistrosComerciais } from "@/services/registrosService";

function yearMonth(dt: string): string {
  if (!dt) return "";
  const parts = dt.split("-");
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return "";
}

function aggregate(registros: Registro[]): DadosComerciais {
  // KPIs
  const clienteSet = new Set<string>();
  const vendedorSet = new Set<string>();
  const cidadeSet = new Set<string>();
  let totalPipeline = 0;
  let totalVisitas = 0;
  const tiposContato: Record<string, number> = {};
  const tiposAcao: Record<string, number> = {};

  // Vendedor aggregation
  const vMap = new Map<
    string,
    {
      acoes: number;
      visitas: number;
      clientes: Set<string>;
      pipeline: number;
      negocios: Set<string>;
      obsCount: number;
      evolMap: Map<string, { acoes: number; visitas: number; negocioValor: number; clientes: Set<string> }>;
      clienteMap: Map<string, { acoes: number; visitas: number; negocioValor: number; diasSemContato: number; cidade: string }>;
      regiaoMap: Map<string, { acoes: number; valor: number; clientes: Set<string> }>;
      tipoAcaoMap: Record<string, number>;
    }
  >();

  // Region aggregation
  const rMap = new Map<string, { totalAcoes: number; clientes: Set<string>; pipeline: number; visitas: number; latSum: number; lngSum: number; coordCount: number }>();

  // Global evolution
  const gEvol = new Map<string, { acoes: number; visitas: number; negocioValor: number; clientes: Set<string> }>();

  const now = Date.now();

  for (const r of registros) {
    clienteSet.add(r.cliente);
    if (r.vendedor) vendedorSet.add(r.vendedor);
    if (r.cidade) cidadeSet.add(r.cidade);
    totalPipeline += r.negocioValor;
    const isVisita = r.tipoContato?.toLowerCase().includes("visita");
    if (isVisita) totalVisitas++;
    if (r.tipoContato) tiposContato[r.tipoContato] = (tiposContato[r.tipoContato] || 0) + 1;
    if (r.tipoAcao) tiposAcao[r.tipoAcao] = (tiposAcao[r.tipoAcao] || 0) + 1;

    // Vendedor
    if (r.vendedor) {
      if (!vMap.has(r.vendedor)) {
        vMap.set(r.vendedor, {
          acoes: 0, visitas: 0, clientes: new Set(), pipeline: 0, negocios: new Set(),
          obsCount: 0, evolMap: new Map(), clienteMap: new Map(), regiaoMap: new Map(), tipoAcaoMap: {},
        });
      }
      const v = vMap.get(r.vendedor)!;
      v.acoes++;
      if (isVisita) v.visitas++;
      v.clientes.add(r.cliente);
      v.pipeline += r.negocioValor;
      if (r.obs) v.obsCount++;
      if (r.tipoAcao) v.tipoAcaoMap[r.tipoAcao] = (v.tipoAcaoMap[r.tipoAcao] || 0) + 1;

      // evolucao
      const ym = yearMonth(r.dtConclusao);
      if (ym) {
        if (!v.evolMap.has(ym)) v.evolMap.set(ym, { acoes: 0, visitas: 0, negocioValor: 0, clientes: new Set() });
        const e = v.evolMap.get(ym)!;
        e.acoes++;
        if (isVisita) e.visitas++;
        e.negocioValor += r.negocioValor;
        e.clientes.add(r.cliente);
      }

      // topClientes
      if (r.cliente) {
        if (!v.clienteMap.has(r.cliente)) v.clienteMap.set(r.cliente, { acoes: 0, visitas: 0, negocioValor: 0, diasSemContato: 999, cidade: r.cidade });
        const c = v.clienteMap.get(r.cliente)!;
        c.acoes++;
        if (isVisita) c.visitas++;
        c.negocioValor += r.negocioValor;
        if (r.dtConclusao) {
          const days = Math.floor((now - new Date(r.dtConclusao).getTime()) / 86400000);
          if (days < c.diasSemContato) c.diasSemContato = days;
        }
      }

      // regioes
      if (r.cidade) {
        if (!v.regiaoMap.has(r.cidade)) v.regiaoMap.set(r.cidade, { acoes: 0, valor: 0, clientes: new Set() });
        const rg = v.regiaoMap.get(r.cidade)!;
        rg.acoes++;
        rg.valor += r.negocioValor;
        rg.clientes.add(r.cliente);
      }
    }

    // Global evolution
    const ym = yearMonth(r.dtConclusao);
    if (ym) {
      if (!gEvol.has(ym)) gEvol.set(ym, { acoes: 0, visitas: 0, negocioValor: 0, clientes: new Set() });
      const e = gEvol.get(ym)!;
      e.acoes++;
      if (isVisita) e.visitas++;
      e.negocioValor += r.negocioValor;
      e.clientes.add(r.cliente);
    }

    // Regioes
    if (r.cidade) {
      if (!rMap.has(r.cidade)) rMap.set(r.cidade, { totalAcoes: 0, clientes: new Set(), pipeline: 0, visitas: 0, latSum: 0, lngSum: 0, coordCount: 0 });
      const rg = rMap.get(r.cidade)!;
      rg.totalAcoes++;
      rg.clientes.add(r.cliente);
      rg.pipeline += r.negocioValor;
      if (isVisita) rg.visitas++;
      if (r.lat != null && r.lng != null) {
        rg.latSum += r.lat;
        rg.lngSum += r.lng;
        rg.coordCount++;
      }
    }
  }

  const kpis: KPIs = {
    totalRegistros: registros.length,
    totalClientes: clienteSet.size,
    totalConsultores: vendedorSet.size,
    totalPipeline,
    totalVisitas,
    totalCidades: cidadeSet.size,
  };

  const vendedores: Vendedor[] = Array.from(vMap.entries()).map(([nome, v]) => {
    const negocios = new Set<string>();
    // Count distinct negocio from registros for this vendedor
    for (const r of registros) {
      if (r.vendedor === nome && r.negocioValor > 0) negocios.add(r.cliente + "|" + r.negocioEtapa);
    }

    const evolucao: EvolucaoMensal[] = Array.from(v.evolMap.entries())
      .map(([ym, e]) => ({ YearMonth: ym, acoes: e.acoes, visitas: e.visitas, negocioValor: e.negocioValor, clientes: e.clientes.size }))
      .sort((a, b) => a.YearMonth.localeCompare(b.YearMonth));

    const topClientes = Array.from(v.clienteMap.entries())
      .map(([nome, c]) => ({ nome, cidade: c.cidade, acoes: c.acoes, visitas: c.visitas, negocioValor: c.negocioValor, diasSemContato: c.diasSemContato }))
      .sort((a, b) => b.negocioValor - a.negocioValor)
      .slice(0, 10);

    const regioes = Array.from(v.regiaoMap.entries())
      .map(([cidade, rg]) => ({ cidade, acoes: rg.acoes, valor: rg.valor, clientes: rg.clientes.size }))
      .sort((a, b) => b.valor - a.valor);

    const convPct = v.acoes > 0 ? Math.round((negocios.size / v.acoes) * 100) : 0;
    const crmQ = v.acoes > 0 ? Math.round((v.obsCount / v.acoes) * 100) : 0;

    return {
      nome,
      totalAcoes: v.acoes,
      visitas: v.visitas,
      clientes: v.clientes.size,
      pipeline: v.pipeline,
      negocios: negocios.size,
      conversao: convPct,
      crmQuality: crmQ,
      evolucao,
      topClientes,
      regioes,
      tiposAcao: v.tipoAcaoMap,
    };
  }).sort((a, b) => b.pipeline - a.pipeline);

  const regioes: RegiaoSummary[] = Array.from(rMap.entries())
    .map(([cidade, rg]) => ({
      cidade,
      totalAcoes: rg.totalAcoes,
      clientes: rg.clientes.size,
      pipeline: rg.pipeline,
      visitas: rg.visitas,
      lat: rg.coordCount > 0 ? rg.latSum / rg.coordCount : undefined,
      lng: rg.coordCount > 0 ? rg.lngSum / rg.coordCount : undefined,
    }))
    .sort((a, b) => b.pipeline - a.pipeline);

  const evolucaoGlobal: EvolucaoMensal[] = Array.from(gEvol.entries())
    .map(([ym, e]) => ({ YearMonth: ym, acoes: e.acoes, visitas: e.visitas, negocioValor: e.negocioValor, clientes: e.clientes.size }))
    .sort((a, b) => a.YearMonth.localeCompare(b.YearMonth));

  const listaVendedores = Array.from(vendedorSet).sort();
  const listaCidades = Array.from(cidadeSet).sort();

  return {
    kpis,
    vendedores,
    regioes,
    evolucaoGlobal,
    tiposContato,
    tiposAcao,
    registrosRecentes: registros,
    listaVendedores,
    listaCidades,
  };
}

export function useComercialData() {
  const {
    data: rawRegistros,
    isLoading,
    error: queryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["registros-comerciais"],
    queryFn: fetchRegistrosComerciais,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const error = queryError ? (queryError as Error).message : null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null;

  const data = useMemo(() => {
    if (!rawRegistros) return null;
    const commercialRegistros = rawRegistros.filter((r) => !isAdminUser(r.vendedor));
    return aggregate(commercialRegistros);
  }, [rawRegistros]);

  const allData = useMemo(() => {
    if (!rawRegistros) return null;
    return aggregate(rawRegistros);
  }, [rawRegistros]);

  return { data, allData, isLoading, error, lastUpdated };
}
