import { supabase } from "@/integrations/supabase/client";

/** Itens dos pedidos (VW_Ceres_CRM_PedidosItem) — o que de fato e vendido. */
export interface PedidoItemRow {
  PDO_ItemGrupo: string | null;
  PDO_ItemMarca: string | null;
  PDO_ItemModelo: string | null;
  PDO_ItemQtde: number | null;
  PDO_ItemVlrUnitario: number | null;
}

interface MirrorPedidoItemRow {
  pdo_itemgrupo: string | null;
  pdo_itemmarca: string | null;
  pdo_itemmodelo: string | null;
  pdo_itemqtde: number | null;
  pdo_itemvlrunitario: number | null;
}

const MIRROR_PEDIDO_ITEM_SELECT = [
  "pdo_itemgrupo",
  "pdo_itemmarca",
  "pdo_itemmodelo",
  "pdo_itemqtde",
  "pdo_itemvlrunitario",
].join(",");

function mapMirrorRow(row: MirrorPedidoItemRow): PedidoItemRow {
  return {
    PDO_ItemGrupo: row.pdo_itemgrupo,
    PDO_ItemMarca: row.pdo_itemmarca,
    PDO_ItemModelo: row.pdo_itemmodelo,
    PDO_ItemQtde: row.pdo_itemqtde,
    PDO_ItemVlrUnitario: row.pdo_itemvlrunitario,
  };
}

export async function fetchPedidosItemBI(): Promise<PedidoItemRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("crm_pedidos_item")
      .select(MIRROR_PEDIDO_ITEM_SELECT);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorPedidoItemRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
