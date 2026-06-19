import { supabase } from "@/integrations/supabase/client";
import type { NegocioRow } from "@/hooks/useNegociosData";

interface MirrorNegocio {
  ngo_numero: string;
  ngo_conclusao: string | null;
  ngo_etapa: string | null;
  ngo_funil: string | null;
  ngo_vlr_total_negociado: number | null;
  ngo_forma_entrada: string | null;
  ngo_motivo_perda: string | null;
  ngo_motivo_ganho: string | null;
  ngo_ciclo_vendas: number | null;
  ngo_qtd_acoes: number | null;
  ngo_probabilidade: number | null;
  ngo_vendedores: string | null;
  ngo_data_cadastro: string | null;
  ngo_data_fechamento: string | null;
  cli_nome: string | null;
  cli_cidade: string | null;
  emp_cidade: string | null;
  emp_uf: string | null;
  prd_condicao_produto: string | null;
  usa_valor: number | null;
  ngo_obs_negocio: string | null;
}

interface MirrorPedido {
  ngo_numero: string;
  pdo_situacao: string | null;
  pdo_vlr_pedido: number | null;
  pdo_vlr_financiado: number | null;
  pdo_vlr_recurso_proprio: number | null;
  pdo_cidade_uf_entrega: string | null;
  pdo_vendedor: string | null;
  pdo_dth_pedido: string | null;
}

interface MirrorUsuario {
  usr_cod_usuario: string | null;
  usr_id_usuario: string | null;
  usr_nome_usuario: string | null;
}

export interface NegociosMensaisFetchOptions {
  /** ISO YYYY-MM-DD */
  from?: string;
  /** ISO YYYY-MM-DD */
  to?: string;
}

const MIRROR_NEGOCIOS_COLS = [
  "ngo_numero",
  "ngo_conclusao",
  "ngo_etapa",
  "ngo_funil",
  "ngo_vlr_total_negociado",
  "ngo_forma_entrada",
  "ngo_motivo_perda",
  "ngo_motivo_ganho",
  "ngo_ciclo_vendas",
  "ngo_qtd_acoes",
  "ngo_probabilidade",
  "ngo_vendedores",
  "ngo_data_cadastro",
  "ngo_data_fechamento",
  "cli_nome",
  "cli_cidade",
  "emp_cidade",
  "emp_uf",
  "prd_condicao_produto",
  "usa_valor",
  "ngo_obs_negocio",
].join(",");

const MIRROR_PEDIDOS_COLS = [
  "ngo_numero",
  "pdo_situacao",
  "pdo_vlr_pedido",
  "pdo_vlr_financiado",
  "pdo_vlr_recurso_proprio",
  "pdo_cidade_uf_entrega",
  "pdo_vendedor",
  "pdo_dth_pedido",
].join(",");

async function getUsuariosMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("usuarios")
    .select("usr_cod_usuario,usr_id_usuario,usr_nome_usuario");
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const u of (data ?? []) as MirrorUsuario[]) {
    const nome = u.usr_nome_usuario?.trim();
    if (!nome) continue;
    if (u.usr_cod_usuario != null) map.set(String(u.usr_cod_usuario).trim(), nome);
    if (u.usr_id_usuario != null) map.set(String(u.usr_id_usuario).trim(), nome);
  }
  return map;
}

export async function fetchNegociosMensais(
  options?: NegociosMensaisFetchOptions,
): Promise<NegocioRow[]> {
  let negociosQ = supabase.schema("mirror").from("crm_negocios").select(MIRROR_NEGOCIOS_COLS);
  let pedidosQ = supabase.schema("mirror").from("crm_pedidos").select(MIRROR_PEDIDOS_COLS);

  if (options?.from) {
    negociosQ = negociosQ.gte("ngo_data_cadastro", options.from);
    pedidosQ = pedidosQ.gte("pdo_dth_pedido", options.from);
  }
  if (options?.to) {
    const toEnd = `${options.to}T23:59:59.999`;
    negociosQ = negociosQ.lte("ngo_data_cadastro", toEnd);
    pedidosQ = pedidosQ.lte("pdo_dth_pedido", toEnd);
  }

  negociosQ = negociosQ.limit(50000);
  pedidosQ = pedidosQ.limit(50000);

  const [negociosRes, pedidosRes, usuariosMap] = await Promise.all([
    negociosQ,
    pedidosQ,
    getUsuariosMap(),
  ]);

  if (negociosRes.error) throw new Error(negociosRes.error.message);
  if (pedidosRes.error) throw new Error(pedidosRes.error.message);

  const negocios = (negociosRes.data ?? []) as MirrorNegocio[];
  const pedidos = (pedidosRes.data ?? []) as MirrorPedido[];

  const pedidoMap = new Map<string, MirrorPedido>();
  for (const p of pedidos) {
    if (p.ngo_numero) {
      pedidoMap.set(p.ngo_numero, p);
    }
  }

  return negocios.map((n) => {
    const pedido = pedidoMap.get(n.ngo_numero);
    const vendedorNome = usuariosMap.get(String(n.ngo_vendedores ?? "").trim()) || "";
    const valorPedido = pedido?.pdo_vlr_pedido ?? n.ngo_vlr_total_negociado ?? 0;
    const recebido = pedido?.pdo_vlr_recurso_proprio ?? 0;

    return {
      tipo: n.prd_condicao_produto || "",
      recebido: Number(recebido) || 0,
      unidade: pedido?.pdo_cidade_uf_entrega || `${n.emp_cidade || ""}/${n.emp_uf || ""}`,
      cliente: n.cli_nome || "",
      consultor: vendedorNome || pedido?.pdo_vendedor || "",
      valor_pedido: Number(valorPedido) || 0,
      pdo_situacao_pedido: pedido?.pdo_situacao || "",
      ngo_etapa: n.ngo_etapa || "",
      ngo_conclusao: n.ngo_conclusao || "",
      ngo_motivo_ganho: n.ngo_motivo_ganho || "",
      pdo_dth_abertura: n.ngo_data_cadastro?.slice(0, 10) || "",
      pdo_cidade_entrega: pedido?.pdo_cidade_uf_entrega || n.cli_cidade || "",
      pdo_obs_pedido: n.ngo_obs_negocio || "",
      cod_consultor: String(n.ngo_vendedores || ""),
      pdo_vlr_recurso_proprio: Number(pedido?.pdo_vlr_recurso_proprio) || 0,
      usado: Number(n.usa_valor) || 0,
    };
  });
}
