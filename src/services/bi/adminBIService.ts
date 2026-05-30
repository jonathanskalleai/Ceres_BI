import { fetchAllPages, querySqlServer } from "@/services/sqlServerApi";

/** Carteira de clientes (VW_Ceres_CRM_CarteiraClientes). */
export interface CarteiraRow {
  CLI_idCliente: string | number | null;
  CLI_TipoCliente: string | null;
  CLI_Prospect: string | null;
  CLI_UF: string | null;
  CLI_Cidade: string | null;
  USR_NomeUsuario: string | null;
}

export interface OrgCounts {
  empresas: number;
  usuarios: number;
}

const CARTEIRA_COLUMNS = [
  "CLI_idCliente",
  "CLI_TipoCliente",
  "CLI_Prospect",
  "CLI_UF",
  "CLI_Cidade",
  "USR_NomeUsuario",
];

export async function fetchCarteira(): Promise<CarteiraRow[]> {
  try {
    return await fetchAllPages<CarteiraRow>("VW_Ceres_CRM_CarteiraClientes", CARTEIRA_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchOrgCounts(): Promise<OrgCounts> {
  const safeTotal = async (view: string): Promise<number> => {
    try {
      const { total } = await querySqlServer({ view, count_only: true });
      return total;
    } catch {
      return 0;
    }
  };
  const [empresas, usuarios] = await Promise.all([
    safeTotal("VW_Ceres_Empresas"),
    safeTotal("VW_Ceres_Usuario"),
  ]);
  return { empresas, usuarios };
}
