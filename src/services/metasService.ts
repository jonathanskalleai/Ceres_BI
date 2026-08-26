import { supabase } from "@/integrations/supabase/client";
import type {
  ConfiguracaoMetas,
  MetaConsultorAnual,
  MetaCurvaMensal,
} from "@/types/equipeDesempenho";

interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface MetaQuery<T> {
  select(columns: string): MetaQuery<T>;
  eq(column: string, value: unknown): MetaQuery<T>;
  order(column: string): Promise<QueryResult<T[]>>;
  maybeSingle(): Promise<QueryResult<T>>;
  single(): Promise<QueryResult<T>>;
}

interface MetaDatabaseClient {
  from(table: string): MetaQuery<unknown>;
  schema(name: string): { from(table: string): MetaQuery<unknown> };
  rpc(name: string, params: Record<string, unknown>): Promise<QueryResult<unknown>>;
}

interface MetaAnualRow { meta_anual: number | string | null }
interface CurvaMensalRow { mes: number | string; percentual: number | string }
interface ConsultorAnualRow { consultor: string; meta_anual: number | string }
interface UsuarioRow { usr_nomeusuario: string | null }

const db = supabase as unknown as MetaDatabaseClient;

export const CURVA_MENSAL_PADRAO: MetaCurvaMensal[] = [
  { mes: 1, percentual: 10 },
  { mes: 2, percentual: 14 },
  { mes: 3, percentual: 14 },
  { mes: 4, percentual: 15 },
  { mes: 5, percentual: 12 },
  { mes: 6, percentual: 5 },
  { mes: 7, percentual: 5 },
  { mes: 8, percentual: 5 },
  { mes: 9, percentual: 5 },
  { mes: 10, percentual: 5 },
  { mes: 11, percentual: 5 },
  { mes: 12, percentual: 5 },
];

const META_ANUAL_PADRAO = 33_000_000;

export async function fetchMetaAnual(ano: number): Promise<number> {
  try {
    const result = await (db
      .from("metas_comerciais")
      .select("meta_anual")
      .eq("ano", ano)
      .single() as Promise<QueryResult<MetaAnualRow>>);
    const { data, error } = result;
    if (error || !data) return META_ANUAL_PADRAO;
    return Number(data.meta_anual);
  } catch (err) {
    throw new Error(`[metasService.fetchMetaAnual] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

export async function fetchConfiguracaoMetas(
  ano: number,
  consultores: string[],
): Promise<ConfiguracaoMetas> {
  const [{ data: metaData, error: metaError }, { data: curvaData, error: curvaError }, { data: consultoresData, error: consultoresError }, { data: usuariosData, error: usuariosError }] = await Promise.all([
    db.from("metas_comerciais").select("meta_anual").eq("ano", ano).maybeSingle() as Promise<QueryResult<MetaAnualRow>>,
    db.from("metas_comerciais_mensais").select("mes, percentual").eq("ano", ano).order("mes") as Promise<QueryResult<CurvaMensalRow[]>>,
    db.from("metas_consultor_anual").select("consultor, meta_anual").eq("ano", ano).order("consultor") as Promise<QueryResult<ConsultorAnualRow[]>>,
    db.schema("mirror").from("usuarios").select("usr_nomeusuario, usr_tipousuario").eq("usr_tipousuario", "V").order("usr_nomeusuario") as Promise<QueryResult<UsuarioRow[]>>,
  ]);

  if (metaError) {
    throw new Error(`[metasService.fetchConfiguracaoMetas] ${metaError.message}`);
  }
  if (curvaError) {
    throw new Error(`[metasService.fetchConfiguracaoMetas] ${curvaError.message}`);
  }
  if (consultoresError) {
    throw new Error(`[metasService.fetchConfiguracaoMetas] ${consultoresError.message}`);
  }
  if (usuariosError) {
    throw new Error(`[metasService.fetchConfiguracaoMetas] ${usuariosError.message}`);
  }

  const curvaMensal = curvaData?.length === 12
    ? curvaData.map((item) => ({ mes: Number(item.mes), percentual: Number(item.percentual) }))
    : CURVA_MENSAL_PADRAO;
  const valores = new Map(
    (consultoresData ?? []).map((item) => [String(item.consultor), Number(item.meta_anual)]),
  );
  const nomesCadastrados = (usuariosData ?? [])
    .map((item) => String(item.usr_nomeusuario ?? "").trim())
    .filter(Boolean);
  const todosConsultores = Array.from(new Set([...nomesCadastrados, ...consultores]))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const metasConsultores: MetaConsultorAnual[] = todosConsultores.map((consultor) => ({
    consultor,
    metaAnual: valores.get(consultor) ?? 0,
  }));

  return {
    ano,
    metaAnual: Number(metaData?.meta_anual ?? META_ANUAL_PADRAO),
    curvaMensal,
    consultores: metasConsultores,
  };
}

export interface SalvarConfiguracaoMetasInput {
  ano: number;
  metaAnual: number;
  curvaMensal: MetaCurvaMensal[];
  consultores: MetaConsultorAnual[];
}

export async function salvarConfiguracaoMetas(
  input: SalvarConfiguracaoMetasInput,
): Promise<void> {
  const { error } = await db.rpc("rpc_salvar_configuracao_metas", {
    p_ano: input.ano,
    p_meta_anual: input.metaAnual,
    p_curva_mensal: input.curvaMensal,
    p_consultores: input.consultores,
  });

  if (error) {
    throw new Error(`[metasService.salvarConfiguracaoMetas] ${error.message}`);
  }
}
