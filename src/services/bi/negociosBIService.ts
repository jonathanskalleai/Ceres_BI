import { fetchAllPages } from "@/services/sqlServerApi";

/**
 * Linha de negocio do CRM com as colunas de negocio ricas de VW_Ceres_CRM_Negocios.
 * Diferente do tipo legado, este expoe origem do lead, motivos de perda/ganho,
 * ciclo de vendas, esforco (qtd acoes) e probabilidade — o "ouro" da view.
 *
 * ATENCAO: a view e denormalizada por produto; ~10% dos NGO_Numero aparecem em
 * multiplas linhas com o mesmo NGO_VlrTotalNegociado. Toda agregacao em nivel de
 * negocio DEVE deduplicar por NGO_Numero (ver aggregateNegociosBI).
 */
export interface NegocioBIRow {
  NGO_Numero: string;
  NGO_Conclusao: string | null;
  NGO_Etapa: string | null;
  NGO_Funil: string | null;
  NGO_VlrTotalNegociado: number | null;
  NGO_FormaEntrada: string | null;
  NGO_MotivoPerda: string | null;
  NGO_MotivoGanho: string | null;
  NGO_CicloVendas: number | null;
  NGO_QtdAcoes: number | null;
  NGO_Probabilidade: number | null;
  NGO_Vendedores: string | null;
  NGO_DataCadastro: string | null;
  NGO_DataFechamento: string | null;
  /** Nome do vendedor resolvido via VW_Ceres_Usuario (NGO_Vendedores e um codigo). */
  vendedorNome: string;
}

const NEGOCIOS_COLUMNS = [
  "NGO_Numero",
  "NGO_Conclusao",
  "NGO_Etapa",
  "NGO_Funil",
  "NGO_VlrTotalNegociado",
  "NGO_FormaEntrada",
  "NGO_MotivoPerda",
  "NGO_MotivoGanho",
  "NGO_CicloVendas",
  "NGO_QtdAcoes",
  "NGO_Probabilidade",
  "NGO_Vendedores",
  "NGO_DataCadastro",
  "NGO_DataFechamento",
];

interface UsuarioRow {
  USR_CodUsuario: string | number | null;
  USR_idUsuario: string | number | null;
  USR_nomeUsuario: string | null;
}

/**
 * Constroi mapa codigo->nome a partir de VW_Ceres_Usuario.
 * NGO_Vendedores costuma casar com USR_CodUsuario; usamos USR_idUsuario como fallback.
 */
async function fetchVendedorMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const usuarios = await fetchAllPages<UsuarioRow>("VW_Ceres_Usuario", [
      "USR_CodUsuario",
      "USR_idUsuario",
      "USR_nomeUsuario",
    ]);
    for (const u of usuarios) {
      const nome = u.USR_nomeUsuario?.trim();
      if (!nome) continue;
      if (u.USR_CodUsuario != null) map.set(String(u.USR_CodUsuario).trim(), nome);
      if (u.USR_idUsuario != null && !map.has(String(u.USR_idUsuario).trim())) {
        map.set(String(u.USR_idUsuario).trim(), nome);
      }
    }
  } catch {
    // sem mapa, resolveVendedor cai no fallback "Cod N"
  }
  return map;
}

/** Resolve um codigo (ou lista separada por virgula/ponto-virgula) para nome legivel. */
function resolveVendedor(codes: string | null, map: Map<string, string>): string {
  if (!codes) return "Sem vendedor";
  const first = codes.split(/[,;]/)[0]?.trim();
  if (!first) return "Sem vendedor";
  return map.get(first) ?? `Cod ${first}`;
}

export async function fetchNegociosBI(): Promise<NegocioBIRow[]> {
  try {
    const [rows, vendedorMap] = await Promise.all([
      fetchAllPages<Omit<NegocioBIRow, "vendedorNome">>(
        "VW_Ceres_CRM_Negocios",
        NEGOCIOS_COLUMNS,
      ),
      fetchVendedorMap(),
    ]);
    return rows.map((r) => ({
      ...r,
      vendedorNome: resolveVendedor(r.NGO_Vendedores, vendedorMap),
    }));
  } catch {
    return [];
  }
}
