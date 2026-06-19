import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

/**
 * Linha de negocio do CRM com as colunas de negocio ricas de VW_Ceres_CRM_Negocios.
 */
export interface NegocioBIRow {
  NGO_Numero: string;
  NGO_Conclusao: string | null;
  NGO_Etapa: string | null;
  NGO_Funil: string | null;
  NGO_VlrTotalNegociado: number | null;
  NGO_FormaEntrada: string | null;
  NGO_MotivoPerda: string | null;
  NGO_MotivoGanho: string | null;
  NGO_CicloVendas: number | null;
  NGO_QtdAcoes: number | null;
  NGO_Probabilidade: number | null;
  NGO_Vendedores: string | null;
  NGO_DataCadastro: string | null;
  NGO_DataFechamento: string | null;
  vendedorNome: string;
}

export interface NegociosBIFetchOptions {
  /** ISO YYYY-MM-DD — filtra ngo_data_fechamento >= from (exclui negocios sem fechamento) */
  from?: string;
  /** ISO YYYY-MM-DD — filtra ngo_data_fechamento <= to */
  to?: string;
  funis?: string[];
}

const NEGOCIOS_COLUMNS = [
  "NGO_Numero",
  "NGO_Conclusao",
  "NGO_Etapa",
  "NGO_Funil",
  "NGO_VlrTotalNegociado",
  "NGO_FormaEntrada",
  "NGO_MotivoPerda",
  "NGO_MotivoGanho",
  "NGO_CicloVendas",
  "NGO_QtdAcoes",
  "NGO_Probabilidade",
  "NGO_Vendedores",
  "NGO_DataCadastro",
  "NGO_DataFechamento",
];

const MIRROR_NEGOCIOS_SELECT = [
  "ngo_numero",
  "ngo_conclusao",
  "ngo_etapa",
  "ngo_funil",
  "ngo_vlr_total_negociado",
  "ngo_forma_entrada",
  "ngo_motivo_perda",
  "ngo_motivo_ganho",
  "ngo_ciclo_vendas",
  "ngo_qtd_acoes",
  "ngo_probabilidade",
  "ngo_vendedores",
  "ngo_data_cadastro",
  "ngo_data_fechamento",
].join(",");

interface UsuarioRow {
  USR_CodUsuario: string | number | null;
  USR_idUsuario: string | number | null;
  USR_nomeUsuario: string | null;
}

interface MirrorUsuarioRow {
  usr_cod_usuario: string | number | null;
  usr_id_usuario: string | number | null;
  usr_nome_usuario: string | null;
}

interface MirrorNegocioRow {
  ngo_numero: string;
  ngo_conclusao: string | null;
  ngo_etapa: string | null;
  ngo_funil: string | null;
  ngo_vlr_total_negociado: string | number | null;
  ngo_forma_entrada: string | null;
  ngo_motivo_perda: string | null;
  ngo_motivo_ganho: string | null;
  ngo_ciclo_vendas: string | number | null;
  ngo_qtd_acoes: string | number | null;
  ngo_probabilidade: string | number | null;
  ngo_vendedores: string | null;
  ngo_data_cadastro: string | null;
  ngo_data_fechamento: string | null;
}

function resolveVendedor(codes: string | null, map: Map<string, string>): string {
  if (!codes) return "Sem vendedor";
  const first = codes.split(/[,;]/)[0]?.trim();
  if (!first) return "Sem vendedor";
  return map.get(first) ?? `Cod ${first}`;
}

// Cache do mapa de vendedores — raramente muda, evita refetch a cada query
let vendedorMapPromise: Promise<Map<string, string>> | null = null;

async function fetchVendedorMapMirror(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("usuarios")
      .select("usr_cod_usuario,usr_id_usuario,usr_nome_usuario");
    if (error) throw new Error(error.message);
    for (const u of (data ?? []) as MirrorUsuarioRow[]) {
      const nome = u.usr_nome_usuario?.trim();
      if (!nome) continue;
      if (u.usr_cod_usuario != null) map.set(String(u.usr_cod_usuario).trim(), nome);
      if (u.usr_id_usuario != null && !map.has(String(u.usr_id_usuario).trim())) {
        map.set(String(u.usr_id_usuario).trim(), nome);
      }
    }
  } catch {
    // ignore
  }
  return map;
}

function getVendedorMapMirrorCached(): Promise<Map<string, string>> {
  if (!vendedorMapPromise) {
    vendedorMapPromise = fetchVendedorMapMirror();
  }
  return vendedorMapPromise;
}

async function fetchVendedorMapLegacy(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const usuarios = await fetchAllPages<UsuarioRow>("VW_Ceres_Usuario", [
      "USR_CodUsuario",
      "USR_idUsuario",
      "USR_nomeUsuario",
    ]);
    for (const u of usuarios) {
      const nome = u.USR_nomeUsuario?.trim();
      if (!nome) continue;
      if (u.USR_CodUsuario != null) map.set(String(u.USR_CodUsuario).trim(), nome);
      if (u.USR_idUsuario != null && !map.has(String(u.USR_idUsuario).trim())) {
        map.set(String(u.USR_idUsuario).trim(), nome);
      }
    }
  } catch {
    // ignore
  }
  return map;
}

const toNum = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

function mapMirrorRow(row: MirrorNegocioRow, vendedorMap: Map<string, string>): NegocioBIRow {
  return {
    NGO_Numero: row.ngo_numero,
    NGO_Conclusao: row.ngo_conclusao,
    NGO_Etapa: row.ngo_etapa,
    NGO_Funil: row.ngo_funil,
    NGO_VlrTotalNegociado: toNum(row.ngo_vlr_total_negociado),
    NGO_FormaEntrada: row.ngo_forma_entrada,
    NGO_MotivoPerda: row.ngo_motivo_perda,
    NGO_MotivoGanho: row.ngo_motivo_ganho,
    NGO_CicloVendas: toNum(row.ngo_ciclo_vendas),
    NGO_QtdAcoes: toNum(row.ngo_qtd_acoes),
    NGO_Probabilidade: toNum(row.ngo_probabilidade),
    NGO_Vendedores: row.ngo_vendedores,
    NGO_DataCadastro: row.ngo_data_cadastro,
    NGO_DataFechamento: row.ngo_data_fechamento,
    vendedorNome: resolveVendedor(row.ngo_vendedores, vendedorMap),
  };
}

async function fetchFromMirror(options?: NegociosBIFetchOptions): Promise<NegocioBIRow[]> {
  let q = supabase
    .schema("mirror")
    .from("crm_negocios")
    .select(MIRROR_NEGOCIOS_SELECT);
  if (options?.from) q = q.gte("ngo_data_fechamento", options.from);
  if (options?.to) q = q.lte("ngo_data_fechamento", `${options.to}T23:59:59.999`);
  if (options?.funis && options.funis.length > 0) q = q.in("ngo_funil", options.funis);
  q = q.limit(50000);

  const [negociosRes, vendedorMap] = await Promise.all([
    q,
    getVendedorMapMirrorCached(),
  ]);
  if (negociosRes.error) throw new Error(negociosRes.error.message);
  return ((negociosRes.data ?? []) as MirrorNegocioRow[]).map((row) =>
    mapMirrorRow(row, vendedorMap),
  );
}

async function fetchFromLegacy(): Promise<NegocioBIRow[]> {
  const [rows, vendedorMap] = await Promise.all([
    fetchAllPages<Omit<NegocioBIRow, "vendedorNome">>(
      "VW_Ceres_CRM_Negocios",
      NEGOCIOS_COLUMNS,
    ),
    fetchVendedorMapLegacy(),
  ]);
  return rows.map((r) => ({
    ...r,
    vendedorNome: resolveVendedor(r.NGO_Vendedores, vendedorMap),
  }));
}

export async function fetchNegociosBI(options?: NegociosBIFetchOptions): Promise<NegocioBIRow[]> {
  if (USE_MIRROR.crm_negocios) {
    try {
      return await fetchFromMirror(options);
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
