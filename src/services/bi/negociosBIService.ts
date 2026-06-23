import { supabase } from "@/integrations/supabase/client";

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

const MIRROR_NEGOCIOS_SELECT = [
  "ngo_numero",
  "ngo_conclusao",
  "ngo_etapa",
  "ngo_funil",
  "ngo_vlrtotalnegociado",
  "ngo_formaentrada",
  "ngo_motivoperda",
  "ngo_motivoganho",
  "ngo_ciclovendas",
  "ngo_qtdacoes",
  "ngo_probabilidade",
  "ngo_vendedores",
  "ngo_datacadastro",
  "ngo_datafechamento",
].join(",");

interface MirrorUsuarioRow {
  usr_codusuario: string | number | null;
  usr_idusuario: string | number | null;
  usr_nomeusuario: string | null;
}

interface MirrorNegocioRow {
  ngo_numero: string;
  ngo_conclusao: string | null;
  ngo_etapa: string | null;
  ngo_funil: string | null;
  ngo_vlrtotalnegociado: string | number | null;
  ngo_formaentrada: string | null;
  ngo_motivoperda: string | null;
  ngo_motivoganho: string | null;
  ngo_ciclovendas: string | number | null;
  ngo_qtdacoes: string | number | null;
  ngo_probabilidade: string | number | null;
  ngo_vendedores: string | null;
  ngo_datacadastro: string | null;
  ngo_datafechamento: string | null;
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
      .select("usr_codusuario,usr_idusuario,usr_nomeusuario");
    if (error) throw new Error(error.message);
    for (const u of (data ?? []) as MirrorUsuarioRow[]) {
      const nome = u.usr_nomeusuario?.trim();
      if (!nome) continue;
      if (u.usr_codusuario != null) map.set(String(u.usr_codusuario).trim(), nome);
      if (u.usr_idusuario != null && !map.has(String(u.usr_idusuario).trim())) {
        map.set(String(u.usr_idusuario).trim(), nome);
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
    NGO_VlrTotalNegociado: toNum(row.ngo_vlrtotalnegociado),
    NGO_FormaEntrada: row.ngo_formaentrada,
    NGO_MotivoPerda: row.ngo_motivoperda,
    NGO_MotivoGanho: row.ngo_motivoganho,
    NGO_CicloVendas: toNum(row.ngo_ciclovendas),
    NGO_QtdAcoes: toNum(row.ngo_qtdacoes),
    NGO_Probabilidade: toNum(row.ngo_probabilidade),
    NGO_Vendedores: row.ngo_vendedores,
    NGO_DataCadastro: row.ngo_datacadastro,
    NGO_DataFechamento: row.ngo_datafechamento,
    vendedorNome: resolveVendedor(row.ngo_vendedores, vendedorMap),
  };
}

export async function fetchNegociosBI(options?: NegociosBIFetchOptions): Promise<NegocioBIRow[]> {
  try {
    let q = supabase
      .schema("mirror")
      .from("crm_negocios")
      .select(MIRROR_NEGOCIOS_SELECT);
    // Date filtering removed from server-side: ngo_data_fechamento is NULL for
    // open deals (andamento), so .gte()/.lte() silently excludes them.
    // Filtering by date is handled client-side in the aggregation hooks.
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
  } catch {
    return [];
  }
}
