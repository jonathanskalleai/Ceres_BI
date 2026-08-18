/**
 * Helper para chamadas à API de IA (Python/FastAPI).
 * Em produção, o Traefik roteia /api/ai/* para o container Python.
 * Em dev local, fallback para a Edge Function via Supabase.
 */

const AI_BASE_URL = "/api/ai";

interface AiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

async function callAiEndpoint<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  method: "GET" | "POST" = body ? "POST" : "GET",
): Promise<AiResponse<T>> {
  try {
    const res = await fetch(`${AI_BASE_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg =
        (errData as { error?: string }).error ??
        (errData as { detail?: string }).detail ??
        `Erro ${res.status}`;
      return { data: null, error: msg };
    }

    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Erro de conexão" };
  }
}

export async function aiClientAnalysis(body: {
  clienteNome: string;
  vendedorNome: string;
  acoes: unknown[];
}): Promise<AiResponse<{ analysis: string }>> {
  return callAiEndpoint("/client-analysis", body);
}

export async function aiConsultoresReport(
  consultor?: string,
): Promise<AiResponse<Record<string, unknown>>> {
  return callAiEndpoint("/consultores-report", consultor ? { consultor } : {});
}

export async function aiNegociosInsights(): Promise<
  AiResponse<{ insights: unknown[]; alertas: unknown[]; cruzamento_obs?: string }>
> {
  return callAiEndpoint("/negocios-insights");
}

export async function aiGetInsightsEquipe(): Promise<AiResponse<{
  destaque_semana: string;
  insights: { tipo: string; titulo: string; descricao: string; consultor: string | null; prioridade: string }[];
  acoes_gestor: string[];
  ranking_semanal: { nome: string; nota: string; motivo: string }[];
}>> {
  return callAiEndpoint("/insights?tipo=equipe");
}

export async function aiGetInsightsConsultor(consultor: string): Promise<AiResponse<{
  nota: string;
  frase_impacto: string;
  pontos_fortes: string[];
  pontos_atencao: string[];
  acoes_recomendadas: string[];
  clientes_prioritarios: string[];
}>> {
  return callAiEndpoint(`/insights?tipo=individual&consultor=${encodeURIComponent(consultor)}`);
}
