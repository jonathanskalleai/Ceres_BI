import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

/**
 * Linha de negocio do CRM com as colunas de negocio ricas de VW_Ceres_CRM_Negocios.
 * Diferente do tipo legado, este expoe origem do lead, motivos de perda/ganho,
 * ciclo de vendas, esforco (qtd acoes) e probabilidade — o "ouro" da view.
 *
 * ATENCAO: a view e denormalizada por produto; ~10% dos NGO_Numero aparecem em
 * multiplas linhas com o mesmo NGO_VlrTotalNegociado. Toda agregacao em nivel de
 * negocio DEVE deduplicar por NGO_Numero (ver aggregateNegociosBI).
 * Quando USE_MIRROR=true, a dedup ja foi feita na ingestao (PK por ngo_numero).
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
  /** Nome do vendedor resolvido via VW_Ceres_Usuario (NGO_Vendedores e um codigo). */
  vendedorNome: string;
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
  ngo_vlr_total: number | null;
  ngo_forma_entrada: string | null;
  ngo_motivo_perda: string | null;
  ngo_motivo_ganho: string | null;
  ngo_ciclo_vendas: number | null;
  ngo_qtd_acoes: number | null;
  ngo_probabilidade: number | null;
  ngo_vendedores: string | null;
  ngo_data_cadastro: string | null;
  ngo_data_fechamento: string | null;
}

/** Resolve um codigo (ou lista separada por virgula/ponto-virgula) para nome legivel. */
function resolveVendedor(codes: string | null, map: Map<string, string>): string {
  if (!codes) return "Sem vendedor";
  const first = codes.split(/[,;]/)[0]?.trim();
  if (!first) return "Sem vendedor";
  return map.get(first) ?? `Cod ${first}`;
}

/**
 * Constroi mapa codigo->nome a partir de mirror.usuarios (PostgREST).
 */
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
    // sem mapa, resolveVendedor cai no fallback "Cod N"
  }
  return map;
}

/**
 * Constroi mapa codigo->nome a partir de VW_Ceres_Usuario (legado).
 */
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
    // sem mapa, resolveVendedor cai no fallback "Cod N"
  }
  return map;
}

function mapMirrorRow(row: MirrorNegocioRow, vendedorMap: Map<string, string>): NegocioBIRow {
  return {
    NGO_Numero: row.ngo_numero,
    NGO_Conclusao: row.ngo_conclusao,
    NGO_Etapa: row.ngo_etapa,
    NGO_Funil: row.ngo_funil,
    NGO_VlrTotalNegociado: row.ngo_vlr_total,
    NGO_FormaEntrada: row.ngo_forma_entrada,
    NGO_MotivoPerda: row.ngo_motivo_perda,
    NGO_MotivoGanho: row.ngo_motivo_ganho,
    NGO_CicloVendas: row.ngo_ciclo_vendas,
    NGO_QtdAcoes: row.ngo_qtd_acoes,
    NGO_Probabilidade: row.ngo_probabilidade,
    NGO_Vendedores: row.ngo_vendedores,
    NGO_DataCadastro: row.ngo_data_cadastro,
    NGO_DataFechamento: row.ngo_data_fechamento,
    vendedorNome: resolveVendedor(row.ngo_vendedores, vendedorMap),
  };
}

async function fetchFromMirror(): Promise<NegocioBIRow[]> {
  const [negociosRes, vendedorMap] = await Promise.all([
    supabase.schema("mirror").from("crm_negocios").select("*"),
    fetchVendedorMapMirror(),
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

export async function fetchNegociosBI(): Promise<NegocioBIRow[]> {
  if (USE_MIRROR.crm_negocios) {
    try {
      return await fetchFromMirror();
    } catch {
      // Fallback para legado se mirror falhar
      return await fetchFromLegacy();
    }
  }
  try {
    return await fetchFromLegacy();
  } catch {
    return [];
  }
}
