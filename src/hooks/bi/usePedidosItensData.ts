import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPedidosItemBI, type PedidoItemRow } from "@/services/bi/pedidosItemBIService";

interface ItemDatum {
  name: string;
  valor: number;
  qtd: number;
}

export interface PedidosItensAgg {
  porGrupo: ItemDatum[];
  porMarca: ItemDatum[];
}

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);

export function aggregatePedidosItens(rows: PedidoItemRow[]): PedidosItensAgg {
  const grupoMap = new Map<string, ItemDatum>();
  const marcaMap = new Map<string, ItemDatum>();

  for (const r of rows) {
    const qtd = num(r.PDO_ItemQtde) || 1;
    const valor = num(r.PDO_ItemVlrUnitario) * qtd;

    const grupo = (r.PDO_ItemGrupo || "Sem grupo").trim() || "Sem grupo";
    const g = grupoMap.get(grupo) ?? { name: grupo, valor: 0, qtd: 0 };
    g.valor += valor;
    g.qtd += qtd;
    grupoMap.set(grupo, g);

    const marca = (r.PDO_ItemMarca || "Sem marca").trim() || "Sem marca";
    const m = marcaMap.get(marca) ?? { name: marca, valor: 0, qtd: 0 };
    m.valor += valor;
    m.qtd += qtd;
    marcaMap.set(marca, m);
  }

  const top = (map: Map<string, ItemDatum>) =>
    Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 10);

  return { porGrupo: top(grupoMap), porMarca: top(marcaMap) };
}

export function usePedidosItensData(enabled: boolean) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bi-pedidos-itens"],
    queryFn: fetchPedidosItemBI,
    staleTime: 60_000,
    enabled,
  });

  const agg = useMemo(() => aggregatePedidosItens(rows), [rows]);

  return { agg, isLoading };
}
