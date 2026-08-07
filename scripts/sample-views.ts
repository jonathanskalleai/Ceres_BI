// Coleta sample de 10 linhas + count de cada view do SQL Server via edge function.
// Saída: docs/analise-views/raw/<view>.json
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const VIEWS = [
  "VW_Ceres_Empresas",
  "VW_Ceres_Usuario",
  "VW_Ceres_UsuarioXEmpresa",
  "VW_Ceres_CRM_Acoes",
  "VW_Ceres_CRM_CarteiraClientes",
  "VW_Ceres_CRM_ClienteContatos",
  "VW_Ceres_CRM_ClienteParqueMaquinas",
  "VW_Ceres_CRM_ClientePropriedade",
  "VW_Ceres_CRM_Negocios",
  "VW_Ceres_CRM_Negocios_Etapas",
  "VW_Ceres_CRM_FunilEtapa",
  "VW_Ceres_CRM_Pedidos",
  "VW_Ceres_CRM_PedidosItem",
  "VW_Ceres_CRM_PedidosUsado",
  "VW_Ceres_CRM_EstoqueVirtual",
  "VW_Ceres_CRM_TAGXACAO",
  "VW_Ceres_CRM_TAGXCLIENTE",
  "VW_Ceres_CRM_TAGXNEGOCIO",
  "VW_Ceres_CRM_TAGXPEDIDO",
  "VW_Ceres_Produtos",
  "VW_Ceres_ProdutosGrupo",
  "VW_Ceres_ProdutosMarca",
  "VW_Ceres_ProdutosModelo",
  "VW_Ceres_Agenda",
  "VW_Ceres_OrdemServico",
  "VW_Ceres_Ocorrencias",
  "VW_Ceres_AtendimentoOS",
  "VW_Ceres_AtividadeExtra",
  "VW_Ceres_TecnicoTempo",
];

const outDir = join(process.cwd(), "docs/analise-views/raw");
mkdirSync(outDir, { recursive: true });

async function call(body: Record<string, unknown>) {
  const r = await fetch(`${URL}/functions/v1/query-sqlserver`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { error: text, status: r.status }; }
}

function inferType(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "decimal";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "datetime";
    if (/^-?\d+\.\d+$/.test(v)) return "decimal-str";
    if (/^-?\d+$/.test(v)) return "int-str";
    return "string";
  }
  return typeof v;
}

const summary: any[] = [];

for (const view of VIEWS) {
  process.stdout.write(`→ ${view} ... `);
  try {
    const cnt = await call({ view, count_only: true });
    const sample = await call({ view, limit: 10 });
    const rows = sample?.data ?? [];
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const colTypes: Record<string, Set<string>> = {};
    for (const r of rows) for (const c of cols) (colTypes[c] ||= new Set()).add(inferType((r as any)[c]));
    const typed = cols.map(c => ({ name: c, types: [...colTypes[c]] }));
    const out = { view, total: cnt?.total ?? null, error: cnt?.error || sample?.error || null, columns: typed, sample: rows };
    writeFileSync(join(outDir, `${view}.json`), JSON.stringify(out, null, 2));
    summary.push({ view, total: out.total, cols: cols.length, error: out.error });
    console.log(`ok (total=${out.total}, cols=${cols.length})`);
  } catch (e: any) {
    console.log(`ERR ${e.message}`);
    summary.push({ view, error: e.message });
  }
}

writeFileSync(join(outDir, "_summary.json"), JSON.stringify(summary, null, 2));
console.log("\nDONE");
