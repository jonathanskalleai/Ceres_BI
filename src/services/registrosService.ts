import { supabase } from "@/integrations/supabase/client";
import type { Registro } from "@/types/comercial";

export interface RegistrosFetchOptions {
  /** ISO date string YYYY-MM-DD — filtra aco_dth_conclusao >= from */
  from?: string;
  /** ISO date string YYYY-MM-DD — filtra aco_dth_conclusao <= to */
  to?: string;
  vendedor?: string;
  cidade?: string;
}

interface MirrorAcaoRow {
  aco_id_acao: string;
  aco_codigo_acao: string | null;
  emp_cidade: string | null;
  emp_uf: string | null;
  cli_nome: string | null;
  aco_tipo_contato: string | null;
  aco_tipo_acao: string | null;
  aco_vendedor: string | null;
  aco_atividade_executada: string | null;
  aco_lat: number | null;
  aco_lon: number | null;
  aco_dth_conclusao: string | null;
  aco_status: string | null;
  aco_acao_valida: string | null;
  aco_dth_abertura: string | null;
  aco_contato: string | null;
  ngo_nro_negocio: string | null;
}

const MIRROR_SELECT = [
  "aco_id_acao",
  "aco_codigo_acao",
  "emp_cidade",
  "emp_uf",
  "cli_nome",
  "aco_tipo_contato",
  "aco_tipo_acao",
  "aco_vendedor",
  "aco_atividade_executada",
  "aco_lat",
  "aco_lon",
  "aco_dth_conclusao",
  "aco_status",
  "aco_acao_valida",
  "aco_dth_abertura",
  "aco_contato",
  "ngo_nro_negocio",
].join(",");

function mapMirrorRow(r: MirrorAcaoRow): Registro {
  return {
    idAcao: r.aco_id_acao || undefined,
    numero: r.aco_codigo_acao || undefined,
    cliente: r.cli_nome || "",
    cidade: r.emp_cidade || "",
    uf: r.emp_uf || undefined,
    vendedor: r.aco_vendedor || "",
    tipoContato: r.aco_tipo_contato || "",
    tipoAcao: r.aco_tipo_acao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.aco_dth_conclusao?.slice(0, 10) || "",
    obs: r.aco_atividade_executada || "",
    lat: r.aco_lat || undefined,
    lng: r.aco_lon || undefined,
    status: r.aco_status || undefined,
    acaoValida: r.aco_acao_valida || undefined,
    dtAbertura: r.aco_dth_abertura?.slice(0, 10) || undefined,
    contato: r.aco_contato || undefined,
    nroNegocio: r.ngo_nro_negocio || undefined,
  };
}

// Timezone fix: Supabase PostgREST stores dates in UTC.
// To correctly filter for Brazilian local time (UTC-3), we must:
// - from: start of day in Brazil = start of day UTC + 3h = "YYYY-MM-DDT03:00:00Z"
// - to:   end of day in Brazil   = next day start in UTC = "YYYY-MM-DD+1T02:59:59.999Z"
// This captures all actions from 00:00 to 23:59:59 BRT (21:00 prev day UTC to 02:59:59 next day UTC).
function toUTCISO(dateStr: string, endOfDay: boolean): string {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC avoids midnight boundary issues
  if (endOfDay) {
    d.setDate(d.getDate() + 1);
    d.setUTCHours(2, 59, 59, 999); // 02:59:59.999 UTC = 23:59:59 BRT-3
  } else {
    d.setUTCHours(3, 0, 0, 0); // 03:00:00 UTC = 00:00:00 BRT-3
  }
  return d.toISOString();
}

export async function fetchRegistrosComerciais(options?: RegistrosFetchOptions): Promise<Registro[]> {
  try {
    let q = supabase.schema("mirror").from("crm_acoes").select(MIRROR_SELECT);
    if (options?.from) q = q.gte("aco_dth_conclusao", toUTCISO(options.from, false));
    if (options?.to) q = q.lte("aco_dth_conclusao", toUTCISO(options.to, true));
    if (options?.vendedor) q = q.eq("aco_vendedor", options.vendedor);
    if (options?.cidade) q = q.eq("emp_cidade", options.cidade);
    q = q.limit(50000);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorAcaoRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
