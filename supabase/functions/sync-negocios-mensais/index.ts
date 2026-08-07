import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";

const DROPBOX_URL =
  "https://www.dropbox.com/scl/fi/m1ojkjdsraijq5uv428fy/NEG-CIOS-MENSAIS.xlsx?rlkey=aivdhhuch01r9jxsixag732y5&dl=1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COL_MAP: Record<string, string> = {
  "Tipo": "tipo",
  "Recebido": "recebido",
  "Usado": "usado",
  "EMP_Nome": "emp_nome",
  "Unidade": "unidade",
  "CLIENTE": "cliente",
  "Relação": "relacao",
  "CLI_TipoCliente": "cli_tipo_cliente",
  "CLI_CNPJ_CPF": "cli_cnpj_cpf",
  "PDO_NroPedido": "pdo_nro_pedido",
  "PDO_SituacaoPedido": "pdo_situacao_pedido",
  "PDO_Status": "pdo_status",
  "NGO_Numero": "ngo_numero",
  "NGO_Funil": "ngo_funil",
  "NGO_Etapa": "ngo_etapa",
  "NGO_Conclusão": "ngo_conclusao",
  "NGO_Motivo_Ganho": "ngo_motivo_ganho",
  "Consultor": "consultor",
  "Valor do Pedido": "valor_pedido",
  "PDO_ObsPedido": "pdo_obs_pedido",
  "PDO_Aprovador": "pdo_aprovador",
  "PDO_DthAprovacao": "pdo_dth_aprovacao",
  "PDO_Motivo_Cancelamento": "pdo_motivo_cancelamento",
  "PDO_Frete": "pdo_frete",
  "PDO_CidadeEntrega": "pdo_cidade_entrega",
  "PDO_CidadeUFFaturamento": "pdo_cidade_uf_faturamento",
  "PDO_FiananciamentoBanco": "pdo_financiamento_banco",
  "PDO_VlrRecursoProprio": "pdo_vlr_recurso_proprio",
  "PDO_VlrFinanciado": "pdo_vlr_financiado",
  "PDO_dthAbertura": "pdo_dth_abertura",
  "PDO_DthRegistro": "pdo_dth_registro",
  "NGO_DthAbertura": "ngo_dth_abertura",
  "NGO_Atualização": "ngo_atualizacao",
  "Cod Consultor": "cod_consultor",
  "Etiqueta": "etiqueta",
};

const DATE_COLS = new Set(["pdo_dth_aprovacao", "pdo_dth_abertura", "pdo_dth_registro", "ngo_dth_abertura", "ngo_atualizacao"]);
const NUM_COLS = new Set(["recebido", "usado", "valor_pedido", "pdo_vlr_recurso_proprio", "pdo_vlr_financiado"]);

function parseNumeric(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim();
  // Remove currency symbols, spaces, dots as thousand separators
  s = s.replace(/[R$\s]/g, "");
  // Handle Brazilian format: 1.234,56 → 1234.56
  if (/\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    return new Date((v - 25569) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

async function syncData() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const cacheBustUrl = `${DROPBOX_URL}&t=${Date.now()}`;
  console.log("Downloading Negócios Mensais XLSX from Dropbox (cache bust)...");
  const res = await fetch(cacheBustUrl, { headers: { "Cache-Control": "no-cache, no-store" } });
  if (!res.ok) throw new Error(`Dropbox fetch failed: ${res.status}`);

  const buf = await res.arrayBuffer();
  console.log(`Downloaded ${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`);

  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets["NEGÓCIOS MENSAIS"];
  if (!ws) throw new Error("Sheet 'NEGÓCIOS MENSAIS' not found. Available: " + wb.SheetNames.join(", "));

  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);
  console.log(`Parsed ${raw.length} rows from NEGÓCIOS MENSAIS`);
  if (raw.length > 0) {
    console.log("Excel headers:", Object.keys(raw[0]).join(" | "));
  }
  // Build a trimmed-key lookup so headers with spaces like " Valor do Pedido " match
  const rows = raw.map((r) => {
    const trimmed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      trimmed[k.trim()] = v;
    }
    const out: Record<string, unknown> = {};
    for (const [xlCol, dbCol] of Object.entries(COL_MAP)) {
      let val = trimmed[xlCol] ?? null;
      if (DATE_COLS.has(dbCol)) val = excelDateToISO(val);
      if (NUM_COLS.has(dbCol)) val = parseNumeric(val);
      if (typeof val === "string") val = val.trim() || null;
      out[dbCol] = val;
    }
    return out;
  });

  console.log("Clearing existing negocios_mensais data...");
  const { error: delError } = await supabase
    .from("negocios_mensais")
    .delete()
    .gte("created_at", "1970-01-01");
  if (delError) console.error("Delete error:", delError.message);

  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("negocios_mensais").insert(batch);
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`Sync complete: ${inserted}/${rows.length} rows inserted`);
  return { inserted, total: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const promise = syncData();
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(promise.catch((e) => console.error("Sync failed:", e.message)));
      return new Response(
        JSON.stringify({ status: "started", message: "Sincronização Negócios Mensais iniciada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await promise;
    return new Response(JSON.stringify({ status: "complete", ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
