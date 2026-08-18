import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchKpisComercial,
  fetchRankingVendedores,
  fetchEvolucaoMensal,
  fetchRankingRegioes,
  fetchClientesPorVendedor,
  fetchRankingVendedoresV2,
  fetchRegistrosRecentes,
  fetchEvolucaoNegocios12m,
  fetchEvolucaoTiposAcao12m,
} from "@/services/comercialRpcService";
import type {
  RpcKpisComercial,
  RpcRankingVendedor,
  RpcEvolucaoMensal,
  RpcRankingRegiao,
  RpcClienteVendedor,
  RpcRankingVendedorV2,
  RpcRegistroRecente,
  RpcEvolucaoNegocios12m,
  RpcEvolucaoTiposAcao12m,
} from "@/types/comercialRpc";

const STALE_TIME = 5 * 60_000; // 5 minutes

// ─── KPIs ────────────────────────────────────────────────────────────────────

interface UseKpisComercialOptions {
  from: string;
  to: string;
  vendedor?: string;
  enabled?: boolean;
}

export function useKpisComercial({ from, to, vendedor, enabled = true }: UseKpisComercialOptions) {
  return useQuery<RpcKpisComercial, Error>({
    queryKey: ["rpc", "kpis-comercial", from, to, vendedor ?? null],
    queryFn: () => fetchKpisComercial(from, to, vendedor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Ranking Vendedores ──────────────────────────────────────────────────────

interface UseRankingVendedoresOptions {
  from: string;
  to: string;
  limit?: number;
  enabled?: boolean;
}

export function useRankingVendedores({ from, to, limit, enabled = true }: UseRankingVendedoresOptions) {
  return useQuery<RpcRankingVendedor[], Error>({
    queryKey: ["rpc", "ranking-vendedores", from, to, limit ?? null],
    queryFn: () => fetchRankingVendedores(from, to, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Evolução Mensal ─────────────────────────────────────────────────────────

interface UseEvolucaoMensalOptions {
  from: string;
  to: string;
  vendedor?: string;
  enabled?: boolean;
}

export function useEvolucaoMensal({ from, to, vendedor, enabled = true }: UseEvolucaoMensalOptions) {
  return useQuery<RpcEvolucaoMensal[], Error>({
    queryKey: ["rpc", "evolucao-mensal", from, to, vendedor ?? null],
    queryFn: () => fetchEvolucaoMensal(from, to, vendedor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Ranking Regiões ─────────────────────────────────────────────────────────

interface UseRankingRegioesOptions {
  from: string;
  to: string;
  limit?: number;
  enabled?: boolean;
}

export function useRankingRegioes({ from, to, limit, enabled = true }: UseRankingRegioesOptions) {
  return useQuery<RpcRankingRegiao[], Error>({
    queryKey: ["rpc", "ranking-regioes", from, to, limit ?? null],
    queryFn: () => fetchRankingRegioes(from, to, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Clientes por Vendedor ───────────────────────────────────────────────────

interface UseClientesPorVendedorOptions {
  vendedor: string;
  from: string;
  to: string;
  enabled?: boolean;
}

export function useClientesPorVendedor({ vendedor, from, to, enabled = true }: UseClientesPorVendedorOptions) {
  return useQuery<RpcClienteVendedor[], Error>({
    queryKey: ["rpc", "clientes-vendedor", vendedor, from, to],
    queryFn: () => fetchClientesPorVendedor(vendedor, from, to),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!vendedor,
  });
}

// ─── Ranking Vendedores V2 (expanded) ───────────────────────────────────────

interface UseRankingVendedoresV2Options {
  from: string;
  to: string;
  limit?: number;
  enabled?: boolean;
}

export function useRankingVendedoresV2({ from, to, limit, enabled = true }: UseRankingVendedoresV2Options) {
  return useQuery<RpcRankingVendedorV2[], Error>({
    queryKey: ["rpc", "ranking-vendedores-v2", from, to, limit ?? null],
    queryFn: () => fetchRankingVendedoresV2(from, to, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled: enabled && !!from && !!to,
  });
}

// ─── Registros Recentes ───────────────────────────────────────────────────────

interface UseRegistrosRecentesOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  limit?: number;
  enabled?: boolean;
}

export function useRegistrosRecentes({ from, to, vendedor, cidade, limit, enabled = true }: UseRegistrosRecentesOptions) {
  return useQuery<RpcRegistroRecente[], Error>({
    queryKey: ["rpc", "registros-recentes", from ?? null, to ?? null, vendedor ?? null, cidade ?? null, limit ?? null],
    queryFn: () => fetchRegistrosRecentes(from || "", to || "", vendedor, cidade, limit),
    staleTime: 10 * 60_000, // 10 min — dados mudam com ETL
    gcTime: 30 * 60_000,    // 30 min — mantém cache para back/forward
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Evolução Negócios 12m ──────────────────────────────────────────────────

interface UseEvolucaoNegocios12mOptions {
  vendedor?: string;
  enabled?: boolean;
}

export function useEvolucaoNegocios12m({ vendedor, enabled = true }: UseEvolucaoNegocios12mOptions) {
  return useQuery<RpcEvolucaoNegocios12m[], Error>({
    queryKey: ["rpc", "evolucao-negocios-12m", vendedor ?? null],
    queryFn: () => fetchEvolucaoNegocios12m(vendedor),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}

// ─── Evolução Tipos de Ação 12m ─────────────────────────────────────────────

interface UseEvolucaoTiposAcao12mOptions {
  vendedor?: string;
  limit?: number;
  enabled?: boolean;
}

export function useEvolucaoTiposAcao12m({ vendedor, limit, enabled = true }: UseEvolucaoTiposAcao12mOptions) {
  return useQuery<RpcEvolucaoTiposAcao12m[], Error>({
    queryKey: ["rpc", "evolucao-tipos-acao-12m", vendedor ?? null, limit ?? null],
    queryFn: () => fetchEvolucaoTiposAcao12m(vendedor, limit),
    staleTime: STALE_TIME,
    placeholderData: keepPreviousData,
    enabled,
  });
}
