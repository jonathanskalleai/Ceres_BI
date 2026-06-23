import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchKpisComercial,
  fetchRankingVendedores,
  fetchEvolucaoMensal,
  fetchRankingRegioes,
  fetchClientesPorVendedor,
} from "@/services/comercialRpcService";
import type {
  RpcKpisComercial,
  RpcRankingVendedor,
  RpcEvolucaoMensal,
  RpcRankingRegiao,
  RpcClienteVendedor,
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
