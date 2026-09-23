const QUERY_LABELS: Record<string, string> = {
  "acoes-bi": "indicadores principais",
  "acoes-evolucao-mensal-ano-corrente": "evolução mensal",
  "acoes-detalhe": "ações do período",
  "acoes-funil-gestao-periodo": "funil e gestão",
  "acoes-mapa-oportunidades": "mapa de oportunidades",
  "acoes-termometro-fechamento": "termômetro de fechamento",
  "clientes-risco": "clientes em risco",
  "clientes-criticos": "clientes críticos",
  "acoes-gestao-listas": "gestão da carteira",
  "acoes-pedidos-ganhos": "pedidos ganhos",
  "acoes-negocios-perdidos": "negócios perdidos",
  "acoes-em-andamento": "negócios em andamento",
  "pedidos-esteira": "esteira de pedidos",
  "sinais-campo-semana": "insights da IA",
};

/** Converts a query key into a safe, human-readable source label. */
export function getBiQueryLabel(queryKey: readonly unknown[]): string {
  const family = queryKey.length > 1 ? queryKey[1] : queryKey[0];
  const key = typeof family === "string" ? family : "consulta BI";
  return QUERY_LABELS[key] ?? key.replace(/[-_]+/g, " ");
}
