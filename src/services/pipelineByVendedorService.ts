import { supabase } from "@/integrations/supabase/client";

/**
 * Busca dados de pipeline/conversao de negocios agrupados por vendedor (nome resolvido).
 * Fonte: mirror.crm_negocios + mirror.usuarios.
 *
 * Retorna um mapa vendedorNome -> metricas de pipeline para enriquecer
 * o Dashboard Comercial (useComercialData) que so tem dados de acoes.
 */

export interface VendedorPipeline {
  pipeline: number; // R$ total em negocios "Em andamento"
  negocios: number; // total de negocios (todos os status)
  ganhos: number; // negocios com conclusao "Ganho"
  perdidos: number; // negocios com conclusao "Perdido"
  conversao: number; // % ganhos / (ganhos + perdidos), 0 se nenhum concluido
}

interface MirrorNegocioSlim {
  ngo_conclusao: string | null;
  ngo_vlr_total: number | null;
  ngo_vendedores: string | null;
}

interface MirrorUsuarioSlim {
  usr_cod_usuario: string | null;
  usr_id_usuario: string | null;
  usr_nome_usuario: string | null;
}

function classifyConclusao(c: string | null): "ganho" | "perdido" | "andamento" {
  const lower = (c ?? "").toLowerCase();
  if (lower.includes("ganho")) return "ganho";
  if (lower.includes("perd")) return "perdido";
  return "andamento";
}

export async function fetchPipelineByVendedor(funis?: string[]): Promise<Map<string, VendedorPipeline>> {
  let negociosQuery = supabase
    .schema("mirror")
    .from("crm_negocios")
    .select("ngo_conclusao,ngo_vlr_total,ngo_vendedores,ngo_funil");

  if (funis && funis.length > 0) {
    negociosQuery = negociosQuery.in("ngo_funil", funis);
  }

  const [negociosRes, usuariosRes] = await Promise.all([
    negociosQuery,
    supabase
      .schema("mirror")
      .from("usuarios")
      .select("usr_cod_usuario,usr_id_usuario,usr_nome_usuario"),
  ]);

  if (negociosRes.error) throw new Error(negociosRes.error.message);
  if (usuariosRes.error) throw new Error(usuariosRes.error.message);

  // Build code -> nome map
  const codeToName = new Map<string, string>();
  for (const u of (usuariosRes.data ?? []) as MirrorUsuarioSlim[]) {
    const nome = u.usr_nome_usuario?.trim();
    if (!nome) continue;
    if (u.usr_cod_usuario != null) codeToName.set(String(u.usr_cod_usuario).trim(), nome);
    if (u.usr_id_usuario != null && !codeToName.has(String(u.usr_id_usuario).trim())) {
      codeToName.set(String(u.usr_id_usuario).trim(), nome);
    }
  }

  // Aggregate by vendedor name
  const result = new Map<string, VendedorPipeline>();

  for (const row of (negociosRes.data ?? []) as MirrorNegocioSlim[]) {
    // Resolve vendedor code to name (take first code if comma/semicolon separated)
    const codes = row.ngo_vendedores;
    if (!codes) continue;
    const firstCode = codes.split(/[,;]/)[0]?.trim();
    if (!firstCode) continue;
    const vendedorNome = codeToName.get(firstCode);
    if (!vendedorNome) continue;

    if (!result.has(vendedorNome)) {
      result.set(vendedorNome, { pipeline: 0, negocios: 0, ganhos: 0, perdidos: 0, conversao: 0 });
    }
    const v = result.get(vendedorNome)!;
    const status = classifyConclusao(row.ngo_conclusao);
    const valor = typeof row.ngo_vlr_total === "number" && isFinite(row.ngo_vlr_total) ? row.ngo_vlr_total : 0;

    v.negocios++;
    if (status === "ganho") {
      v.ganhos++;
    } else if (status === "perdido") {
      v.perdidos++;
    } else {
      v.pipeline += valor;
    }
  }

  // Compute conversao %
  for (const v of result.values()) {
    const concluidos = v.ganhos + v.perdidos;
    v.conversao = concluidos > 0 ? Math.round((v.ganhos / concluidos) * 100) : 0;
  }

  return result;
}
