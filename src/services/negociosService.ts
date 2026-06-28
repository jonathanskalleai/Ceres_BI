import { supabase } from "@/integrations/supabase/client";
import type { NegocioRow } from "@/types/negociosSummary";

interface MirrorNegocio {
  ngo_numero: string;
  ngo_conclusao: string | null;
  ngo_etapa: string | null;
  ngo_funil: string | null;
  ngo_vlrtotalnegociado: number | null;
  ngo_formaentrada: string | null;
  ngo_motivoperda: string | null;
  ngo_motivoganho: string | null;
  ngo_ciclovendas: number | null;
  ngo_qtdacoes: number | null;
  ngo_probabilidade: number | null;
  ngo_vendedores: string | null;
  ngo_datacadastro: string | null;
  ngo_datafechamento: string | null;
  cli_nome: string | null;
  cli_cidade: string | null;
  emp_cidade: string | null;
  emp_uf: string | null;
  prd_condicaoproduto: string | null;
  usa_valor: number | null;
  ngo_obsnegocio: string | null;
}

interface MirrorPedido {
  ngo_numero: string;
  pdo_situacaopedido: string | null;
  pdo_vlrpedido: number | null;
  pdo_vlrfinanciado: number | null;
  pdo_vlrrecursoproprio: number | null;
  pdo_cidadeufentrega: string | null;
  pdo_vendedor: string | null;
  pdo_dthpedido: string | null;
}

interface MirrorUsuario {
  usr_codusuario: string | null;
  usr_idusuario: string | null;
  usr_nomeusuario: string | null;
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
  "ngo_vlrtotalnegociado",
  "ngo_formaentrada",
  "ngo_motivoperda",
  "ngo_motivoganho",
  "ngo_ciclovendas",
  "ngo_qtdacoes",
  "ngo_probabilidade",
  "ngo_vendedores",
  "ngo_datacadastro",
  "ngo_datafechamento",
  "cli_nome",
  "cli_cidade",
  "emp_cidade",
  "emp_uf",
  "prd_condicaoproduto",
  "usa_valor",
  "ngo_obsnegocio",
].join(",");

const MIRROR_PEDIDOS_COLS = [
  "ngo_numero",
  "pdo_situacaopedido",
  "pdo_vlrpedido",
  "pdo_vlrfinanciado",
  "pdo_vlrrecursoproprio",
  "pdo_cidadeufentrega",
  "pdo_vendedor",
  "pdo_dthpedido",
].join(",");

async function getUsuariosMap(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("usuarios")
      .select("usr_codusuario,usr_idusuario,usr_nomeusuario");
    if (error) throw new Error(error.message);
    const map = new Map<string, string>();
    for (const u of (data ?? []) as MirrorUsuario[]) {
      const nome = u.usr_nomeusuario?.trim();
      if (!nome) continue;
      if (u.usr_codusuario != null) map.set(String(u.usr_codusuario).trim(), nome);
      if (u.usr_idusuario != null) map.set(String(u.usr_idusuario).trim(), nome);
    }
    return map;
  } catch (err) {
    throw new Error(`[negociosService.getUsuariosMap] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function fetchNegociosMensais(
  options?: NegociosMensaisFetchOptions,
): Promise<NegocioRow[]> {
  try {
    let negociosQ = supabase.schema("mirror").from("crm_negocios").select(MIRROR_NEGOCIOS_COLS);
    let pedidosQ = supabase.schema("mirror").from("crm_pedidos").select(MIRROR_PEDIDOS_COLS);

    if (options?.from) {
      negociosQ = negociosQ.gte("ngo_datacadastro", options.from);
      pedidosQ = pedidosQ.gte("pdo_dthpedido", options.from);
    }
    if (options?.to) {
      const toEnd = `${options.to}T23:59:59.999`;
      negociosQ = negociosQ.lte("ngo_datacadastro", toEnd);
      pedidosQ = pedidosQ.lte("pdo_dthpedido", toEnd);
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
      const valorPedido = pedido?.pdo_vlrpedido ?? n.ngo_vlrtotalnegociado ?? 0;
      const recebido = pedido?.pdo_vlrrecursoproprio ?? 0;

      return {
        tipo: n.prd_condicaoproduto || "",
        recebido: Number(recebido) || 0,
        unidade: pedido?.pdo_cidadeufentrega || `${n.emp_cidade || ""}/${n.emp_uf || ""}`,
        cliente: n.cli_nome || "",
        consultor: vendedorNome || pedido?.pdo_vendedor || "",
        valor_pedido: Number(valorPedido) || 0,
        pdo_situacao_pedido: pedido?.pdo_situacaopedido || "",
        ngo_etapa: n.ngo_etapa || "",
        ngo_conclusao: n.ngo_conclusao || "",
        ngo_motivo_ganho: n.ngo_motivoganho || "",
        pdo_dth_abertura: n.ngo_datacadastro?.slice(0, 10) || "",
        pdo_cidade_entrega: pedido?.pdo_cidadeufentrega || n.cli_cidade || "",
        pdo_obs_pedido: n.ngo_obsnegocio || "",
        cod_consultor: String(n.ngo_vendedores || ""),
        pdo_vlr_recurso_proprio: Number(pedido?.pdo_vlrrecursoproprio) || 0,
        usado: Number(n.usa_valor) || 0,
      };
    });
  } catch (err) {
    throw new Error(`[negociosService.fetchNegociosMensais] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
