/**
 * Types for the Clientes KPIs section of the Painel BI.
 * Extracted from the legacy useClientesKPIs hook to allow
 * useClientesKPIsRpc and consumers to import without depending
 * on the deprecated hook.
 */

export type Trend = "up" | "down" | "neutral";

export interface KPIWithPrev {
  value: number;
  previousValue: number;
  trend: Trend;
}

export interface ClientesKPIs {
  clientesAtivos: KPIWithPrev;
  prospects: KPIWithPrev;
  parqueMaquinas: KPIWithPrev;
  coberturaComercial: KPIWithPrev;
}

export interface UseClientesKPIsResult {
  kpis: ClientesKPIs;
  isLoading: boolean;
}
