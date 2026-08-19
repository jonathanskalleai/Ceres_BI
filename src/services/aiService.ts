/**
 * Helper para chamadas à API de IA (Python/FastAPI).
 * Em produção, o Traefik roteia /api/ai/* para o container Python.
 * Todas as chamadas incluem o JWT do Supabase para autenticação.
 */

import { supabase } from "@/integrations/supabase/client";

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
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${AI_BASE_URL}${path}`, {
      method,
      headers,
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

export interface AiSinaisCampoSemanais {
  semanaInicio: string;
  semanaFim: string;
  totalTextos: number;
  positivos: number;
  negativos: number;
  neutros: number;
  score: number;
  topTermos: { termo: string; mencoes: number }[];
  produtos: { produto: string; mencoes: number }[];
  analiseIa?: {
    titulo: string;
    resumoExecutivo: string;
    leituraSentimento: string;
    interessesDemanda: { tema: string; leitura: string }[];
    objecoesAlertas: { tema: string; leitura: string }[];
    proximosPassos: string[];
    confianca: "alta" | "media" | "baixa";
  } | null;
  message?: string;
}

export async function aiGetSinaisCampoSemanais(): Promise<AiResponse<AiSinaisCampoSemanais>> {
  return callAiEndpoint("/field-signals");
}
