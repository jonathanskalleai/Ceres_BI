import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type {
  DadosComerciais,
  Registro,
  Vendedor,
  RegiaoSummary,
  EvolucaoMensal,
  KPIs,
} from "@/types/comercial";
import { isAdminUser } from "@/lib/adminUsers";
import { fetchRegistrosComerciais, type RegistrosFetchOptions } from "@/services/registrosService";
import { fetchPipelineByVendedor, type VendedorPipeline } from "@/services/pipelineByVendedorService";
import { supabase } from "@/integrations/supabase/client";
import { getFunisByCategoria, type CategoriaFilter, CATEGORIA_ALL, FUNIL_ALL } from "@/lib/categoriaFunil";

function yearMonth(dt: string): string {
  if (!dt) return "";
  const parts = dt.split("-");
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return "";
}

function aggregate(registros: Registro[], pipelineMap?: Map<string, VendedorPipeline>): DadosComerciais {
  const clienteSet = new Set<string>();
  const vendedorSet = new Set<string>();
  const cidadeSet = new Set<string>();
  let totalPipeline = 0;
  let totalVisitas = 0;
  const tiposContato: Record<string, number> = {};
  const tiposAcao: Record<string, number> = {};

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

  const rMap = new Map<string, { totalAcoes: number; clientes: Set<string>; pipeline: number; visitas: number; latSum: number; lngSum: number; coordCount: number }>();

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

      const ym = yearMonth(r.dtConclusao);
      if (ym) {
        if (!v.evolMap.has(ym)) v.evolMap.set(ym, { acoes: 0, visitas: 0, negocioValor: 0, clientes: new Set() });
        const e = v.evolMap.get(ym)!;
        e.acoes++;
        if (isVisita) e.visitas++;
        e.negocioValor += r.negocioValor;
        e.clientes.add(r.cliente);
      }

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

      if (r.cidade) {
        if (!v.regiaoMap.has(r.cidade)) v.regiaoMap.set(r.cidade, { acoes: 0, valor: 0, clientes: new Set() });
        const rg = v.regiaoMap.get(r.cidade)!;
        rg.acoes++;
        rg.valor += r.negocioValor;
        rg.clientes.add(r.cliente);
      }
    }

    const ym = yearMonth(r.dtConclusao);
    if (ym) {
      if (!gEvol.has(ym)) gEvol.set(ym, { acoes: 0, visitas: 0, negocioValor: 0, clientes: new Set() });
      const e = gEvol.get(ym)!;
      e.acoes++;
      if (isVisita) e.visitas++;
      e.negocioValor += r.negocioValor;
      e.clientes.add(r.cliente);
    }

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

  const realTotalPipeline = pipelineMap
    ? Array.from(pipelineMap.values()).reduce((sum, v) => sum + v.pipeline, 0)
    : totalPipeline;

  const kpis: KPIs = {
    totalRegistros: registros.length,
    totalClientes: clienteSet.size,
    totalConsultores: vendedorSet.size,
    totalPipeline: realTotalPipeline,
    totalVisitas,
    totalCidades: cidadeSet.size,
  };

  const vendedores: Vendedor[] = Array.from(vMap.entries()).map(([nome, v]) => {
    const pData = pipelineMap?.get(nome);

    const evolucao: EvolucaoMensal[] = Array.from(v.evolMap.entries())
      .map(([ym, e]) => ({ YearMonth: ym, acoes: e.acoes, visitas: e.visitas, negocioValor: e.negocioValor, clientes: e.clientes.size }))
      .sort((a, b) => a.YearMonth.localeCompare(b.YearMonth));

    const topClientes = Array.from(v.clienteMap.entries())
      .map(([nome, c]) => ({ nome, cidade: c.cidade, acoes: c.acoes, visitas: c.visitas, negocioValor: c.negocioValor, diasSemContato: c.diasSemContato }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);

    const regioes = Array.from(v.regiaoMap.entries())
      .map(([cidade, rg]) => ({ cidade, acoes: rg.acoes, valor: rg.valor, clientes: rg.clientes.size }))
      .sort((a, b) => b.acoes - a.acoes);

    const crmQ = v.acoes > 0 ? Math.round((v.obsCount / v.acoes) * 100) : 0;

    return {
      nome,
      totalAcoes: v.acoes,
      visitas: v.visitas,
      clientes: v.clientes.size,
      pipeline: pData?.pipeline ?? 0,
      negocios: pData?.negocios ?? 0,
      conversao: pData?.conversao ?? 0,
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
    .sort((a, b) => b.totalAcoes - a.totalAcoes);

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

export interface UseComercialDataOptions {
  /** ISO date string YYYY-MM-DD — filtro server-side por aco_dth_conclusao */
  from?: string;
  to?: string;
}

export function useComercialData(
  categoria?: string,
  funil?: string,
  options?: UseComercialDataOptions,
) {
  const categoriaFilter = (categoria || CATEGORIA_ALL) as CategoriaFilter;
  const funilFilter = funil || FUNIL_ALL;

  const funis = funilFilter !== FUNIL_ALL
    ? [funilFilter]
    : categoriaFilter !== CATEGORIA_ALL
      ? getFunisByCategoria(categoriaFilter)
      : [];
  const hasFunilFilter = funis.length > 0;

  const from = options?.from;
  const to = options?.to;
  const fetchOptions: RegistrosFetchOptions | undefined = (from || to) ? { from, to } : undefined;

  const {
    data: rawRegistros,
    isLoading: loadingRegistros,
    error: queryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["registros-comerciais", from ?? null, to ?? null],
    queryFn: () => fetchRegistrosComerciais(fetchOptions),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: pipelineMap,
    isLoading: loadingPipeline,
  } = useQuery({
    queryKey: ["pipeline-by-vendedor", categoriaFilter, funilFilter],
    queryFn: () => fetchPipelineByVendedor(hasFunilFilter ? funis : undefined),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  const {
    data: funilClientes,
    isLoading: loadingFunilClientes,
  } = useQuery({
    queryKey: ["funil-clientes", categoriaFilter, funilFilter],
    queryFn: async (): Promise<Set<string> | null> => {
      if (!hasFunilFilter) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data, error } = await client
        .schema("mirror")
        .from("crm_negocios")
        .select("cli_nome")
        .in("ngo_funil", funis);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ cli_nome: string | null }>;
      return new Set(rows.map((r) => r.cli_nome ?? "").filter(Boolean));
    },
    staleTime: 5 * 60_000,
    enabled: hasFunilFilter,
    placeholderData: keepPreviousData,
  });

  const isLoading = loadingRegistros || loadingPipeline || (hasFunilFilter && loadingFunilClientes);
  const error = queryError ? (queryError as Error).message : null;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null;

  const data = useMemo(() => {
    if (!rawRegistros) return null;
    if (hasFunilFilter && !funilClientes) return null;
    let registros = rawRegistros.filter((r) => !isAdminUser(r.vendedor));
    if (hasFunilFilter && funilClientes) {
      registros = registros.filter((r) => funilClientes.has(r.cliente));
    }
    return aggregate(registros, pipelineMap ?? undefined);
  }, [rawRegistros, pipelineMap, hasFunilFilter, funilClientes]);

  const allData = useMemo(() => {
    if (!rawRegistros) return null;
    if (hasFunilFilter && !funilClientes) return null;
    let registros = [...rawRegistros];
    if (hasFunilFilter && funilClientes) {
      registros = registros.filter((r) => funilClientes.has(r.cliente));
    }
    return aggregate(registros, pipelineMap ?? undefined);
  }, [rawRegistros, pipelineMap, hasFunilFilter, funilClientes]);

  return { data, allData, isLoading, error, lastUpdated };
}
