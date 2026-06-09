import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "./sqlServerApi";
import type { Registro } from "@/types/comercial";

interface AcaoRow {
  ACO_IdAcao: string;
  ACO_CodigoAcao: string | null;
  EMP_Cidade: string;
  EMP_UF: string | null;
  CLI_Nome: string;
  ACO_TipoContato: string;
  ACO_TipoAcao: string;
  ACO_Vendedor: string;
  ACO_AtividadeExecutada: string | null;
  ACO_Lat: number | null;
  ACO_Lon: number | null;
  ACO_DthConclusao: string | null;
  ACO_Status: string | null;
  ACO_AcaoValida: string | null;
  ACO_DthAbertura: string | null;
  ACO_Contato: string | null;
  NGO_NroNegocio: string | null;
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

const ACOES_COLUMNS = [
  "ACO_IdAcao",
  "ACO_CodigoAcao",
  "EMP_Cidade",
  "EMP_UF",
  "CLI_Nome",
  "ACO_TipoContato",
  "ACO_TipoAcao",
  "ACO_Vendedor",
  "ACO_AtividadeExecutada",
  "ACO_Lat",
  "ACO_Lon",
  "ACO_DthConclusao",
  "ACO_Status",
  "ACO_AcaoValida",
  "ACO_DthAbertura",
  "ACO_Contato",
  "NGO_NroNegocio",
];

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

function mapLegacyRow(r: AcaoRow): Registro {
  return {
    idAcao: r.ACO_IdAcao || undefined,
    numero: r.ACO_CodigoAcao || undefined,
    cliente: r.CLI_Nome || "",
    cidade: r.EMP_Cidade || "",
    uf: r.EMP_UF || undefined,
    vendedor: r.ACO_Vendedor || "",
    tipoContato: r.ACO_TipoContato || "",
    tipoAcao: r.ACO_TipoAcao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.ACO_DthConclusao?.slice(0, 10) || "",
    obs: r.ACO_AtividadeExecutada || "",
    lat: r.ACO_Lat || undefined,
    lng: r.ACO_Lon || undefined,
    status: r.ACO_Status || undefined,
    acaoValida: r.ACO_AcaoValida || undefined,
    dtAbertura: r.ACO_DthAbertura?.slice(0, 10) || undefined,
    contato: r.ACO_Contato || undefined,
    nroNegocio: r.NGO_NroNegocio || undefined,
  };
}

async function fetchFromMirror(): Promise<Registro[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_acoes")
    .select(MIRROR_SELECT);
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorAcaoRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<Registro[]> {
  const acoes = await fetchAllPages<AcaoRow>("VW_Ceres_CRM_Acoes", ACOES_COLUMNS);
  return acoes.map(mapLegacyRow);
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
