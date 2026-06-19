/**
 * Macro-filtro de Categoria — agrupa funis individuais do CRM em categorias de negocio.
 *
 * Mapeamento fixo (case-sensitive, reflete exatamente os valores de ngo_funil no banco):
 * - "Vendas Maquinas" -> Vendas, ADM, Bancos, Oficina, Marketing
 * - "Vendas AP" -> Vendas AP, Adm AP, Logistica AP
 * - "Repasse" -> Repasse de Maquina
 */

export type CategoriaFunil = "Vendas Maquinas" | "Vendas AP" | "Repasse";

export const CATEGORIA_ALL = "__all__" as const;

export type CategoriaFilter = typeof CATEGORIA_ALL | CategoriaFunil;

/** Mapeamento categoria -> array de funis exatos do banco. */
const CATEGORIA_MAP: Record<CategoriaFunil, string[]> = {
  "Vendas Maquinas": ["VENDAS", "ADM", "BANCOS", "OFICINA", "MARKETING"],
  "Vendas AP": ["Vendas AP", "Adm AP", "Logistica AP"],
  "Repasse": ["REPASSE DE MAQUINA"],
};

/** Opcoes para o dropdown de categoria (inclui "Todos"). */
export const CATEGORIA_OPTIONS: { value: CategoriaFilter; label: string }[] = [
  { value: CATEGORIA_ALL, label: "Todos" },
  { value: "Vendas Maquinas", label: "Vendas Maquinas" },
  { value: "Vendas AP", label: "Vendas AP" },
  { value: "Repasse", label: "Repasse" },
];

/**
 * Dado um nome de funil exato (do banco), retorna a categoria correspondente.
 * Retorna undefined se o funil nao pertence a nenhuma categoria mapeada.
 */
export function getCategoria(nomeFunil: string): CategoriaFunil | undefined {
  for (const [cat, funis] of Object.entries(CATEGORIA_MAP) as [CategoriaFunil, string[]][]) {
    if (funis.includes(nomeFunil)) return cat;
  }
  return undefined;
}

/**
 * Dado uma categoria, retorna o array de funis que ela engloba.
 * Retorna array vazio se a categoria for "__all__" ou invalida.
 */
export function getFunisByCategoria(categoria: CategoriaFilter): string[] {
  if (categoria === CATEGORIA_ALL) return [];
  return CATEGORIA_MAP[categoria] ?? [];
}

/**
 * Retorna todos os funis mapeados (uniao de todas as categorias).
 * Util para queries que precisam saber o universo completo de funis.
 */
export function getAllMappedFunis(): string[] {
  return Object.values(CATEGORIA_MAP).flat();
}

/** Array flat com todos os 9 funis individuais (para dropdown quando categoria = __all__). */
export const ALL_FUNIS: string[] = Object.values(CATEGORIA_MAP).flat();

export const FUNIL_ALL = "__all__" as const;

/**
 * Retorna opcoes de funil para o dropdown dado uma categoria selecionada.
 * Se categoria == __all__, retorna todos os 9 funis; caso contrário apenas os da categoria.
 */
export function getFunilOptions(categoria: CategoriaFilter): { value: string; label: string }[] {
  const funis = categoria === CATEGORIA_ALL ? ALL_FUNIS : (CATEGORIA_MAP[categoria] ?? []);
  return [
    { value: FUNIL_ALL, label: "Todos os funis" },
    ...funis.map((f) => ({ value: f, label: f })),
  ];
}
