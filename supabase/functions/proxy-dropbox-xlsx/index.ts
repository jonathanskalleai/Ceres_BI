import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DROPBOX_URL =
  "https://www.dropbox.com/scl/fi/zq394xgehbfoigr3ewmuo/RELATORIO-CAMPOS-DEALER-POR-DATA-DE-ABERTURA.xlsx?rlkey=dk1npgs8jpz04ujtyupsp2h3j&dl=1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cacheBustUrl = `${DROPBOX_URL}&t=${Date.now()}`;
    console.log("Downloading XLSX from Dropbox...");

    const res = await fetch(cacheBustUrl, {
      headers: { "Cache-Control": "no-cache, no-store" },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Dropbox download failed: ${res.status}`);
    }

    const bytes = await res.arrayBuffer();
    console.log(`Downloaded ${bytes.byteLength} bytes`);

    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch (error) {
    console.error("Proxy error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
