import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "./sqlServerApi";
import type { Registro } from "@/types/comercial";

interface AcaoRow {
  EMP_Cidade: string;
  CLI_Nome: string;
  ACO_TipoContato: string;
  ACO_TipoAcao: string;
  ACO_Vendedor: string;
  ACO_AtividadeExecutada: string;
  ACO_Lat: number | null;
  ACO_Lon: number | null;
  ACO_DthConclusao: string | null;
}

interface MirrorAcaoRow {
  emp_cidade: string | null;
  cli_nome: string | null;
  aco_tipo_contato: string | null;
  aco_tipo_acao: string | null;
  aco_vendedor: string | null;
  aco_atividade_executada: string | null;
  aco_lat: number | null;
  aco_lon: number | null;
  aco_dth_conclusao: string | null;
}

const ACOES_COLUMNS = [
  "EMP_Cidade",
  "CLI_Nome",
  "ACO_TipoContato",
  "ACO_TipoAcao",
  "ACO_Vendedor",
  "ACO_AtividadeExecutada",
  "ACO_Lat",
  "ACO_Lon",
  "ACO_DthConclusao",
];

async function fetchFromMirror(): Promise<Registro[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_acoes")
    .select("emp_cidade,cli_nome,aco_tipo_contato,aco_tipo_acao,aco_vendedor,aco_atividade_executada,aco_lat,aco_lon,aco_dth_conclusao");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorAcaoRow[]).map((r) => ({
    cliente: r.cli_nome || "",
    cidade: r.emp_cidade || "",
    vendedor: r.aco_vendedor || "",
    tipoContato: r.aco_tipo_contato || "",
    tipoAcao: r.aco_tipo_acao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.aco_dth_conclusao?.slice(0, 10) || "",
    obs: r.aco_atividade_executada || "",
    lat: r.aco_lat || undefined,
    lng: r.aco_lon || undefined,
  }));
}

async function fetchFromLegacy(): Promise<Registro[]> {
  const acoes = await fetchAllPages<AcaoRow>("VW_Ceres_CRM_Acoes", ACOES_COLUMNS);
  return acoes.map((r) => ({
    cliente: r.CLI_Nome || "",
    cidade: r.EMP_Cidade || "",
    vendedor: r.ACO_Vendedor || "",
    tipoContato: r.ACO_TipoContato || "",
    tipoAcao: r.ACO_TipoAcao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.ACO_DthConclusao?.slice(0, 10) || "",
    obs: r.ACO_AtividadeExecutada || "",
    lat: r.ACO_Lat || undefined,
    lng: r.ACO_Lon || undefined,
  }));
}

export async function fetchRegistrosComerciais(): Promise<Registro[]> {
  if (USE_MIRROR.crm_acoes) {
    try {
      return await fetchFromMirror();
    } catch {
      return await fetchFromLegacy();
    }
  }
  try {
    return await fetchFromLegacy();
  } catch {
    return [];
  }
}
