/**
 * Predicado unico do modo debug do BI.
 *
 * Extraido de `BiDebugOverlay` porque agora ha um segundo consumidor: o detalhe
 * tecnico de um erro (nome do service, funcao e objeto de banco) so pode
 * aparecer para quem esta depurando, nunca para o usuario final da tela
 * (security-standards #6 — cliente recebe erro generico; o detalhe fica no
 * servidor ou atras de um gate). Dois predicados divergentes seriam a forma
 * classica de um deles vazar em producao.
 */
export function isBiDebugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  return typeof localStorage !== "undefined" && localStorage.getItem("bi_debug") === "true";
}
