import { fetchAllPages } from "./sqlServerApi";
import type { NegocioRow } from "@/hooks/useNegociosData";

interface NegocioSqlRow {
  EMP_Cidade: string;
  EMP_UF: string;
  NGO_Numero: string;
  NGO_VlrTotalNegociado: number | null;
  NGO_Etapa: string;
  NGO_Conclusao: string;
  NGO_MotivoGanho: string;
  NGO_DataCadastro: string | null;
  CLI_Nome: string;
  CLI_Cidade: string;
  NGO_Vendedores: string;
  PRD_CondicaoProduto: string;
  USA_Valor: number | null;
  NGO_ObsNegocio: string;
}

interface PedidoSqlRow {
  NGO_Numero: string;
  PDO_SituacaoPedido: string;
  PDO_VlrPedido: number | null;
  PDO_ObsPedido: string;
  PDO_CidadeUFEntrega: string;
  PDO_Vendedor: string;
  PDO_VlrRecursoProprio: number | null;
}

interface UsuarioRow {
  USR_CodUsuario: string;
  USR_nomeUsuario: string;
  USR_idUsuario: number;
}

const NEGOCIOS_COLUMNS = [
  "EMP_Cidade", "EMP_UF", "NGO_Numero", "NGO_VlrTotalNegociado",
  "NGO_Etapa", "NGO_Conclusao", "NGO_MotivoGanho", "NGO_DataCadastro",
  "CLI_Nome", "CLI_Cidade", "NGO_Vendedores", "PRD_CondicaoProduto",
  "USA_Valor", "NGO_ObsNegocio",
];

const PEDIDOS_COLUMNS = [
  "NGO_Numero", "PDO_SituacaoPedido", "PDO_VlrPedido",
  "PDO_ObsPedido", "PDO_CidadeUFEntrega", "PDO_Vendedor", "PDO_VlrRecursoProprio",
];

const USUARIOS_COLUMNS = ["USR_CodUsuario", "USR_nomeUsuario", "USR_idUsuario"];

let usuariosCache: Map<string, string> | null = null;

async function getUsuariosMap(): Promise<Map<string, string>> {
  if (usuariosCache) return usuariosCache;
  const usuarios = await fetchAllPages<UsuarioRow>("VW_Ceres_Usuario", USUARIOS_COLUMNS);
  const map = new Map<string, string>();
  for (const u of usuarios) {
    if (u.USR_CodUsuario) {
      map.set(String(u.USR_CodUsuario), u.USR_nomeUsuario);
    }
    map.set(String(u.USR_idUsuario), u.USR_nomeUsuario);
  }
  usuariosCache = map;
  return map;
}

export async function fetchNegociosMensais(): Promise<NegocioRow[]> {
  const [negocios, pedidos, usuariosMap] = await Promise.all([
    fetchAllPages<NegocioSqlRow>("VW_Ceres_CRM_Negocios", NEGOCIOS_COLUMNS),
    fetchAllPages<PedidoSqlRow>("VW_Ceres_CRM_Pedidos", PEDIDOS_COLUMNS),
    getUsuariosMap(),
  ]);

  const pedidoMap = new Map<string, PedidoSqlRow>();
  for (const p of pedidos) {
    if (p.NGO_Numero) {
      pedidoMap.set(p.NGO_Numero, p);
    }
  }

  return negocios.map((n) => {
    const pedido = pedidoMap.get(n.NGO_Numero);
    const vendedorNome = usuariosMap.get(String(n.NGO_Vendedores)) || "";
    const valorPedido = pedido?.PDO_VlrPedido || n.NGO_VlrTotalNegociado || 0;
    const recebido = pedido?.PDO_VlrRecursoProprio || 0;

    return {
      tipo: n.PRD_CondicaoProduto || "",
      recebido: Number(recebido) || 0,
      unidade: `${n.EMP_Cidade || ""}/${n.EMP_UF || ""}`,
      cliente: n.CLI_Nome || "",
      consultor: vendedorNome || pedido?.PDO_Vendedor || "",
      valor_pedido: Number(valorPedido) || 0,
      pdo_situacao_pedido: pedido?.PDO_SituacaoPedido || "",
      ngo_etapa: n.NGO_Etapa || "",
      ngo_conclusao: n.NGO_Conclusao || "",
      ngo_motivo_ganho: n.NGO_MotivoGanho || "",
      pdo_dth_abertura: n.NGO_DataCadastro?.slice(0, 10) || "",
      pdo_cidade_entrega: pedido?.PDO_CidadeUFEntrega || n.CLI_Cidade || "",
      pdo_obs_pedido: pedido?.PDO_ObsPedido || n.NGO_ObsNegocio || "",
      cod_consultor: String(n.NGO_Vendedores || ""),
      pdo_vlr_recurso_proprio: Number(pedido?.PDO_VlrRecursoProprio) || 0,
      usado: Number(n.USA_Valor) || 0,
    };
  });
}
