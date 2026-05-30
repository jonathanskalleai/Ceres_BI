/**
 * Lista de usuários administrativos que NÃO são consultores comerciais.
 * Seus registros são excluídos de todas as métricas comerciais e relatórios de IA.
 * Usa correspondência parcial (includes) para cobrir variações como sufixos " - Vendas".
 */
export const ADMIN_USERS = [
  "camila esser colet",
  "ana paula",
  "daniel cesar canoth",
  "mathias henrique montinelli picinato",
  "tainara trevisa",
  "tainara trevisan",
  "alex paulo ranzan",
  "alex ranzan",
  "andre candiotto",
];

export function isAdminUser(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase().replace(/\s+- .+$/, "");
  return ADMIN_USERS.some(
    (admin) => admin === normalized || normalized.includes(admin) || admin.includes(normalized)
  );
}

export function classificarUsuario(name: string | null | undefined): "Administrativo" | "Consultor Comercial" {
  return isAdminUser(name) ? "Administrativo" : "Consultor Comercial";
}
