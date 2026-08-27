import { supabase } from "@/integrations/supabase/client";

export interface PedidoEsteiraItem {
  codigoInterno: string;
  numeroPedido: string;
  cliente: string;
  consultor: string;
  cidade: string;
  valor: number;
  data: string;
  situacao: "Aguardando Aprovação" | "Aguardando Assinatura Cliente";
  conclusaoNegocio?: string;
}

export interface PedidosEsteiraData {
  aguardandoAprovacao: {
    qtd: number;
    valor: number;
  };
  aguardandoAssinatura: {
    qtd: number;
    valor: number;
  };
  totalEsteira: {
    qtd: number;
    valor: number;
  };
  pedidos: PedidoEsteiraItem[];
}

export const EMPTY_PEDIDOS_ESTEIRA: PedidosEsteiraData = {
  aguardandoAprovacao: { qtd: 0, valor: 0 },
  aguardandoAssinatura: { qtd: 0, valor: 0 },
  totalEsteira: { qtd: 0, valor: 0 },
  pedidos: [],
};

export interface FetchPedidosEsteiraOptions {
  from?: string | null;
  to?: string | null;
  ano?: number | null;
  vendedor?: string | null;
  cidade?: string | null;
}

export async function fetchPedidosEsteira(
  options: FetchPedidosEsteiraOptions = {}
): Promise<PedidosEsteiraData> {
  const params: Record<string, unknown> = {};
  if (options.from) params.p_from = options.from;
  if (options.to) params.p_to = options.to;
  if (options.ano) params.p_ano = options.ano;
  if (options.vendedor) params.p_vendedor = options.vendedor;
  if (options.cidade) params.p_cidade = options.cidade;

  const { data, error } = await supabase.rpc("rpc_pedidos_pendentes_esteira", params);
  if (error) {
    console.error("Erro ao buscar esteira de pedidos pendentes:", error);
    throw error;
  }
  if (!data) return EMPTY_PEDIDOS_ESTEIRA;

  return data as PedidosEsteiraData;
}
