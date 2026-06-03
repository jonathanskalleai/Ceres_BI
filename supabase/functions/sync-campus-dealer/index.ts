import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// =============================================================================
// CORS & Config
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getSqlServerConfig() {
  const server = Deno.env.get("SQLSERVER_HOST");
  const database = Deno.env.get("SQLSERVER_DATABASE");
  const user = Deno.env.get("SQLSERVER_USER");
  const password = Deno.env.get("SQLSERVER_PASSWORD");
  const port = Number(Deno.env.get("SQLSERVER_PORT") || "1433");

  if (!server || !database || !user || !password) {
    throw new Error("SQL Server credentials not configured in secrets");
  }
  return { server, port, database, user, password };
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, serviceKey);
}

// =============================================================================
// Types
// =============================================================================

interface ViewConfig {
  table: string;
  sqlColumns: string[];
  mapRow: (row: Record<string, unknown>) => Record<string, unknown>;
  strategy: "full" | "incremental";
  watermarkCol?: string;
  conflictKey?: string;
}

interface SyncResult {
  view: string;
  status: "success" | "error";
  rows: number;
  duration_ms: number;
  error?: string;
}

// =============================================================================
// View Configuration Map
// =============================================================================

const VIEW_CONFIG: Record<string, ViewConfig> = {
  "VW_Ceres_CRM_Negocios": {
    table: "crm_negocios",
    sqlColumns: [
      "NGO_Numero", "NGO_Conclusao", "NGO_Etapa", "NGO_Funil",
      "NGO_VlrTotalNegociado", "NGO_FormaEntrada", "NGO_MotivoPerda",
      "NGO_MotivoGanho", "NGO_CicloVendas", "NGO_QtdAcoes",
      "NGO_Probabilidade", "NGO_Vendedores", "NGO_DataCadastro",
      "NGO_DataFechamento",
    ],
    mapRow: (r) => ({
      ngo_numero: r.NGO_Numero,
      ngo_conclusao: r.NGO_Conclusao,
      ngo_etapa: r.NGO_Etapa,
      ngo_funil: r.NGO_Funil,
      ngo_vlr_total: r.NGO_VlrTotalNegociado,
      ngo_forma_entrada: r.NGO_FormaEntrada,
      ngo_motivo_perda: r.NGO_MotivoPerda,
      ngo_motivo_ganho: r.NGO_MotivoGanho,
      ngo_ciclo_vendas: r.NGO_CicloVendas,
      ngo_qtd_acoes: r.NGO_QtdAcoes,
      ngo_probabilidade: r.NGO_Probabilidade,
      ngo_vendedores: r.NGO_Vendedores,
      ngo_data_cadastro: r.NGO_DataCadastro,
      ngo_data_fechamento: r.NGO_DataFechamento,
    }),
    strategy: "full",
    conflictKey: "ngo_numero",
  },

  "VW_Ceres_CRM_Pedidos": {
    table: "crm_pedidos",
    sqlColumns: [
      "NGO_Numero", "PDO_SituacaoPedido", "PDO_VlrPedido",
      "PDO_VlrFinanciado", "PDO_VlrRecursoProprio",
      "PDO_CidadeUFEntrega", "PDO_Vendedor", "PDO_DthPedido",
    ],
    mapRow: (r) => ({
      ngo_numero: r.NGO_Numero,
      pdo_situacao: r.PDO_SituacaoPedido,
      pdo_vlr_pedido: r.PDO_VlrPedido,
      pdo_vlr_financiado: r.PDO_VlrFinanciado,
      pdo_vlr_recurso_proprio: r.PDO_VlrRecursoProprio,
      pdo_cidade_uf_entrega: r.PDO_CidadeUFEntrega,
      pdo_vendedor: r.PDO_Vendedor,
      pdo_dth_pedido: r.PDO_DthPedido,
    }),
    strategy: "full",
  },

  "VW_Ceres_CRM_PedidosItem": {
    table: "crm_pedidos_item",
    sqlColumns: [
      "PDO_ItemGrupo", "PDO_ItemMarca", "PDO_ItemModelo",
      "PDO_ItemQtde", "PDO_ItemVlrUnitario",
    ],
    mapRow: (r) => ({
      pdo_item_grupo: r.PDO_ItemGrupo,
      pdo_item_marca: r.PDO_ItemMarca,
      pdo_item_modelo: r.PDO_ItemModelo,
      pdo_item_qtde: r.PDO_ItemQtde,
      pdo_item_vlr_unitario: r.PDO_ItemVlrUnitario,
    }),
    strategy: "full",
  },

  "VW_Ceres_CRM_CarteiraClientes": {
    table: "crm_carteira_clientes",
    sqlColumns: [
      "CLI_idCliente", "CLI_TipoCliente", "CLI_Prospect",
      "CLI_UF", "CLI_Cidade", "USR_NomeUsuario",
    ],
    mapRow: (r) => ({
      cli_id_cliente: r.CLI_idCliente,
      cli_tipo_cliente: r.CLI_TipoCliente,
      cli_prospect: r.CLI_Prospect,
      cli_uf: r.CLI_UF,
      cli_cidade: r.CLI_Cidade,
      usr_nome_usuario: r.USR_NomeUsuario,
    }),
    strategy: "full",
    conflictKey: "cli_id_cliente",
  },

  "VW_Ceres_CRM_Acoes": {
    table: "crm_acoes",
    sqlColumns: [
      "EMP_Cidade", "CLI_Nome", "ACO_TipoContato", "ACO_TipoAcao",
      "ACO_Vendedor", "ACO_AtividadeExecutada", "ACO_Lat", "ACO_Lon",
      "ACO_DthConclusao",
    ],
    mapRow: (r) => ({
      emp_cidade: r.EMP_Cidade,
      cli_nome: r.CLI_Nome,
      aco_tipo_contato: r.ACO_TipoContato,
      aco_tipo_acao: r.ACO_TipoAcao,
      aco_vendedor: r.ACO_Vendedor,
      aco_atividade_executada: r.ACO_AtividadeExecutada,
      aco_lat: r.ACO_Lat,
      aco_lon: r.ACO_Lon,
      aco_dth_conclusao: r.ACO_DthConclusao,
    }),
    strategy: "incremental",
    watermarkCol: "ACO_DthConclusao",
  },

  "VW_Ceres_CRM_Negocios_Etapas": {
    table: "crm_funil_etapa",
    sqlColumns: [
      "NGO_Numero", "Funil_dsc", "Etapa_dscStatusNegocio", "FNE_DuracaoDias",
    ],
    mapRow: (r) => ({
      ngo_numero: r.NGO_Numero,
      funil_dsc: r.Funil_dsc,
      etapa_dsc_status: r.Etapa_dscStatusNegocio,
      fne_duracao_dias: r.FNE_DuracaoDias,
    }),
    strategy: "full",
  },

  "VW_Ceres_Usuario": {
    table: "usuarios",
    sqlColumns: ["USR_CodUsuario", "USR_idUsuario", "USR_nomeUsuario"],
    mapRow: (r) => ({
      usr_cod_usuario: r.USR_CodUsuario,
      usr_id_usuario: r.USR_idUsuario,
      usr_nome_usuario: r.USR_nomeUsuario,
    }),
    strategy: "full",
    conflictKey: "usr_cod_usuario",
  },

  "VW_Ceres_OrdemServico": {
    table: "ordens_servico",
    sqlColumns: [
      "OS_nrOS", "OS_fStatus", "SIT_dscSituacaoOS",
      "OS_dthAbertura", "OS_dthEncerramento",
    ],
    mapRow: (r) => ({
      os_nr_os: r.OS_nrOS,
      os_f_status: r.OS_fStatus,
      sit_dsc_situacao_os: r.SIT_dscSituacaoOS,
      os_dth_abertura: r.OS_dthAbertura,
      os_dth_encerramento: r.OS_dthEncerramento,
    }),
    strategy: "incremental",
    watermarkCol: "OS_dthAbertura",
    conflictKey: "os_nr_os",
  },

  "VW_Ceres_CRM_ClienteParqueMaquinas": {
    table: "cliente_parque_maquinas",
    sqlColumns: [
      "CLI_idCliente", "PQM_Grupo", "PQM_Marca",
      "PQM_Modelo", "PQM_QtdMaquinas",
    ],
    mapRow: (r) => ({
      cli_id_cliente: r.CLI_idCliente,
      pqm_grupo: r.PQM_Grupo,
      pqm_marca: r.PQM_Marca,
      pqm_modelo: r.PQM_Modelo,
      pqm_qtd_maquinas: r.PQM_QtdMaquinas,
    }),
    strategy: "full",
  },
};

const ALL_VIEWS = Object.keys(VIEW_CONFIG);
const BATCH_SIZE = 500;

// =============================================================================
// SQL Server Query Execution (reuses tedious pattern from query-sqlserver)
// =============================================================================

async function execQuery(sql: string): Promise<Record<string, unknown>[]> {
  const { Connection, Request } = await import("npm:tedious@19");
  const config = getSqlServerConfig();

  return new Promise((resolve, reject) => {
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
        requestTimeout: 240000,
        rowCollectionOnRequestCompletion: true,
      },
    });

    connection.on("connect", (err: Error | null) => {
      if (err) {
        reject(err);
        return;
      }

      const request = new Request(
        sql,
        (err: Error | null, _rowCount: number, resultRows: unknown[]) => {
          connection.close();
          if (err) {
            reject(err);
            return;
          }
          const data = (resultRows as unknown[][]).map((columns: unknown[]) => {
            const row: Record<string, unknown> = {};
            for (const col of columns as { metadata: { colName: string }; value: unknown }[]) {
              row[col.metadata.colName] = col.value;
            }
            return row;
          });
          resolve(data);
        },
      );

      connection.execSql(request);
    });

    connection.connect();
  });
}

// =============================================================================
// Sync Logic
// =============================================================================

async function syncView(
  viewName: string,
  supabase: ReturnType<typeof createClient>,
): Promise<SyncResult> {
  const config = VIEW_CONFIG[viewName];
  if (!config) {
    return { view: viewName, status: "error", rows: 0, duration_ms: 0, error: `Unknown view: ${viewName}` };
  }

  const startTime = Date.now();

  // Insert running log entry
  const { data: logEntry } = await supabase
    .schema("mirror")
    .from("sync_log")
    .insert({
      view_name: viewName,
      status: "running",
      strategy_used: config.strategy,
    })
    .select("id")
    .single();

  const logId = logEntry?.id;

  try {
    // 1. Read current watermark for incremental
    const { data: meta } = await supabase
      .schema("mirror")
      .from("sync_metadata")
      .select("last_watermark, strategy")
      .eq("view_name", viewName)
      .single();

    // 2. Build SQL query
    const colList = config.sqlColumns.map((c) => `[${c}]`).join(", ");
    let sql = `SELECT ${colList} FROM [${viewName}]`;

    if (config.strategy === "incremental" && meta?.last_watermark) {
      sql += ` WHERE [${config.watermarkCol}] > '${meta.last_watermark}'`;
    }

    // 3. Fetch from SQL Server
    const rows = await execQuery(sql);
    const mapped = rows.map(config.mapRow);

    // 4. Write to Supabase
    if (config.strategy === "full") {
      // Truncate via RPC
      await supabase.rpc("truncate_mirror_table", { table_name: `mirror.${config.table}` });

      // Batch insert
      for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
        const batch = mapped.slice(i, i + BATCH_SIZE);
        const { error } = await supabase
          .schema("mirror")
          .from(config.table)
          .insert(batch);
        if (error) {
          throw new Error(`Insert batch error on ${config.table}: ${error.message}`);
        }
      }
    } else {
      // Incremental: upsert with conflict key if available, otherwise plain insert
      for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
        const batch = mapped.slice(i, i + BATCH_SIZE);
        if (config.conflictKey) {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .upsert(batch, { onConflict: config.conflictKey });
          if (error) {
            throw new Error(`Upsert error on ${config.table}: ${error.message}`);
          }
        } else {
          const { error } = await supabase
            .schema("mirror")
            .from(config.table)
            .insert(batch);
          if (error) {
            throw new Error(`Insert error on ${config.table}: ${error.message}`);
          }
        }
      }
    }

    // 5. Compute watermark for incremental views
    let watermarkValue = meta?.last_watermark ?? null;
    if (config.strategy === "incremental" && config.watermarkCol && mapped.length > 0) {
      // Map SQL Server watermark column to PG column name
      const watermarkPgCol: Record<string, string> = {
        "ACO_DthConclusao": "aco_dth_conclusao",
        "OS_dthAbertura": "os_dth_abertura",
      };
      const pgCol = watermarkPgCol[config.watermarkCol];
      if (pgCol) {
        const lastRow = mapped[mapped.length - 1];
        if (lastRow[pgCol] != null) {
          watermarkValue = String(lastRow[pgCol]);
        }
      }
    }

    // 6. Update sync_metadata
    await supabase
      .schema("mirror")
      .from("sync_metadata")
      .update({
        last_watermark: watermarkValue,
        last_sync_at: new Date().toISOString(),
        row_count: mapped.length,
      })
      .eq("view_name", viewName);

    // 7. Update sync_log to success
    const duration = Date.now() - startTime;
    if (logId) {
      await supabase
        .schema("mirror")
        .from("sync_log")
        .update({
          status: "success",
          rows_affected: mapped.length,
          duration_ms: duration,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { view: viewName, status: "success", rows: mapped.length, duration_ms: duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errMsg = error instanceof Error ? error.message : String(error);

    // Update sync_log to error
    if (logId) {
      await supabase
        .schema("mirror")
        .from("sync_log")
        .update({
          status: "error",
          error_message: errMsg,
          duration_ms: duration,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return { view: viewName, status: "error", rows: 0, duration_ms: duration, error: errMsg };
  }
}

// =============================================================================
// HTTP Handler
// =============================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const totalStart = Date.now();

  try {
    const supabase = getSupabaseClient();

    // Parse request body
    let viewsToSync: string[] = ALL_VIEWS;
    try {
      const body = await req.json();
      if (body.views && Array.isArray(body.views) && body.views.length > 0) {
        // Validate requested views
        const invalid = body.views.filter((v: string) => !VIEW_CONFIG[v]);
        if (invalid.length > 0) {
          return new Response(
            JSON.stringify({ error: `Unknown views: ${invalid.join(", ")}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        viewsToSync = body.views;
      }
    } catch {
      // Empty body or invalid JSON — sync all views
    }

    // Process views sequentially (single SQL Server connection at a time)
    const results: SyncResult[] = [];
    for (const viewName of viewsToSync) {
      const result = await syncView(viewName, supabase);
      results.push(result);
    }

    const totalDuration = Date.now() - totalStart;

    return new Response(
      JSON.stringify({ results, total_duration_ms: totalDuration }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("sync-campus-dealer fatal error:", errMsg);

    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
