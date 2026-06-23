import { supabase } from "@/integrations/supabase/client";

export interface PedidoRow {
  NGO_Numero: string;
  PDO_SituacaoPedido: string;
  PDO_VlrPedido: number | null;
  PDO_VlrFinanciado: number | null;
  PDO_VlrRecursoProprio: number | null;
  PDO_CidadeUFEntrega: string;
  PDO_Vendedor: string;
  PDO_DthPedido: string | null;
  PDO_FinanciamentoBanco: string;
}

export interface PedidosBIFetchOptions {
  from?: string;
  to?: string;
}

interface MirrorPedidoRow {
  ngo_numero: string;
  pdo_situacaopedido: string | null;
  pdo_vlrpedido: number | null;
  pdo_vlrfinanciado: number | null;
  pdo_vlrrecursoproprio: number | null;
  pdo_cidadeufentrega: string | null;
  pdo_vendedor: string | null;
  pdo_dthpedido: string | null;
  pdo_financiamentobanco: string | null;
}

const MIRROR_PEDIDOS_SELECT = [
  "ngo_numero",
  "pdo_situacaopedido",
  "pdo_vlrpedido",
  "pdo_vlrfinanciado",
  "pdo_vlrrecursoproprio",
  "pdo_cidadeufentrega",
  "pdo_vendedor",
  "pdo_dthpedido",
  "pdo_financiamentobanco",
].join(",");

function mapMirrorRow(row: MirrorPedidoRow): PedidoRow {
  return {
    NGO_Numero: row.ngo_numero,
    PDO_SituacaoPedido: row.pdo_situacaopedido ?? "",
    PDO_VlrPedido: row.pdo_vlrpedido,
    PDO_VlrFinanciado: row.pdo_vlrfinanciado,
    PDO_VlrRecursoProprio: row.pdo_vlrrecursoproprio,
    PDO_CidadeUFEntrega: row.pdo_cidadeufentrega ?? "",
    PDO_Vendedor: row.pdo_vendedor ?? "",
    PDO_DthPedido: row.pdo_dthpedido,
    PDO_FinanciamentoBanco: row.pdo_financiamentobanco?.trim() ?? "",
  };
}

export async function fetchPedidosBI(options?: PedidosBIFetchOptions): Promise<PedidoRow[]> {
  try {
    let q = supabase.schema("mirror").from("crm_pedidos").select(MIRROR_PEDIDOS_SELECT);
    if (options?.from) q = q.gte("pdo_dthpedido", options.from);
    if (options?.to) q = q.lte("pdo_dthpedido", `${options.to}T23:59:59.999`);
    q = q.limit(50000);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorPedidoRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
