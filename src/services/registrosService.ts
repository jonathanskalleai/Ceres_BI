import { fetchAllPages } from "./sqlServerApi";
import type { Registro } from "@/types/comercial";

interface AcaoRow {
  EMP_Cidade: string;
  CLI_Nome: string;
  ACO_TipoContato: string;
  ACO_TipoAcao: string;
  ACO_Vendedor: string;
  ACO_AtividadeExecutada: string;
  ACO_Lat: number | null;
  ACO_Lon: number | null;
  ACO_DthConclusao: string | null;
}

const ACOES_COLUMNS = [
  "EMP_Cidade",
  "CLI_Nome",
  "ACO_TipoContato",
  "ACO_TipoAcao",
  "ACO_Vendedor",
  "ACO_AtividadeExecutada",
  "ACO_Lat",
  "ACO_Lon",
  "ACO_DthConclusao",
];

export async function fetchRegistrosComerciais(): Promise<Registro[]> {
  const acoes = await fetchAllPages<AcaoRow>("VW_Ceres_CRM_Acoes", ACOES_COLUMNS);

  return acoes.map((r) => ({
    cliente: r.CLI_Nome || "",
    cidade: r.EMP_Cidade || "",
    vendedor: r.ACO_Vendedor || "",
    tipoContato: r.ACO_TipoContato || "",
    tipoAcao: r.ACO_TipoAcao || "",
    negocioValor: 0,
    negocioEtapa: "",
    dtConclusao: r.ACO_DthConclusao?.slice(0, 10) || "",
    obs: r.ACO_AtividadeExecutada || "",
    lat: r.ACO_Lat || undefined,
    lng: r.ACO_Lon || undefined,
  }));
}
