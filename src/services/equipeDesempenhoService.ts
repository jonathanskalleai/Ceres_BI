import { supabase } from "@/integrations/supabase/client";
import type {
  EquipeDesempenhoData,
  MetaConsultorMensal,
} from "@/types/equipeDesempenho";

export interface EquipeDesempenhoParams {
  ano: number;
  consultor?: string;
  cidade?: string;
}

export async function fetchEquipeDesempenho({
  ano,
  consultor,
  cidade,
}: EquipeDesempenhoParams): Promise<EquipeDesempenhoData> {
  const { data, error } = await supabase.rpc("rpc_equipe_desempenho_mensal_v2", {
    p_ano: ano,
    p_consultor: consultor || null,
    p_cidade: cidade || null,
  });

  if (error) {
    throw new Error(`[equipeDesempenhoService.fetchEquipeDesempenho] ${error.message}`);
  }

  const raw = (Array.isArray(data) ? data[0] : data) as Partial<EquipeDesempenhoData> | null;
  return {
    rows: raw?.rows ?? [],
    team: raw?.team ?? [],
  };
}

export async function upsertMetasConsultorMensal(
  metas: MetaConsultorMensal[],
): Promise<void> {
  const { error } = await supabase
    .from("metas_consultor_mensal")
    .upsert(metas, { onConflict: "consultor,competencia" });

  if (error) {
    throw new Error(`[equipeDesempenhoService.upsertMetasConsultorMensal] ${error.message}`);
  }
}
