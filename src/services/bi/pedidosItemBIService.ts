import { fetchAllPages } from "@/services/sqlServerApi";

/** Itens dos pedidos (VW_Ceres_CRM_PedidosItem) — o que de fato e vendido. */
export interface PedidoItemRow {
  PDO_ItemGrupo: string | null;
  PDO_ItemMarca: string | null;
  PDO_ItemModelo: string | null;
  PDO_ItemQtde: number | null;
  PDO_ItemVlrUnitario: number | null;
}

const ITEM_COLUMNS = [
  "PDO_ItemGrupo",
  "PDO_ItemMarca",
  "PDO_ItemModelo",
  "PDO_ItemQtde",
  "PDO_ItemVlrUnitario",
];

export async function fetchPedidosItemBI(): Promise<PedidoItemRow[]> {
  try {
    return await fetchAllPages<PedidoItemRow>("VW_Ceres_CRM_PedidosItem", ITEM_COLUMNS);
  } catch {
    return [];
  }
}
