import { supabase } from "@/integrations/supabase/client";

export async function fetchMetaAnual(ano: number): Promise<number> {
  const { data, error } = await supabase
    .from("metas_comerciais")
    .select("meta_anual")
    .eq("ano", ano)
    .single();
  if (error || !data) return 30_000_000;
  return Number(data.meta_anual);
}
