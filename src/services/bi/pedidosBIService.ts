import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

export interface PedidoRow {
  NGO_Numero: string;
  PDO_SituacaoPedido: string;
  PDO_VlrPedido: number | null;
  PDO_VlrFinanciado: number | null;
  PDO_VlrRecursoProprio: number | null;
  PDO_CidadeUFEntrega: string;
  PDO_Vendedor: string;
  PDO_DthPedido: string | null;
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
}

const PEDIDOS_COLUMNS = [
  "NGO_Numero",
  "PDO_SituacaoPedido",
  "PDO_VlrPedido",
  "PDO_VlrFinanciado",
  "PDO_VlrRecursoProprio",
  "PDO_CidadeUFEntrega",
  "PDO_Vendedor",
  "PDO_DthPedido",
];

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
  };
}

async function fetchFromMirror(): Promise<PedidoRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_pedidos")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorPedidoRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<PedidoRow[]> {
  return await fetchAllPages<PedidoRow>("VW_Ceres_CRM_Pedidos", PEDIDOS_COLUMNS);
}

export async function fetchPedidosBI(): Promise<PedidoRow[]> {
  if (USE_MIRROR.crm_pedidos) {
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
