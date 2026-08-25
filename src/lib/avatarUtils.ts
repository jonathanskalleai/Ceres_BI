/**
 * Gera avatares no estilo corporativo/executivo (masculino/business)
 * com blazer, camisa social, cortes curtos executivos e traços limpos.
 */
export function getConsultorAvatarUrl(nome: string): string {
  if (!nome) return "";
  const cleanSeed = encodeURIComponent(nome.trim().toLowerCase());

  const params = new URLSearchParams({
    seed: cleanSeed,
    top: "shortFlat,shortWaved,theCaesar,shortCurly,sides",
    clothing: "blazerAndShirt,blazerAndSweater,collarAndSweater",
    clothingColor: "262e33,3c444c,25557c,5199e4,334155",
    backgroundColor: "e2e8f0,cbd5e1,dbeafe,e0e7ff,f1f5f9",
    facialHairProbability: "45",
    accessoriesProbability: "30",
  });

  return `https://api.dicebear.com/7.x/avataaars/svg?${params.toString()}`;
}
