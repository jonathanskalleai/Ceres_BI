import { supabase } from "@/integrations/supabase/client";
import { querySqlServer } from "@/services/sqlServerApi";

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

interface MirrorCarteiraRow {
  cli_idcliente: string | number | null;
  cli_tipocliente: string | null;
  cli_prospect: string | null;
  cli_uf: string | null;
  cli_cidade: string | null;
  usr_nomeusuario: string | null;
}

function mapMirrorRow(row: MirrorCarteiraRow): CarteiraRow {
  return {
    CLI_idCliente: row.cli_idcliente,
    CLI_TipoCliente: row.cli_tipocliente,
    CLI_Prospect: row.cli_prospect,
    CLI_UF: row.cli_uf,
    CLI_Cidade: row.cli_cidade,
    USR_NomeUsuario: row.usr_nomeusuario,
  };
}

export async function fetchCarteira(): Promise<CarteiraRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("crm_carteira_clientes")
      .select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorCarteiraRow[]).map(mapMirrorRow);
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
