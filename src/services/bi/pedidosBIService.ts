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

export async function fetchPedidosBI(): Promise<PedidoRow[]> {
  try {
    return await fetchAllPages<PedidoRow>("VW_Ceres_CRM_Pedidos", PEDIDOS_COLUMNS);
  } catch {
    return [];
  }
}
