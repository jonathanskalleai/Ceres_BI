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
  aco_idacao: string;
  aco_codigoacao: string | null;
  emp_cidade: string | null;
  emp_uf: string | null;
  cli_nome: string | null;
  aco_tipocontato: string | null;
  aco_tipoacao: string | null;
  aco_vendedor: string | null;
  aco_atividadeexecutada: string | null;
  aco_lat: string | null;
  aco_lon: string | null;
  aco_dthconclusao: string | null;
  aco_status: string | null;
  aco_acaovalida: string | null;
  aco_dthabertura: string | null;
  aco_contato: string | null;
  ngo_nronegocio: string | null;
}

const MIRROR_SELECT = [
  "aco_idacao",
  "aco_codigoacao",
  "emp_cidade",
  "emp_uf",
  "cli_nome",
  "aco_tipocontato",
  "aco_tipoacao",
  "aco_vendedor",
  "aco_atividadeexecutada",
  "aco_lat",
  "aco_lon",
  "aco_dthconclusao",
  "aco_status",
  "aco_acaovalida",
  "aco_dthabertura",
  "aco_contato",
  "ngo_nronegocio",
].join(",");

function mapMirrorRow(r: MirrorAcaoRow): Registro {
  return {
    idAcao: r.aco_idacao || undefined,
    numero: r.aco_codigoacao || undefined,
    cliente: r.cli_nome || "",
    cidade: r.emp_cidade || "",
    uf: r.emp_uf || undefined,
    vendedor: r.aco_vendedor || "",
    tipoContato: r.aco_tipocontato || "",
    tipoAcao: r.aco_tipoacao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.aco_dthconclusao?.slice(0, 10) || "",
    obs: r.aco_atividadeexecutada || "",
    lat: r.aco_lat ? Number(r.aco_lat) : undefined,
    lng: r.aco_lon ? Number(r.aco_lon) : undefined,
    status: r.aco_status || undefined,
    acaoValida: r.aco_acaovalida || undefined,
    dtAbertura: r.aco_dthabertura?.slice(0, 10) || undefined,
    contato: r.aco_contato || undefined,
    nroNegocio: r.ngo_nronegocio || undefined,
  };
}


export async function fetchRegistrosComerciais(options?: RegistrosFetchOptions): Promise<Registro[]> {
  try {
    let q = supabase.schema("mirror").from("crm_acoes").select(MIRROR_SELECT);

    // Date filter: include rows within range OR with NULL aco_dth_conclusao (open actions).
    // We don't filter by aco_dth_conclusao server-side because:
    // 1. Most CRM actions are open (NULL conclusion date) and must appear in dashboard
    // 2. PostgREST .or() with ISO timestamps containing special chars causes 400 errors
    // Date filtering is handled client-side in the data hooks instead.

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
