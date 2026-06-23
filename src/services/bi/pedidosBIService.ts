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
  pdo_situacao_pedido: string | null;
  pdo_vlr_pedido: number | null;
  pdo_vlr_financiado: number | null;
  pdo_vlr_recurso_proprio: number | null;
  pdo_cidade_uf_entrega: string | null;
  pdo_vendedor: string | null;
  pdo_dth_pedido: string | null;
  pdo_financiamento_banco: string | null;
}

const MIRROR_PEDIDOS_SELECT = [
  "ngo_numero",
  "pdo_situacao_pedido",
  "pdo_vlr_pedido",
  "pdo_vlr_financiado",
  "pdo_vlr_recurso_proprio",
  "pdo_cidade_uf_entrega",
  "pdo_vendedor",
  "pdo_dth_pedido",
  "pdo_financiamento_banco",
].join(",");

function mapMirrorRow(row: MirrorPedidoRow): PedidoRow {
  return {
    NGO_Numero: row.ngo_numero,
    PDO_SituacaoPedido: row.pdo_situacao_pedido ?? "",
    PDO_VlrPedido: row.pdo_vlr_pedido,
    PDO_VlrFinanciado: row.pdo_vlr_financiado,
    PDO_VlrRecursoProprio: row.pdo_vlr_recurso_proprio,
    PDO_CidadeUFEntrega: row.pdo_cidade_uf_entrega ?? "",
    PDO_Vendedor: row.pdo_vendedor ?? "",
    PDO_DthPedido: row.pdo_dth_pedido,
    PDO_FinanciamentoBanco: row.pdo_financiamento_banco?.trim() ?? "",
  };
}

export async function fetchPedidosBI(options?: PedidosBIFetchOptions): Promise<PedidoRow[]> {
  try {
    let q = supabase.schema("mirror").from("crm_pedidos").select(MIRROR_PEDIDOS_SELECT);
    if (options?.from) q = q.gte("pdo_dth_pedido", options.from);
    if (options?.to) q = q.lte("pdo_dth_pedido", `${options.to}T23:59:59.999`);
    q = q.limit(50000);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorPedidoRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
