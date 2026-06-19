/* ============================================================
   Ceres BI — Supabase client init
   Anon key é pública (read-only via RLS).
   ============================================================ */

(function () {
  const SUPABASE_URL = "https://ceressupabasebi.vouxconsultoria.com.br";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.yXg8zkCdBRNXAPyONyI0GuX77HnQWed9Rnh_R0idFg4";

  if (typeof supabase === "undefined") {
    console.warn("[Ceres BI] Supabase CDN não carregado. Usando mock data.");
    window.ceresDB = null;
    return;
  }

  window.ceresDB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /** Busca todas as páginas de uma tabela no schema mirror. */
  window.fetchAllMirror = async function (table, columns, limit = 1000) {
    if (!window.ceresDB) return [];
    const all = [];
    let from = 0;
    while (true) {
      const sel = (columns && columns.length) ? columns.join(",") : "*";
      const { data, error } = await window.ceresDB
        .schema("mirror")
        .from(table)
        .select(sel)
        .range(from, from + limit - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < limit) break;
      from += limit;
    }
    return all;
  };
})();
