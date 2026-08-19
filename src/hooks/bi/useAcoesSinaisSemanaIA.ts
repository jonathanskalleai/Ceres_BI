import { useQuery } from "@tanstack/react-query";
import { aiGetSinaisCampoSemanais, type AiSinaisCampoSemanais } from "@/services/aiService";

export function useAcoesSinaisSemanaIA(enabled = true) {
  return useQuery<AiSinaisCampoSemanais, Error>({
    queryKey: ["ai", "sinais-campo-semana"],
    queryFn: async () => {
      const result = await aiGetSinaisCampoSemanais();
      if (result.error) throw new Error(result.error);
      return result.data ?? { semanaInicio: "", semanaFim: "", totalTextos: 0, positivos: 0, negativos: 0, neutros: 0, score: 0, topTermos: [], produtos: [] };
    },
    staleTime: 10 * 60_000,
    enabled,
  });
}
