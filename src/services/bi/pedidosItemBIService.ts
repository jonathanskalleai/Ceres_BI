import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

/** Itens dos pedidos (VW_Ceres_CRM_PedidosItem) — o que de fato e vendido. */
export interface PedidoItemRow {
  PDO_ItemGrupo: string | null;
  PDO_ItemMarca: string | null;
  PDO_ItemModelo: string | null;
  PDO_ItemQtde: number | null;
  PDO_ItemVlrUnitario: number | null;
}

interface MirrorPedidoItemRow {
  pdo_item_grupo: string | null;
  pdo_item_marca: string | null;
  pdo_item_modelo: string | null;
  pdo_item_qtde: number | null;
  pdo_item_vlr_unitario: number | null;
}

const ITEM_COLUMNS = [
  "PDO_ItemGrupo",
  "PDO_ItemMarca",
  "PDO_ItemModelo",
  "PDO_ItemQtde",
  "PDO_ItemVlrUnitario",
];

function mapMirrorRow(row: MirrorPedidoItemRow): PedidoItemRow {
  return {
    PDO_ItemGrupo: row.pdo_item_grupo,
    PDO_ItemMarca: row.pdo_item_marca,
    PDO_ItemModelo: row.pdo_item_modelo,
    PDO_ItemQtde: row.pdo_item_qtde,
    PDO_ItemVlrUnitario: row.pdo_item_vlr_unitario,
  };
}

async function fetchFromMirror(): Promise<PedidoItemRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_pedidos_item")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorPedidoItemRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<PedidoItemRow[]> {
  return await fetchAllPages<PedidoItemRow>("VW_Ceres_CRM_PedidosItem", ITEM_COLUMNS);
}

export async function fetchPedidosItemBI(): Promise<PedidoItemRow[]> {
  if (USE_MIRROR.crm_pedidos_item) {
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
