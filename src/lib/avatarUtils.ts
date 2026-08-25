export function getConsultorAvatarUrl(
  nome: string,
  style: "lorelei" | "adventurer" | "avataaars" | "personas" | "notionists" = "lorelei"
): string {
  if (!nome) return "";
  const cleanSeed = encodeURIComponent(nome.trim().toLowerCase());
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${cleanSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
