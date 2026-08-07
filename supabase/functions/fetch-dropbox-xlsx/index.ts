import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import * as XLSX from "npm:xlsx@0.18.5/xlsx.mjs";

const DROPBOX_URL =
  "https://www.dropbox.com/scl/fi/zq394xgehbfoigr3ewmuo/RELATORIO-CAMPOS-DEALER-POR-DATA-DE-ABERTURA.xlsx?rlkey=dk1npgs8jpz04ujtyupsp2h3j&dl=1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COL_MAP: Record<string, string> = {
  "Cliente Nome": "cliente_nome",
  "Cidade Cliente": "cidade_cliente",
  Vendedor: "vendedor",
  "Tipo Contato": "tipo_contato",
  "Tipo Ação": "tipo_acao",
  "Negócio Valor": "negocio_valor",
  "Negócio Etapa": "negocio_etapa",
  "Dt Conclusão": "dt_conclusao",
  "Obs. Final": "obs_final",
  Latitude: "latitude",
  Longitude: "longitude",
  "Nro Negócio": "nro_negocio",
  Status: "status",
};

function excelDateToISO(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const d = new Date((v - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return String(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cacheBustUrl = `${DROPBOX_URL}&t=${Date.now()}`;
    const res = await fetch(cacheBustUrl, { headers: { "Cache-Control": "no-cache, no-store" } });
    if (!res.ok) throw new Error(`Dropbox fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

    const rows = raw.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [xlCol, dbCol] of Object.entries(COL_MAP)) {
        let val = r[xlCol] ?? null;
        if (dbCol === "dt_conclusao") val = excelDateToISO(val);
        if (dbCol === "negocio_valor") val = val != null ? Number(val) || 0 : 0;
        if (dbCol === "latitude" || dbCol === "longitude")
          val = val != null ? Number(val) || null : null;
        out[dbCol] = val;
      }
      return out;
    });

    return new Response(JSON.stringify(rows), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
