import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Filters } from "@/types/comercial";
import { fetchNegociosMensais } from "@/services/negociosService";
import { fetchRegistrosComerciais } from "@/services/registrosService";

export interface NegocioRow {
  tipo: string;
  recebido: number;
  unidade: string;
  cliente: string;
  consultor: string;
  valor_pedido: number;
  pdo_situacao_pedido: string;
  ngo_etapa: string;
  ngo_conclusao: string;
  ngo_motivo_ganho: string;
  pdo_dth_abertura: string;
  pdo_cidade_entrega: string;
  pdo_obs_pedido: string;
  cod_consultor: string;
  pdo_vlr_recurso_proprio: number;
  usado: number;
}

export interface ClienteDetalhe {
  cliente: string;
  valorTotal: number;
  recebido: number;
  valorUsado: number;
}

export interface NegociosSummary {
  totalNegocios: number;
  totalValor: number;
  ticketMedio: number;
  ganhos: number;
  emAndamento: number;
  perdidos: number;
  taxaConversao: number;
  clientesAtendidos: number;
  totalRecebido: number;
  totalUsado: number;
  percentUsado: number;
  evolucaoMensal: { mes: string; total: number; valor: number; ganhos: number }[];
  porConsultor: { nome: string; total: number; valor: number; ganhos: number; conversao: number; ticketMedio: number; clientesAtendidos: number; recebido: number; usado: number; percentUsado: number; clientes: ClienteDetalhe[] }[];
  porRegiao: { regiao: string; total: number; valor: number; ganhos: number }[];
  porTipo: { tipo: string; total: number; valor: number }[];
  registros: NegocioRow[];
}

interface RegistroCliente {
  cliente_nome: string;
  vendedor: string;
  dt_conclusao: string;
  cidade_cliente: string;
}

function aggregate(rows: NegocioRow[], filters: Filters, registrosClientes: RegistroCliente[]): NegociosSummary {
  let filtered = rows;
  if (filters.dateRange?.from) filtered = filtered.filter((r) => r.pdo_dth_abertura && r.pdo_dth_abertura >= filters.dateRange!.from);
  if (filters.dateRange?.to) filtered = filtered.filter((r) => r.pdo_dth_abertura && r.pdo_dth_abertura <= filters.dateRange!.to);
  if (filters.cidade) filtered = filtered.filter((r) => r.unidade?.includes(filters.cidade) || r.pdo_cidade_entrega?.includes(filters.cidade));

  // Filter registros_comerciais by same filters for accurate conversion rate
  let filteredRegistros = registrosClientes;
  if (filters.dateRange?.from) {
    filteredRegistros = filteredRegistros.filter((r) => r.dt_conclusao && r.dt_conclusao >= filters.dateRange!.from);
  }
  if (filters.dateRange?.to) {
    filteredRegistros = filteredRegistros.filter((r) => r.dt_conclusao && r.dt_conclusao <= filters.dateRange!.to);
  }
  if (filters.cidade) {
    filteredRegistros = filteredRegistros.filter((r) => r.cidade_cliente?.includes(filters.cidade));
  }

  const ganhos = filtered.filter((r) => r.ngo_conclusao === "Ganho");
  const perdidos = filtered.filter((r) => r.ngo_conclusao === "Perdido");
  const emAndamento = filtered.filter((r) => r.ngo_conclusao === "Em andamento");
  const totalValor = filtered.reduce((s, r) => s + r.valor_pedido, 0);
  const totalRecebido = filtered.reduce((s, r) => s + r.recebido, 0);
  const totalUsado = filtered.reduce((s, r) => s + Math.max(0, r.valor_pedido - r.recebido), 0);
  const percentUsado = totalValor > 0 ? (totalUsado / totalValor) * 100 : 0;

  // Taxa de conversão: total negócios / clientes distintos de registros_comerciais
  const clientesAtendidos = new Set(filteredRegistros.map((r) => r.cliente_nome).filter(Boolean)).size;
  const taxaConversao = clientesAtendidos > 0 ? Math.round((filtered.length / clientesAtendidos) * 100) : 0;

  // Evolução mensal
  const evolMap = new Map<string, { total: number; valor: number; ganhos: number }>();
  for (const r of filtered) {
    const ym = r.pdo_dth_abertura?.slice(0, 7);
    if (!ym) continue;
    if (!evolMap.has(ym)) evolMap.set(ym, { total: 0, valor: 0, ganhos: 0 });
    const e = evolMap.get(ym)!;
    e.total++;
    e.valor += r.valor_pedido;
    if (r.ngo_conclusao === "Ganho") e.ganhos++;
  }

  // Por consultor - build map of clientes atendidos per vendedor from registros_comerciais
  const vendedorClientesMap = new Map<string, Set<string>>();
  for (const r of registrosClientes) {
    if (!r.vendedor || !r.cliente_nome) continue;
    if (!vendedorClientesMap.has(r.vendedor)) vendedorClientesMap.set(r.vendedor, new Set());
    vendedorClientesMap.get(r.vendedor)!.add(r.cliente_nome);
  }

  const cMap = new Map<string, { total: number; valor: number; ganhos: number; clientesSet: Set<string>; clientesMap: Map<string, { valorTotal: number; recebido: number; valorUsado: number }> }>();
  for (const r of filtered) {
    if (!r.consultor) continue;
    if (!cMap.has(r.consultor)) cMap.set(r.consultor, { total: 0, valor: 0, ganhos: 0, clientesSet: new Set(), clientesMap: new Map() });
    const c = cMap.get(r.consultor)!;
    c.total++;
    c.valor += r.valor_pedido;
    if (r.cliente) c.clientesSet.add(r.cliente);
    if (r.ngo_conclusao === "Ganho") c.ganhos++;
    const cliName = r.cliente || "Sem cliente";
    if (!c.clientesMap.has(cliName)) c.clientesMap.set(cliName, { valorTotal: 0, recebido: 0, valorUsado: 0 });
    const cli = c.clientesMap.get(cliName)!;
    cli.valorTotal += r.valor_pedido;
    cli.recebido += r.recebido;
    cli.valorUsado += Math.max(0, r.valor_pedido - r.recebido);
  }

  // Por região
  const rMap = new Map<string, { total: number; valor: number; ganhos: number }>();
  for (const r of filtered) {
    const reg = r.unidade || r.pdo_cidade_entrega || "Sem região";
    if (!rMap.has(reg)) rMap.set(reg, { total: 0, valor: 0, ganhos: 0 });
    const rg = rMap.get(reg)!;
    rg.total++;
    rg.valor += r.valor_pedido;
    if (r.ngo_conclusao === "Ganho") rg.ganhos++;
  }

  // Por tipo
  const tMap = new Map<string, { total: number; valor: number }>();
  for (const r of filtered) {
    if (!r.tipo) continue;
    if (!tMap.has(r.tipo)) tMap.set(r.tipo, { total: 0, valor: 0 });
    const t = tMap.get(r.tipo)!;
    t.total++;
    t.valor += r.valor_pedido;
  }

  return {
    totalNegocios: filtered.length,
    totalValor,
    ticketMedio: filtered.length > 0 ? totalValor / filtered.length : 0,
    ganhos: ganhos.length,
    emAndamento: emAndamento.length,
    perdidos: perdidos.length,
    taxaConversao,
    clientesAtendidos,
    totalRecebido,
    totalUsado,
    percentUsado,
    evolucaoMensal: Array.from(evolMap.entries())
      .map(([mes, e]) => ({ mes, ...e }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
    porConsultor: Array.from(cMap.entries())
      .map(([nome, c]) => {
        const clientesAtendidosConsultor = vendedorClientesMap.get(nome)?.size || 0;
        const conversao = clientesAtendidosConsultor > 0 ? Math.round((c.total / clientesAtendidosConsultor) * 100) : 0;
        const cRecebido = Array.from(c.clientesMap.values()).reduce((s, v) => s + v.recebido, 0);
        const cUsado = Array.from(c.clientesMap.values()).reduce((s, v) => s + v.valorUsado, 0);
        const cPercentUsado = c.valor > 0 ? (cUsado / c.valor) * 100 : 0;
        return {
          nome,
          total: c.total,
          valor: c.valor,
          ganhos: c.ganhos,
          conversao,
          clientesAtendidos: clientesAtendidosConsultor,
          ticketMedio: c.total > 0 ? c.valor / c.total : 0,
          recebido: cRecebido,
          usado: cUsado,
          percentUsado: cPercentUsado,
          clientes: Array.from(c.clientesMap.entries())
            .map(([cliente, v]) => ({ cliente, ...v }))
            .sort((a, b) => b.valorTotal - a.valorTotal),
        };
      })
      .sort((a, b) => b.valor - a.valor),
    porRegiao: Array.from(rMap.entries())
      .map(([regiao, rg]) => ({ regiao, ...rg }))
      .sort((a, b) => b.valor - a.valor),
    porTipo: Array.from(tMap.entries())
      .map(([tipo, t]) => ({ tipo, ...t }))
      .sort((a, b) => b.valor - a.valor),
    registros: filtered,
  };
}

export function useNegociosData(filters: Filters) {
  const {
    data: rawRows,
    isLoading: loadingNegocios,
    error: negociosError,
  } = useQuery({
    queryKey: ["negocios-mensais"],
    queryFn: fetchNegociosMensais,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const {
    data: registrosRaw,
    isLoading: loadingRegistros,
  } = useQuery({
    queryKey: ["registros-comerciais"],
    queryFn: fetchRegistrosComerciais,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const isLoading = loadingNegocios || loadingRegistros;
  const error = negociosError ? (negociosError as Error).message : null;

  const registrosClientes: RegistroCliente[] = useMemo(() => {
    if (!registrosRaw) return [];
    return registrosRaw.map((r) => ({
      cliente_nome: r.cliente,
      vendedor: r.vendedor,
      dt_conclusao: r.dtConclusao,
      cidade_cliente: r.cidade,
    }));
  }, [registrosRaw]);

  const summary = useMemo(() => {
    if (!rawRows) return null;
    return aggregate(rawRows, filters, registrosClientes);
  }, [rawRows, filters, registrosClientes]);

  return { summary, isLoading, error };
}
