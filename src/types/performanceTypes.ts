/**
 * Shared input shape for usePerformanceMetrics.
 * Extracted from usePerformanceData + usePerformanceMetrics to avoid duplication.
 */
export interface NegociosSummaryInput {
  totalValor: number;
  totalRecebido: number;
  totalUsado: number;
  evolucaoMensal: Array<{ mes: string }>;
  taxaConversao: number;
  emAndamento: number;
  porConsultor: Array<{ nome: string; total: number; conversao: number }>;
}
