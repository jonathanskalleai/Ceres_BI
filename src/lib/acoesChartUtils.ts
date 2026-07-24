import type { AcoesBIPieDatum } from "@/types/biRpc";

/** Barras individuais no chart de tipo de acao; o excedente vira uma linha "Outros". */
export const TIPO_ACAO_TOP_N = 8;

export interface TipoAcaoBar {
  name: string;
  acoes: number;
}

/**
 * Top N tipos de acao + linha "Outros (N tipos)" agregada.
 *
 * Substituiu o donut: sao ate 20 categorias e a paleta VOUX tem 7 cores
 * (`SvgDonut` faz `palette[i % 7]`), entao as fatias 1, 8 e 15 saiam com a MESMA
 * cor. A soma das barras continua sendo o total de acoes com tipo preenchido —
 * agregar o excedente nao pode perder volume.
 */
export function buildTipoAcaoBars(data: AcoesBIPieDatum[], topN = TIPO_ACAO_TOP_N): TipoAcaoBar[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, topN).map((d) => ({ name: d.name, acoes: d.value }));
  const rest = sorted.slice(topN);
  if (rest.length === 0) return top;
  const outros = rest.reduce((acc, d) => acc + d.value, 0);
  return [...top, { name: `Outros (${rest.length} tipos)`, acoes: outros }];
}
