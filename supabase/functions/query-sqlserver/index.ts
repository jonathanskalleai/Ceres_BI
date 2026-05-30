import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getConfig() {
  const server = Deno.env.get("SQLSERVER_HOST");
  const database = Deno.env.get("SQLSERVER_DATABASE");
  const user = Deno.env.get("SQLSERVER_USER");
  const password = Deno.env.get("SQLSERVER_PASSWORD");
  const port = Number(Deno.env.get("SQLSERVER_PORT") || "1433");

  if (!server || !database || !user || !password) {
    throw new Error("Credenciais SQL Server não configuradas nos secrets");
  }
  return { server, port, database, user, password };
}

const allowedViews = new Set([
  "VW_Ceres_Empresas", "VW_Ceres_Usuario", "VW_Ceres_UsuarioXEmpresa",
  "VW_Ceres_CRM_Acoes", "VW_Ceres_CRM_CarteiraClientes",
  "VW_Ceres_CRM_ClienteContatos", "VW_Ceres_CRM_ClienteParqueMaquinas",
  "VW_Ceres_CRM_ClientePropriedade", "VW_Ceres_CRM_Negocios",
  "VW_Ceres_CRM_Negocios_Etapas", "VW_Ceres_CRM_FunilEtapa",
  "VW_Ceres_CRM_Pedidos", "VW_Ceres_CRM_PedidosItem",
  "VW_Ceres_CRM_PedidosUsado", "VW_Ceres_CRM_EstoqueVirtual",
  "VW_Ceres_CRM_TAGXACAO", "VW_Ceres_CRM_TAGXCLIENTE",
  "VW_Ceres_CRM_TAGXNEGOCIO", "VW_Ceres_CRM_TAGXPEDIDO",
  "VW_Ceres_Produtos", "VW_Ceres_ProdutosGrupo",
  "VW_Ceres_ProdutosMarca", "VW_Ceres_ProdutosModelo",
  "VW_Ceres_Agenda", "VW_Ceres_OrdemServico",
  "VW_Ceres_Ocorrencias", "VW_Ceres_AtendimentoOS",
  "VW_Ceres_AtividadeExtra", "VW_Ceres_TecnicoTempo",
]);

interface AdvancedFilter {
  column: string;
  operator: "=" | ">=" | "<=" | "BETWEEN" | "LIKE" | "IN";
  value: string | string[];
}

const ALLOWED_OPERATORS = new Set(["=", ">=", "<=", "BETWEEN", "LIKE", "IN"]);

function sanitizeColumn(col: string): string {
  return col.replace(/[^a-zA-Z0-9_]/g, "");
}

function escapeValue(val: string): string {
  return String(val).replace(/'/g, "''");
}

function buildAdvancedCondition(filter: AdvancedFilter): string | null {
  const safeCol = sanitizeColumn(filter.column);
  if (!safeCol) return null;

  const op = filter.operator;
  if (!ALLOWED_OPERATORS.has(op)) return null;

  switch (op) {
    case "=":
    case ">=":
    case "<=":
    case "LIKE": {
      if (Array.isArray(filter.value)) return null;
      return `[${safeCol}] ${op} '${escapeValue(filter.value)}'`;
    }
    case "BETWEEN": {
      if (!Array.isArray(filter.value) || filter.value.length !== 2) return null;
      const [start, end] = filter.value;
      return `[${safeCol}] BETWEEN '${escapeValue(start)}' AND '${escapeValue(end)}'`;
    }
    case "IN": {
      if (!Array.isArray(filter.value) || filter.value.length === 0) return null;
      const list = filter.value.map((v) => `'${escapeValue(v)}'`).join(", ");
      return `[${safeCol}] IN (${list})`;
    }
    default:
      return null;
  }
}

function buildQuery(params: {
  view: string;
  columns?: string[];
  filters?: Record<string, string>;
  advancedFilters?: AdvancedFilter[];
  limit?: number;
  offset?: number;
  count_only?: boolean;
}): string {
  const { view, columns, filters, advancedFilters, limit, offset, count_only } = params;

  const conditions: string[] = [];

  if (filters && Object.keys(filters).length > 0) {
    for (const key of Object.keys(filters)) {
      const safeKey = sanitizeColumn(key);
      conditions.push(`[${safeKey}] = '${escapeValue(String(filters[key]))}'`);
    }
  }

  if (advancedFilters && advancedFilters.length > 0) {
    for (const filter of advancedFilters) {
      const condition = buildAdvancedCondition(filter);
      if (condition) {
        conditions.push(condition);
      }
    }
  }

  const whereClause = conditions.length > 0
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  if (count_only) {
    return `SELECT COUNT(*) as total FROM [${view}]${whereClause}`;
  }

  const selectClause = columns && columns.length > 0
    ? columns.map((c) => `[${c.replace(/[^a-zA-Z0-9_]/g, "")}]`).join(", ")
    : "*";

  if (limit && limit < 50000) {
    const safeOffset = offset || 0;
    return `SELECT ${selectClause} FROM [${view}]${whereClause} ORDER BY (SELECT NULL) OFFSET ${safeOffset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }

  return `SELECT ${selectClause} FROM [${view}]${whereClause}`;
}

async function execQuery(sql: string): Promise<Record<string, unknown>[]> {
  const { Connection, Request } = await import("npm:tedious@19");
  const config = getConfig();

  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];

    const connection = new Connection({
      server: config.server,
      authentication: {
        type: "default",
        options: { userName: config.user, password: config.password },
      },
      options: {
        database: config.database,
        port: config.port,
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 30000,
        requestTimeout: 120000,
        rowCollectionOnRequestCompletion: true,
      },
    });

    connection.on("connect", (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      const request = new Request(sql, (err: Error | null, _rowCount: number, resultRows: any[]) => {
        connection.close();
        if (err) {
          reject(err);
          return;
        }
        // Convert tedious rows to plain objects
        const data = resultRows.map((columns: any[]) => {
          const row: Record<string, unknown> = {};
          for (const col of columns) {
            row[col.metadata.colName] = col.value;
          }
          return row;
        });
        resolve(data);
      });

      connection.execSql(request);
    });

    connection.connect();
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { view, columns, filters, advancedFilters, limit, offset, count_only } = body;

    if (!view) {
      return new Response(
        JSON.stringify({ error: "Parâmetro 'view' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!allowedViews.has(view)) {
      return new Response(
        JSON.stringify({ error: `View "${view}" não permitida` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sql = buildQuery({ view, columns, filters, advancedFilters, limit, offset, count_only });
    const rows = await execQuery(sql);

    if (count_only) {
      return new Response(
        JSON.stringify({ data: [], count: 0, total: rows[0]?.total || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data: rows, count: rows.length, total: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("query-sqlserver error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
