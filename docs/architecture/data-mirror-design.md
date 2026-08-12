# Data Mirror Design — Campus Dealer → Supabase

> **Author:** @architect | **Date:** 2026-06-03  
> **Status:** APPROVED (consensus from router deliberation)  
> **Implementer:** @data-engineer (schema + migration) + @dev (edge function + frontend)

## 1. Overview

Replace direct SQL Server queries (edge function `query-sqlserver` via tedious TCP)
with local Supabase mirror tables synced every 5 minutes. The frontend reads from
PostgREST instead of invoking the edge function, eliminating cold-start latency and
TCP handshake overhead.

```
┌──────────────┐   5min cron   ┌─────────────────────┐
│ SQL Server   │ ◄──────────── │ sync-campus-dealer  │
│ Campus Dealer│ ──── rows ──► │ (Edge Function)     │
└──────────────┘               └─────────┬───────────┘
                                         │ upsert / truncate+insert
                                         ▼
                               ┌─────────────────────┐
                               │ Supabase PostgreSQL  │
                               │ schema: mirror       │
                               └─────────┬───────────┘
                                         │ PostgREST
                                         ▼
                               ┌─────────────────────┐
                               │ Frontend (react-query│
                               │ staleTime: 60s)     │
                               └─────────────────────┘
```

## 2. Schema PostgreSQL

All tables live in schema `mirror` to keep separation from `public` and `insights`.

### 2.0 Schema + Control Tables

```sql
CREATE SCHEMA IF NOT EXISTS mirror;

-- Metadata de sync por view
CREATE TABLE mirror.sync_metadata (
    id              serial PRIMARY KEY,
    view_name       text UNIQUE NOT NULL,
    last_watermark  text,          -- valor do campo watermark (ISO timestamp ou NULL)
    last_sync_at    timestamptz,   -- quando o ultimo sync completou
    strategy        text NOT NULL DEFAULT 'full'  -- 'incremental' | 'full'
        CHECK (strategy IN ('incremental', 'full')),
    row_count       integer DEFAULT 0
);

-- Log de execucoes
CREATE TABLE mirror.sync_log (
    id              bigserial PRIMARY KEY,
    view_name       text NOT NULL,
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,
    status          text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'error')),
    rows_affected   integer DEFAULT 0,
    duration_ms     integer,
    error_message   text,
    strategy_used   text
);

CREATE INDEX idx_sync_log_view_started ON mirror.sync_log(view_name, started_at DESC);
CREATE INDEX idx_sync_log_status ON mirror.sync_log(status) WHERE status = 'error';
```

### 2.1 mirror.crm_negocios

Source: `VW_Ceres_CRM_Negocios`

```sql
CREATE TABLE mirror.crm_negocios (
    ngo_numero            text NOT NULL,
    ngo_conclusao         text,
    ngo_etapa             text,
    ngo_funil             text,
    ngo_vlr_total         numeric(15,2),
    ngo_forma_entrada     text,
    ngo_motivo_perda      text,
    ngo_motivo_ganho      text,
    ngo_ciclo_vendas      integer,
    ngo_qtd_acoes         integer,
    ngo_probabilidade     integer,
    ngo_vendedores        text,
    ngo_data_cadastro     timestamptz,
    ngo_data_fechamento   timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ngo_numero)
);

-- Access patterns: filtro por data, vendedor, conclusao, funil
CREATE INDEX idx_negocios_data_cadastro ON mirror.crm_negocios(ngo_data_cadastro);
CREATE INDEX idx_negocios_data_fechamento ON mirror.crm_negocios(ngo_data_fechamento);
CREATE INDEX idx_negocios_vendedores ON mirror.crm_negocios(ngo_vendedores);
CREATE INDEX idx_negocios_conclusao ON mirror.crm_negocios(ngo_conclusao);
CREATE INDEX idx_negocios_funil ON mirror.crm_negocios(ngo_funil);
```

**NOTA:** A view original e denormalizada por produto (~10% dos NGO_Numero duplicados).
A deduplicacao ocorre na ingestao: INSERT ON CONFLICT DO UPDATE garante 1 row por
NGO_Numero (ultima versao vence). O frontend NAO precisa mais deduplicar.

### 2.2 mirror.crm_pedidos

Source: `VW_Ceres_CRM_Pedidos`

```sql
CREATE TABLE mirror.crm_pedidos (
    ngo_numero            text NOT NULL,
    pdo_situacao          text,
    pdo_vlr_pedido        numeric(15,2),
    pdo_vlr_financiado    numeric(15,2),
    pdo_vlr_recurso_proprio numeric(15,2),
    pdo_cidade_uf_entrega text,
    pdo_vendedor          text,
    pdo_dth_pedido        timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ngo_numero, pdo_dth_pedido)
);

CREATE INDEX idx_pedidos_situacao ON mirror.crm_pedidos(pdo_situacao);
CREATE INDEX idx_pedidos_dth ON mirror.crm_pedidos(pdo_dth_pedido);
CREATE INDEX idx_pedidos_vendedor ON mirror.crm_pedidos(pdo_vendedor);
```

### 2.3 mirror.crm_pedidos_item

Source: `VW_Ceres_CRM_PedidosItem`

```sql
CREATE TABLE mirror.crm_pedidos_item (
    id                    bigserial PRIMARY KEY,
    pdo_item_grupo        text,
    pdo_item_marca        text,
    pdo_item_modelo       text,
    pdo_item_qtde         integer,
    pdo_item_vlr_unitario numeric(15,2),
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_item_grupo ON mirror.crm_pedidos_item(pdo_item_grupo);
CREATE INDEX idx_pedidos_item_marca ON mirror.crm_pedidos_item(pdo_item_marca);
```

### 2.4 mirror.crm_carteira_clientes

Source: `VW_Ceres_CRM_CarteiraClientes`

```sql
CREATE TABLE mirror.crm_carteira_clientes (
    cli_id_cliente        text NOT NULL,
    cli_tipo_cliente      text,
    cli_prospect          text,
    cli_uf                text,
    cli_cidade            text,
    usr_nome_usuario      text,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cli_id_cliente)
);

CREATE INDEX idx_carteira_tipo ON mirror.crm_carteira_clientes(cli_tipo_cliente);
CREATE INDEX idx_carteira_uf ON mirror.crm_carteira_clientes(cli_uf);
CREATE INDEX idx_carteira_usuario ON mirror.crm_carteira_clientes(usr_nome_usuario);
```

**NOTA:** View tambem denormalizada. Dedup por `cli_id_cliente` na ingestao.

### 2.5 mirror.crm_acoes

Source: `VW_Ceres_CRM_Acoes`

```sql
CREATE TABLE mirror.crm_acoes (
    id                    bigserial PRIMARY KEY,
    emp_cidade            text,
    cli_nome              text,
    aco_tipo_contato      text,
    aco_tipo_acao         text,
    aco_vendedor          text,
    aco_atividade_executada text,
    aco_lat               numeric(10,7),
    aco_lon               numeric(10,7),
    aco_dth_conclusao     timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_dth ON mirror.crm_acoes(aco_dth_conclusao);
CREATE INDEX idx_acoes_vendedor ON mirror.crm_acoes(aco_vendedor);
CREATE INDEX idx_acoes_tipo ON mirror.crm_acoes(aco_tipo_acao);
CREATE INDEX idx_acoes_cidade ON mirror.crm_acoes(emp_cidade);
```

### 2.6 mirror.crm_funil_etapa

Source: `VW_Ceres_CRM_Negocios_Etapas` (note: view name differs from service name `funilBIService`)

```sql
CREATE TABLE mirror.crm_funil_etapa (
    id                    bigserial PRIMARY KEY,
    ngo_numero            text NOT NULL,
    funil_dsc             text,
    etapa_dsc_status      text,
    fne_duracao_dias      integer,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funil_ngo ON mirror.crm_funil_etapa(ngo_numero);
CREATE INDEX idx_funil_dsc ON mirror.crm_funil_etapa(funil_dsc);
CREATE INDEX idx_funil_etapa_status ON mirror.crm_funil_etapa(etapa_dsc_status);
```

### 2.7 mirror.usuarios

Source: `VW_Ceres_Usuario`

```sql
CREATE TABLE mirror.usuarios (
    usr_cod_usuario       text NOT NULL,
    usr_id_usuario        text,
    usr_nome_usuario      text,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usr_cod_usuario)
);

CREATE INDEX idx_usuarios_id ON mirror.usuarios(usr_id_usuario);
```

### 2.8 mirror.ordens_servico

Source: `VW_Ceres_OrdemServico`

```sql
CREATE TABLE mirror.ordens_servico (
    os_nr_os              text NOT NULL,
    os_f_status           text,
    sit_dsc_situacao_os   text,
    os_dth_abertura       timestamptz,
    os_dth_encerramento   timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (os_nr_os)
);

CREATE INDEX idx_os_status ON mirror.ordens_servico(os_f_status);
CREATE INDEX idx_os_abertura ON mirror.ordens_servico(os_dth_abertura);
CREATE INDEX idx_os_encerramento ON mirror.ordens_servico(os_dth_encerramento);
```

### 2.9 mirror.cliente_parque_maquinas

Source: `VW_Ceres_CRM_ClienteParqueMaquinas`

```sql
CREATE TABLE mirror.cliente_parque_maquinas (
    id                    bigserial PRIMARY KEY,
    cli_id_cliente        text,
    pqm_grupo             text,
    pqm_marca             text,
    pqm_modelo            text,
    pqm_qtd_maquinas      integer,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parque_cliente ON mirror.cliente_parque_maquinas(cli_id_cliente);
CREATE INDEX idx_parque_grupo ON mirror.cliente_parque_maquinas(pqm_grupo);
CREATE INDEX idx_parque_marca ON mirror.cliente_parque_maquinas(pqm_marca);
```

---

## 3. Estrategia de Sync Incremental

### 3.1 Analise de Watermark por View

| View | Campo watermark candidato | Estrategia |
|------|--------------------------|------------|
| VW_Ceres_CRM_Negocios | `NGO_DataCadastro` (criacao) — sem campo updated_at | **Full sync** (TRUNCATE+INSERT) |
| VW_Ceres_CRM_Pedidos | `PDO_DthPedido` | **Full sync** — pedidos mudam de status sem alterar data |
| VW_Ceres_CRM_PedidosItem | Nenhum campo de data | **Full sync** |
| VW_Ceres_CRM_CarteiraClientes | Nenhum campo de data | **Full sync** |
| VW_Ceres_CRM_Acoes | `ACO_DthConclusao` | **Incremental** — acoes sao append-only |
| VW_Ceres_CRM_Negocios_Etapas | Nenhum campo de data | **Full sync** |
| VW_Ceres_Usuario | Nenhum campo de data | **Full sync** (tabela pequena, ~50 rows) |
| VW_Ceres_OrdemServico | `OS_dthAbertura` | **Incremental** — OS novas tem dth crescente |
| VW_Ceres_CRM_ClienteParqueMaquinas | Nenhum campo de data | **Full sync** |

### 3.2 Logica de Cada Estrategia

**Full Sync (TRUNCATE + batch INSERT):**
1. BEGIN transaction
2. TRUNCATE mirror.{tabela}
3. INSERT em batches de 500 rows
4. COMMIT
5. Atualizar `sync_metadata.last_sync_at` e `row_count`

**Incremental (watermark-based):**
1. Ler `sync_metadata.last_watermark` para a view
2. SELECT da view SQL Server WHERE {watermark_col} > last_watermark
3. UPSERT (INSERT ON CONFLICT DO UPDATE) em batches de 500
4. Atualizar `sync_metadata.last_watermark` com MAX do campo watermark dos novos rows
5. Atualizar `sync_metadata.last_sync_at` e `row_count`

### 3.3 Dados Iniciais para sync_metadata

```sql
INSERT INTO mirror.sync_metadata (view_name, strategy) VALUES
    ('VW_Ceres_CRM_Negocios',              'full'),
    ('VW_Ceres_CRM_Pedidos',               'full'),
    ('VW_Ceres_CRM_PedidosItem',           'full'),
    ('VW_Ceres_CRM_CarteiraClientes',      'full'),
    ('VW_Ceres_CRM_Acoes',                 'incremental'),
    ('VW_Ceres_CRM_Negocios_Etapas',       'full'),
    ('VW_Ceres_Usuario',                   'full'),
    ('VW_Ceres_OrdemServico',              'incremental'),
    ('VW_Ceres_CRM_ClienteParqueMaquinas', 'full');
```

---

## 4. Edge Function Design: `sync-campus-dealer`

### 4.1 Interface

```
POST /functions/v1/sync-campus-dealer
Authorization: Bearer <service_role_key>
Content-Type: application/json

Body:
{
  "views": ["VW_Ceres_CRM_Negocios"]  // optional — default: all views
}

Response:
{
  "results": [
    { "view": "VW_Ceres_CRM_Negocios", "status": "success", "rows": 4200, "duration_ms": 3400 },
    ...
  ],
  "total_duration_ms": 18500
}
```

### 4.2 Pseudocode

```typescript
// supabase/functions/sync-campus-dealer/index.ts

import { createClient } from "jsr:@supabase/supabase-js@2";

const VIEW_CONFIG: Record<string, ViewConfig> = {
  "VW_Ceres_CRM_Negocios": {
    table: "mirror.crm_negocios",
    columns: [...],                    // from SQL Server
    mapRow: (row) => ({...}),          // snake_case mapping
    strategy: "full",
    conflictKey: "ngo_numero",
  },
  "VW_Ceres_CRM_Acoes": {
    table: "mirror.crm_acoes",
    columns: [...],
    mapRow: (row) => ({...}),
    strategy: "incremental",
    watermarkCol: "ACO_DthConclusao",  // SQL Server column
    conflictKey: null,                 // no natural PK, bigserial
  },
  // ... remaining views
};

async function syncView(viewName: string, supabase, sqlConn): Promise<SyncResult> {
  const config = VIEW_CONFIG[viewName];
  const startTime = Date.now();
  
  // 1. Read current watermark
  const { data: meta } = await supabase
    .from("sync_metadata")
    .select("last_watermark, strategy")
    .eq("view_name", viewName)
    .single();

  // 2. Build SQL query
  let sql = `SELECT ${config.columns.join(",")} FROM [${viewName}]`;
  if (config.strategy === "incremental" && meta?.last_watermark) {
    sql += ` WHERE [${config.watermarkCol}] > '${meta.last_watermark}'`;
  }

  // 3. Fetch from SQL Server
  const rows = await execQuery(sql);
  const mapped = rows.map(config.mapRow);

  // 4. Write to Supabase
  if (config.strategy === "full") {
    await supabase.rpc("truncate_mirror_table", { table_name: config.table });
    // batch insert
    for (let i = 0; i < mapped.length; i += 500) {
      await supabase.from(config.table).insert(mapped.slice(i, i + 500));
    }
  } else {
    // incremental upsert
    for (let i = 0; i < mapped.length; i += 500) {
      await supabase.from(config.table).upsert(mapped.slice(i, i + 500), {
        onConflict: config.conflictKey,
      });
    }
  }

  // 5. Update metadata
  const newWatermark = config.strategy === "incremental"
    ? mapped.at(-1)?.[config.watermarkCol] ?? meta?.last_watermark
    : null;

  await supabase.from("sync_metadata").update({
    last_watermark: newWatermark,
    last_sync_at: new Date().toISOString(),
    row_count: mapped.length,
  }).eq("view_name", viewName);

  // 6. Log execution
  const duration = Date.now() - startTime;
  await supabase.from("sync_log").insert({
    view_name: viewName,
    status: "success",
    rows_affected: mapped.length,
    duration_ms: duration,
    strategy_used: config.strategy,
    finished_at: new Date().toISOString(),
  });

  return { view: viewName, status: "success", rows: mapped.length, duration_ms: duration };
}
```

### 4.3 Truncate Helper (RPC)

A edge function usa service_role mas PostgREST nao expoe TRUNCATE diretamente.
Criar uma funcao SQL:

```sql
CREATE OR REPLACE FUNCTION mirror.truncate_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Whitelist: apenas tabelas do schema mirror
  IF table_name NOT LIKE 'mirror.%' THEN
    RAISE EXCEPTION 'Only mirror schema tables allowed';
  END IF;
  EXECUTE format('TRUNCATE %I.%I', split_part(table_name, '.', 1), split_part(table_name, '.', 2));
END;
$$;
```

### 4.4 Connection Reuse

A funcao reutiliza o mesmo pattern de conexao tedious do `query-sqlserver` existente
(env vars `SQLSERVER_HOST`, `SQLSERVER_DATABASE`, `SQLSERVER_USER`, `SQLSERVER_PASSWORD`,
`SQLSERVER_PORT`). Uma unica conexao por invocacao; cada view e processada sequencialmente
para nao sobrecarregar o SQL Server com conexoes paralelas.

### 4.5 Timeout e Limites

- Edge Function timeout: 300s (5 min) — suficiente para todas as 9 views
- Se timeout preocupar: dividir em 2 invocacoes (grupo A: 5 views menores, grupo B: 4 views maiores)
- Batch size: 500 rows por INSERT (equilibrio entre payload size e round-trips)

---

## 5. Cron Schedule

### 5.1 Supabase Cron (pg_cron via Dashboard > Database > Cron Jobs)

Recomendacao: usar **Supabase Cron Jobs** (built-in, pg_net para invocar edge functions).

```sql
-- Grupo A: Views transacionais (alta frequencia) — cada 5 minutos
SELECT cron.schedule(
  'sync-mirror-transactional',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-campus-dealer',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"views":["VW_Ceres_CRM_Negocios","VW_Ceres_CRM_Pedidos","VW_Ceres_CRM_PedidosItem","VW_Ceres_CRM_Acoes","VW_Ceres_CRM_Negocios_Etapas"]}'::jsonb
  );
  $$
);

-- Grupo B: Views de referencia (baixa frequencia) — cada 30 minutos
SELECT cron.schedule(
  'sync-mirror-reference',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-campus-dealer',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{"views":["VW_Ceres_CRM_CarteiraClientes","VW_Ceres_Usuario","VW_Ceres_OrdemServico","VW_Ceres_CRM_ClienteParqueMaquinas"]}'::jsonb
  );
  $$
);
```

### 5.2 Justificativa dos Grupos

| Grupo | Views | Frequencia | Razao |
|-------|-------|-----------|-------|
| A (transactional) | Negocios, Pedidos, PedidosItem, Acoes, FunilEtapa | 5 min | Dados que mudam ao longo do dia |
| B (reference) | Carteira, Usuarios, OS, Parque | 30 min | Dados de referencia, mudancas lentas |

---

## 6. Observabilidade

### 6.1 Frontend: Indicador de Ultima Atualizacao

O frontend consulta `mirror.sync_metadata` para exibir "Dados atualizados ha X minutos":

```typescript
// Nova query no frontend
const { data } = await supabase
  .from("sync_metadata")
  .select("view_name, last_sync_at")
  .order("last_sync_at", { ascending: false })
  .limit(1);

// Mostrar: "Ultima sync: 3 min atras"
```

### 6.2 Alertas de Falha

Consultar `sync_log` para deteccao de problemas:

```sql
-- Views com ultima sync falhada
SELECT view_name, error_message, started_at
FROM mirror.sync_log
WHERE status = 'error'
  AND started_at > now() - interval '1 hour'
ORDER BY started_at DESC;

-- Views sem sync nas ultimas 15 min (possivel cron parado)
SELECT m.view_name, m.last_sync_at
FROM mirror.sync_metadata m
WHERE m.last_sync_at < now() - interval '15 minutes'
  AND m.strategy != 'full';  -- reference tables tem 30min SLA
```

### 6.3 Dashboard Operacional (futuro)

Metricas disponiveis em `sync_log`:
- Tempo medio de sync por view
- Contagem de rows por sync (detectar growth anomalo)
- Taxa de erro por view
- Duration trend (detectar degradacao)

---

## 7. RLS (Row Level Security)

Todas as tabelas mirror sao read-only para o frontend (anon key):

```sql
-- Aplicar a todas as tabelas do schema mirror
ALTER TABLE mirror.crm_negocios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_negocios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_negocios FOR ALL TO service_role USING (true);

-- Repetir para cada tabela (9 tabelas + sync_metadata + sync_log)
-- sync_metadata e sync_log: apenas SELECT para anon (para mostrar "ultima atualizacao")
ALTER TABLE mirror.sync_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_meta" ON mirror.sync_metadata FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write_meta" ON mirror.sync_metadata FOR ALL TO service_role USING (true);

ALTER TABLE mirror.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_log" ON mirror.sync_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write_log" ON mirror.sync_log FOR ALL TO service_role USING (true);
```

---

## 8. Rollback Plan

### 8.1 Feature Flag no Frontend

```typescript
// src/config/featureFlags.ts
export const USE_MIRROR = {
  crm_negocios: true,
  crm_pedidos: true,
  crm_acoes: true,
  // ... toggle per table
};
```

Cada service BI pode checar a flag e decidir fonte:

```typescript
export async function fetchNegociosBI(): Promise<NegocioBIRow[]> {
  if (USE_MIRROR.crm_negocios) {
    // PostgREST — rapido, sem cold start
    const { data } = await supabase.from("crm_negocios").select("*");
    return mapToNegocioBIRow(data);
  }
  // Fallback — edge function TCP direto
  return fetchFromSqlServer();
}
```

### 8.2 Manter query-sqlserver Funcional

A edge function `query-sqlserver` NAO sera removida. Permanece como:
- Fallback em caso de sync falhando
- Acesso a views de baixo uso nao espelhadas (Fase 2+)
- Debug/investigacao pontual

### 8.3 Migracao Tab-a-Tab

Migrar frontend progressivamente:
1. Comercial (Acoes + Negocios) — maior impacto de performance
2. Pedidos (Pedidos + PedidosItem)
3. Admin (Carteira + Usuarios)
4. Servicos (OS)
5. Produtos (Parque)
6. Operacional (manter direto — views nao espelhadas nesta fase)

---

## 9. Column Mapping Reference

Mapa completo SQL Server → PostgreSQL para uso do @data-engineer:

| SQL Server Column | PG Column | PG Type | Tabela |
|---|---|---|---|
| NGO_Numero | ngo_numero | text | crm_negocios |
| NGO_Conclusao | ngo_conclusao | text | crm_negocios |
| NGO_Etapa | ngo_etapa | text | crm_negocios |
| NGO_Funil | ngo_funil | text | crm_negocios |
| NGO_VlrTotalNegociado | ngo_vlr_total | numeric(15,2) | crm_negocios |
| NGO_FormaEntrada | ngo_forma_entrada | text | crm_negocios |
| NGO_MotivoPerda | ngo_motivo_perda | text | crm_negocios |
| NGO_MotivoGanho | ngo_motivo_ganho | text | crm_negocios |
| NGO_CicloVendas | ngo_ciclo_vendas | integer | crm_negocios |
| NGO_QtdAcoes | ngo_qtd_acoes | integer | crm_negocios |
| NGO_Probabilidade | ngo_probabilidade | integer | crm_negocios |
| NGO_Vendedores | ngo_vendedores | text | crm_negocios |
| NGO_DataCadastro | ngo_data_cadastro | timestamptz | crm_negocios |
| NGO_DataFechamento | ngo_data_fechamento | timestamptz | crm_negocios |
| PDO_SituacaoPedido | pdo_situacao | text | crm_pedidos |
| PDO_VlrPedido | pdo_vlr_pedido | numeric(15,2) | crm_pedidos |
| PDO_VlrFinanciado | pdo_vlr_financiado | numeric(15,2) | crm_pedidos |
| PDO_VlrRecursoProprio | pdo_vlr_recurso_proprio | numeric(15,2) | crm_pedidos |
| PDO_CidadeUFEntrega | pdo_cidade_uf_entrega | text | crm_pedidos |
| PDO_Vendedor | pdo_vendedor | text | crm_pedidos |
| PDO_DthPedido | pdo_dth_pedido | timestamptz | crm_pedidos |
| PDO_ItemGrupo | pdo_item_grupo | text | crm_pedidos_item |
| PDO_ItemMarca | pdo_item_marca | text | crm_pedidos_item |
| PDO_ItemModelo | pdo_item_modelo | text | crm_pedidos_item |
| PDO_ItemQtde | pdo_item_qtde | integer | crm_pedidos_item |
| PDO_ItemVlrUnitario | pdo_item_vlr_unitario | numeric(15,2) | crm_pedidos_item |
| CLI_idCliente | cli_id_cliente | text | crm_carteira_clientes |
| CLI_TipoCliente | cli_tipo_cliente | text | crm_carteira_clientes |
| CLI_Prospect | cli_prospect | text | crm_carteira_clientes |
| CLI_UF | cli_uf | text | crm_carteira_clientes |
| CLI_Cidade | cli_cidade | text | crm_carteira_clientes |
| USR_NomeUsuario | usr_nome_usuario | text | crm_carteira_clientes |
| EMP_Cidade | emp_cidade | text | crm_acoes |
| CLI_Nome | cli_nome | text | crm_acoes |
| ACO_TipoContato | aco_tipo_contato | text | crm_acoes |
| ACO_TipoAcao | aco_tipo_acao | text | crm_acoes |
| ACO_Vendedor | aco_vendedor | text | crm_acoes |
| ACO_AtividadeExecutada | aco_atividade_executada | text | crm_acoes |
| ACO_Lat | aco_lat | numeric(10,7) | crm_acoes |
| ACO_Lon | aco_lon | numeric(10,7) | crm_acoes |
| ACO_DthConclusao | aco_dth_conclusao | timestamptz | crm_acoes |
| NGO_Numero | ngo_numero | text | crm_funil_etapa |
| Funil_dsc | funil_dsc | text | crm_funil_etapa |
| Etapa_dscStatusNegocio | etapa_dsc_status | text | crm_funil_etapa |
| FNE_DuracaoDias | fne_duracao_dias | integer | crm_funil_etapa |
| USR_CodUsuario | usr_cod_usuario | text | usuarios |
| USR_idUsuario | usr_id_usuario | text | usuarios |
| USR_nomeUsuario | usr_nome_usuario | text | usuarios |
| OS_nrOS | os_nr_os | text | ordens_servico |
| OS_fStatus | os_f_status | text | ordens_servico |
| SIT_dscSituacaoOS | sit_dsc_situacao_os | text | ordens_servico |
| OS_dthAbertura | os_dth_abertura | timestamptz | ordens_servico |
| OS_dthEncerramento | os_dth_encerramento | timestamptz | ordens_servico |
| CLI_idCliente | cli_id_cliente | text | cliente_parque_maquinas |
| PQM_Grupo | pqm_grupo | text | cliente_parque_maquinas |
| PQM_Marca | pqm_marca | text | cliente_parque_maquinas |
| PQM_Modelo | pqm_modelo | text | cliente_parque_maquinas |
| PQM_QtdMaquinas | pqm_qtd_maquinas | integer | cliente_parque_maquinas |

---

## 10. Decisoes Arquiteturais (ADR Summary)

| # | Decisao | Razao |
|---|---------|-------|
| 1 | Schema separado `mirror` | Isolamento semantico; nao polui `public` nem `insights` |
| 2 | Full sync como default | Views SQL Server nao tem campo `updated_at` confiavel |
| 3 | Dedup na ingestao (ON CONFLICT) | Remove necessidade de dedup no frontend (simplifica hooks) |
| 4 | Sequencial dentro de 1 invocacao | 1 conexao TCP ao SQL Server por vez, evita sobrecarga |
| 5 | 2 grupos de cron | Separar transacional (5min) de referencia (30min) reduz carga |
| 6 | Feature flag por tabela | Rollback granular; migra tab-a-tab sem risco global |
| 7 | query-sqlserver preservado | Fallback + acesso a views nao espelhadas |
| 8 | TRUNCATE via RPC SECURITY DEFINER | PostgREST nao expoe DDL; funcao whitelista schema |
| 9 | sync_log permanente | Historico para debug; limpeza via cron semanal (>30 dias) |

---

## 11. Estimativa de Volume

| Tabela | Rows estimados | Tamanho estimado |
|--------|---------------|-----------------|
| crm_negocios | ~4.000-5.000 | ~2 MB |
| crm_pedidos | ~3.000-4.000 | ~1.5 MB |
| crm_pedidos_item | ~8.000-12.000 | ~2 MB |
| crm_carteira_clientes | ~2.000-3.000 | ~0.5 MB |
| crm_acoes | ~15.000-25.000 | ~5 MB |
| crm_funil_etapa | ~10.000-15.000 | ~2 MB |
| usuarios | ~50-100 | ~10 KB |
| ordens_servico | ~3.000-5.000 | ~1 MB |
| cliente_parque_maquinas | ~5.000-8.000 | ~1.5 MB |
| **TOTAL** | **~50.000-77.000** | **~15-16 MB** |

Bem dentro dos limites do Supabase Free/Pro tier. Full sync a cada 5 min
com este volume leva estimados 10-20s (network + insert).

---

## 12. Proximos Passos

1. **@data-engineer**: Criar migration SQL com todo o schema acima (usar este doc como spec)
2. **@dev**: Implementar edge function `sync-campus-dealer` seguindo pseudocode da secao 4
3. **@dev**: Deploy + primeiro sync manual (invocar com body `{"views": [...all...]}`)
4. **@dev**: Configurar cron jobs no Supabase Dashboard
5. **@dev**: Migrar frontend tab-a-tab (secao 8.3) com feature flags
6. **@qa**: Validar integridade (comparar contagens mirror vs query-sqlserver direto)
7. **@devops**: Monitorar sync_log por 48h antes de desligar chamadas diretas
