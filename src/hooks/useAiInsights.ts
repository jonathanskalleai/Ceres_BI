import { useQuery } from "@tanstack/react-query";
import { fetchAI } from "@/lib/fetchAI";

export interface InsightItem {
  tipo: string;
  titulo: string;
  descricao: string;
  consultor: string | null;
  prioridade: string;
}

export interface InsightEquipe {
  destaque_semana?: string;
  insights?: InsightItem[];
  acoes_gestor?: string[];
  semana_inicio?: string;
  semana_fim?: string;
}

const STALE_TIME = 15 * 60_000; // 15 min cache
const GC_TIME = 60 * 60_000;    // 1h memory cache

export function useAiInsightsEquipe() {
  return useQuery<InsightEquipe | null, Error>({
    queryKey: ["ai-insights", "equipe"],
    queryFn: async () => {
      try {
        const res = await fetchAI("/api/ai/insights?tipo=equipe");
        if (!res.ok) return null;
        const data = await res.json();
        if (data && !data.message) return data;
        return null;
      } catch {
        return null;
      }
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}
