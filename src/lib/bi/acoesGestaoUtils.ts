import type { AcoesFunil, AcoesRankingConsultorItem } from "@/types/biRpc";

/**
 * Funcoes PURAS da gestao comercial de /bi/acoes.
 *
 * Separadas dos componentes de proposito (#7 logica/UI): sao a parte que pode
 * dar numero ERRADO em silencio — razao com denominador zero, ordenacao que
 * oscila entre renders, sentinela de "sem acao" virando "999 dias". Tudo aqui
 * tem teste unitario em `__tests__/acoesGestaoUtils.test.ts`.
 */

// ─── Razoes (divisao por zero -> null, nunca 0/Infinity/NaN) ────────────────

/**
 * Razao segura. Retorna `null` — nao `0`, nao `Infinity`, nao `NaN` — quando
 * nao existe denominador. Num BI, `0` e um numero AFIRMADO; a ausencia de
 * denominador e ausencia de dado, e a tela precisa exibir "—".
 */
export function safeRatio(numerador: number | null | undefined, denominador: number | null | undefined): number | null {
  if (numerador == null || denominador == null) return null;
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) return null;
  if (denominador === 0) return null;
  const r = numerador / denominador;
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : null;
}

/**
 * Razoes do funil. Usa o valor da RPC quando ele veio (a RPC ja faz
 * `NULLIF(denominador, 0)`), e recalcula so quando o campo esta ausente —
 * caso de RPC redeployada/parcial. Nunca inventa numero quando o denominador
 * e zero: nesse caso o resultado e `null` dos dois lados.
 */
export function funilRatios(funil: AcoesFunil): {
  visitasPorOportunidade: number | null;
  oportPorFechamento: number | null;
} {
  return {
    visitasPorOportunidade:
      funil.visitasPorOportunidade ?? safeRatio(funil.visitas, funil.oportunidades),
    oportPorFechamento:
      funil.oportPorFechamento ?? safeRatio(funil.oportunidades, funil.ganhos),
  };
}

// ─── Ranking de consultores ────────────────────────────────────────────────

export const RANKING_CRITERIOS = ["visitas", "oportunidades", "ganhos", "perdidos", "valorGanho"] as const;
export type RankingCriterio = (typeof RANKING_CRITERIOS)[number];

export const RANKING_CRITERIO_LABEL: Record<RankingCriterio, string> = {
  visitas: "Visitas",
  oportunidades: "Oportunidades",
  ganhos: "Ganhos",
  perdidos: "Perdidos",
  valorGanho: "Valor ganho",
};

/**
 * Ordena o ranking por criterio, DESC, com desempate ESTAVEL pelo nome do
 * consultor. Sem o desempate, dois consultores com o mesmo numero trocariam de
 * posicao entre renders e o gestor veria "a lista mudou sozinha".
 *
 * Nao muta a entrada (o array vem do cache do react-query) e nao refaz fetch:
 * o toggle de criterio e 100% client-side — a RPC ja devolveu os 4 numeros.
 */
export function sortRanking(
  rows: readonly AcoesRankingConsultorItem[],
  criterio: RankingCriterio,
  topN?: number,
): AcoesRankingConsultorItem[] {
  const sorted = [...rows].sort((a, b) => {
    const diff = (b[criterio] ?? 0) - (a[criterio] ?? 0);
    if (diff !== 0) return diff;
    return a.consultor.localeCompare(b.consultor, "pt-BR");
  });
  return topN != null ? sorted.slice(0, topN) : sorted;
}

// ─── Faixas do chart "Clientes em Risco" (drill-down) ──────────────────────

export interface FaixaDiasRange {
  diasMin: number;
  /** `undefined` = aberto a direita (faixa "+90"). */
  diasMax?: number;
}

/**
 * Traduz o rotulo da barra clicada em `p_dias_min`/`p_dias_max`.
 *
 * A faixa "+90" fica ABERTA a direita de proposito: `dias = 999` e a sentinela
 * de "nenhuma acao no ano" e precisa cair nela — e assim que a soma da lista
 * bate com a altura da barra clicada. Fechar em 90 quebraria os dois graficos
 * de uma vez.
 */
export function faixaToDiasRange(faixa: string): FaixaDiasRange | null {
  const label = faixa.trim();
  if (label.startsWith("+")) {
    const min = Number(label.slice(1));
    return Number.isFinite(min) ? { diasMin: min + 1 } : null;
  }
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(label);
  if (!m) return null;
  return { diasMin: Number(m[1]), diasMax: Number(m[2]) };
}

// ─── Formatadores de exibicao ──────────────────────────────────────────────

/** Traço em vez de numero quando nao ha dado. Nunca "0" para ausencia. */
export const DASH = "—";

export function fmtRatio(v: number | null | undefined, sufixo = ""): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${sufixo}`;
}

export function fmtPctOrDash(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

/** Sentinela do servidor para "cliente sem nenhuma acao no ano corrente". */
export const DIAS_SEM_ACAO_NO_ANO = 999;

/**
 * Rotulo de dias sem contato. `999` NAO e um numero de dias: e sentinela.
 * Renderizar "999 dias" seria um dado falso apresentado como medicao.
 */
export function fmtDiasSemContato(dias: number | null | undefined, semAcaoNoAno?: boolean): string {
  if (dias == null || !Number.isFinite(dias)) return DASH;
  if (semAcaoNoAno || dias >= DIAS_SEM_ACAO_NO_ANO) return "Sem acao no ano";
  return `${dias.toLocaleString("pt-BR")} dias`;
}

/** Dias parados de um negocio. `null` = negocio nunca teve acao registrada. */
export function fmtDiasParado(dias: number | null | undefined): string {
  if (dias == null || !Number.isFinite(dias)) return "Sem acao registrada";
  return `${dias.toLocaleString("pt-BR")} dias`;
}
