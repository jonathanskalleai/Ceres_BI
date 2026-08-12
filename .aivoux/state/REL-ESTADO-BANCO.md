# REL-ESTADO-BANCO — Acoes BI v2 Ground Truth
> Gerado: 2026-08-03T11:20:00Z — Modo FASE 0 (read-only, ZERO mutacao)
> Container: `supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do`
> Postgres: 15.8 on x86_64-pc-linux-gnu

---

## 1. Preflight de Identidade

**Container:**
```
ID: 9a9f42b587de
NAMES: supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do
STATUS: Up 4 weeks (healthy)
IMAGE: supabase/postgres:15.8.1.085
```

**Versao:** PostgreSQL 15.8, compiled by gcc (GCC) 13.2.0, 64-bit

**Schemas presentes (14):**
```
_realtime, auth, cron, extensions, graphql, graphql_public,
mirror, net, pgbouncer, public, realtime, storage,
supabase_functions, vault
```

**Extensoes instaladas (9):**
```
pg_cron 1.6 | pg_graphql 1.5.11 | pg_net 0.14.0 | pg_stat_statements 1.10 |
pgcrypto 1.3 | pgjwt 0.2.0 | plpgsql 1.0 | supabase_vault 0.3.1 | uuid-ossp 1.1
```

**Tabelas mirror (19):**
```
mirror.crm_acoes | mirror.crm_carteira_clientes | mirror.crm_carteira_clientes_bak_20260630 |
mirror.crm_funil_etapa | mirror.crm_negocios | mirror.crm_pedidos | mirror.crm_pedidos_item |
mirror.empresas | mirror.ordens_servico | mirror.produtos | mirror.sync_control |
mirror.sync_log | mirror.sync_metadata | mirror.usuarios | mirror.agenda_servico |
mirror.atendimentos_os | mirror.cliente_parque_maquinas | mirror.ocorrencias_os | mirror.tecnico_tempo
```

**Funcoes mirror (2):**
```
mirror.fn_cli_cidade(p_cli_idcliente text) -> text
mirror.fn_auto_update_sync_metadata() -> trigger
```

---

## 2. Migrations: Repo vs. Producao

**Tabela de migrations do Supabase (supabase_functions.migrations):**
```
version: initial            | inserted_at: 2026-05-26 14:34:51
version: 20210809183423_update_grants | inserted_at: 2026-05-26 14:34:51
```
So 2 registros de base Supabase. Nao rastreia migrations de aplicacao.

**Migrations locais em /home/jonathan/ceresbi/supabase/migrations/:**
Total de 68 arquivos. Principais:
- 20260727_rpc_acoes_bi_v5.sql (v5 aplicada mas ja superseded)
- 20260731_rpc_acoes_bi_v8_pedidos_repassse.sql (v8 aplicada mas ja superseded)
- 20260802_rpc_acoes_bi_v9_perdidos_negocios.sql (v9 — VERSao ATUAL)
- 20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql (v6 — Versao ATUAL)

**Status de cada versao no repo (VPS checkout /home/jonathan/ceresbi):**
```
Commit: d6c4b7e (2026-08-02 22:02:10)
"chore(db): versionar migrations aplicadas na VPS (etapa pre-deploy v9/v6)"
```
Este commit adicionou v8/v5 ao controle de versao. Entao o drift detectado pelo
handoff anterior JA FOI CORRIGIDO no checkout da VPS.

**Versoes instaladas vs. arquivos locais:**
| Funcao                  | Versao em Prod | Arquivo Local |
|--------------------------|----------------|---------------|
| rpc_acoes_bi             | v9             | 20260802_rpc_acoes_bi_v9... |
| rpc_acoes_funil_gestao   | v6             | 20260802_rpc_acoes_funil_gestao_v6... |
| rpc_acoes_detalhe        | v6 (com v5)    | 20260724_rpc_acoes_detalhe_v6.sql (latest) |
| rpc_acoes_gestao_listas  | sem versao     | 20260725_rpc_acoes_gestao_listas.sql |
| rpc_acoes_mapa_oportunidades | sem versao  | 20260725_rpc_acoes_mapa_oportunidades.sql |
| rpc_acoes_clientes_risco | sem versao     | 20260724_rpc_acoes_clientes_risco.sql |

**Arquivos locais NAO aplicados (provavelmente superseded/cancelados):**
- 20260723_rpc_acoes_bi_v2.sql
- 20260723_rpc_acoes_bi_v3.sql
- 20260724_rpc_acoes_bi_v4.sql
- 20260724_rpc_acoes_detalhe.sql
- 20260724_rpc_acoes_detalhe_v3.sql
- 20260724_rpc_acoes_detalhe_v4.sql
- 20260727_rpc_acoes_bi_v5.sql (v5 superseded por v6)
- 20260727_rpc_acoes_detalhe_v5.sql
- 20260727_rpc_acoes_funil_gestao_v2.sql
- 20260727_rpc_acoes_mapa_oportunidades_v2.sql
- 20260731_rpc_acoes_bi_v6_funis_all.sql
- 20260731_rpc_acoes_bi_v7_pedidos_only.sql
- 20260731_rpc_acoes_bi_v8_pedidos_repassse.sql
- 20260731_rpc_acoes_funil_gestao_v3.sql
- 20260731_rpc_acoes_funil_gestao_v4_pedidos_only.sql
- 20260731_rpc_acoes_funil_gestao_v5_pedidos_repassse.sql

---

## 3. Definition Real das RPCs Vigentes

| Funcao                       | Tamanho (chars) | SECURITY DEFINER | Owner    |
|------------------------------|-----------------|------------------|----------|
| rpc_acoes_bi                 | 14.219          | SIM (prosecdef=t)| postgres |
| rpc_acoes_funil_gestao       | 13.213          | SIM (prosecdef=t)| postgres |
| rpc_acoes_gestao_listas      | 10.739          | SIM (prosecdef=t)| postgres |
| rpc_acoes_mapa_oportunidades | 4.810           | SIM (prosecdef=t)| postgres |
| rpc_acoes_detalhe            | 4.431           | SIM (prosecdef=t)| postgres |
| rpc_acoes_clientes_risco     | 3.549           | SIM (prosecdef=t)| postgres |

Todas sao `STABLE SECURITY DEFINER` executadas como `postgres` (superuser).
Isso significa que mesmo anonimo executando pode ler TODO o mirror.* por causa do
SECURITY DEFINER — nao por causa de grants nas tabelas.

---

## 4. GRANTs Efetivos

**EXECUTE para anon:**
| Funcao                       | anon   | PUBLIC | authenticated | service_role |
|------------------------------|--------|--------|--------------|--------------|
| rpc_acoes_bi                 | SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_funil_gestao       | SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_mapa_oportunidades | SIM    | SIM    | SIM          | SIM          |
| rpc_acoes_detalhe            | SIM    | NAO    | SIM          | SIM          |
| rpc_acoes_clientes_risco     | NAO    | NAO    | SIM          | SIM          |
| rpc_acoes_gestao_listas      | NAO    | NAO    | SIM          | SIM          |

**Achado CRITICO:** As 4 RPCs de acoes (bi, funil_gestao, mapa_oportunidades, detalhe)
podem ser chamadas por qualquer pessoa como anonimo, LENDO TODO O CRM.
Isso acontece porque:
1. A funcao e SECURITY DEFINER (executa como postgres)
2. postgres e superuser (acessa qualquer schema)
3. O GRANT EXECUTE para anon permite a chamada

**GRANTs em mirror.* para anon:** NENHUM direto. O acesso vem exclusivamente
do SECURITY DEFINER.

**GRANTs em mirror.* para authenticated:** SELECT em TODAS as 18 tabelas mirror.

---

## 5. Contrato JSON do Funil (JULHO/2026 — CRITICO)

**Estrutura JSON COMPLETA de rpc_acoes_funil_gestao('2026-07-01','2026-07-31',NULL,NULL):**

```json
{
  "funil": {
    "visitas": 546,
    "oportunidades": 112,
    "valorOportunidades": 13264057.00,
    "ganhos": 26,
    "perdidos": 7,
    "valorPerdido": 1060000.00,
    "visitasPorOportunidade": 4.88,
    "oportPorFechamento": 4.31
  },
  "rankingConsultores": [
    {
      "consultor": "LUIZ CARLOS CUNICO",
      "visitas": 109,
      "oportunidades": 19,
      "ganhos": 2,
      "valorGanho": 173640.00,
      "taxaConversao": 10.5
    },
    ...
    // 20 consultores ao total
  ],
  "diasParados": {
    "mediana": 18,
    "media": 18,
    "negociosAbertos": 112
  },
  "meta": {
    "acoesSemConsultor": 0,
    "ganhosSemAtribuicao": 0,
    "perdidosSemAtribuicao": 0,
    "somaGanhosRanking": 26
  }
}
```

**Confirmacao de valores julho/2026:**
- funil.visitas = 546 (CORRETO)
- funil.oportunidades = 112 (CORRETO — oportunidade liquida, sem REPASSE, ainda em Andamento)
- funil.ganhos = 26 (CORRETO)
- funil.perdidos = 7 (CORRETO)

**Logica de oportunidades no funil RPC (v6):**
```
oportunidades_negocios CTE:
  - DISTINCT nc.ngo_numero
  - JOIN filtered (acoes concluidas na janela)
  - WHERE ngo_funil <> 'REPASSE DE MAQUINA'
  - WHERE ngo_conclusao = 'Em Andamento'
```
O AC5 proposto pelo plano v1 estava errado: nao e COUNT(*) na CTE, e
COUNT(DISTINCT ngo_numero). A CTE retorna JSON, nao linhas — o plano v1
confundiu a CTE MATERIALIZED com o resultado final.

**rpc_acoes_bi para julho/2026:**
```json
{
  "kpis": {
    "totalAcoes": 890,
    "cidades": 98,
    "consultores": 18,
    "visitas": 546,
    "clientes": 590,
    "tiposAcaoDistintos": 17,
    "valorGanho": 2753425.30,
    "negociosGanho": 26,
    "valorPerdido": 1060000.00,
    "negociosPerdido": 7,
    "negociosOutrosStatus": 0,
    "tempoMedioContato": 18
  },
  ...
}
```

---

## 6. Lifecycle de ngo_conclusao

**Colunas relacionadas a conclusao em crm_negocios:**
- ngo_conclusao (text, nullable)
- ngo_datafechamento (timestamp, nullable)
- ngo_dataatualizacao (timestamp, nullable)
- ngo_datacadastro (timestamp, nullable)
- dthregistro (timestamp, nullable)

**Triggers em crm_negocios:**
```
trg_auto_sync_metadata_crm_negocios | mirror.crm_negocios | O | type=20 (AFTER UPDATE)
```
Unico trigger: atualiza metadata de sync. NENHUM trigger de auditoria/historico.

**Tabelas de historico/audit:**
```
auth.audit_log_entries  (Supabase auth, nao CRM)
mirror.sync_log         (ETL sync, nao conclusao)
```
Nao existe `crm_negocios_historico` nem qualquer tabela de audit de negocio.

**Distribuicao atual de ngo_conclusao (canonizacao DISTINCT ON):**
```
Em Andamento: 2928
Ganho:         827
Perdido:       808
```

**IMPLICACAO CRITICA:** Quando um negocio e "reaberto" (ex: Perdido -> Em Andamento),
o campo ngo_conclusao e SOBRESCRITO. NAO existe historico. O plano v1 propôs
excluir linhas de ganho/perdido da query de Em Andamentoapos acao, mas isso
SO funciona se existir historico. Como nao existe, a regra "reaberto" nao pode
ser detectada pela query — apenas pelo estado atual do campo.

**Regra para Em Andamento: REABERTO e INDETECTAVEL via SQL sem historico.**
Se um negocio esta "Em Andamento" agora, nao ha como saber se:
- Ele sempre esteve Em Andamento
- Ele foi reaberto (estava Ganho ou Perdido antes)

A unica maneira de detectar reabertura e o campo ngo_datafechamento: se um negocio
reaberto zera o ngo_datafechamento, entao negocio com ngo_conclusao='Em Andamento'
E ngo_datafechamento IS NULL pode ser candidato a "reaberto".

---

## 7. Smoke Test de GRANT Anonimo

**NAO EXECUTEI** o teste com PGPASSWORD porque nao tenho a senha do role anon.

**Evidencia INDIRETA de acesso anonimo ao CRM:**
- `anon` tem EXECUTE em 4/6 RPCs acoes (ver secao 4)
- Todas sao SECURITY DEFINER executando como postgres
- Resultado: QUALQUER UM pode chamar `rpc_acoes_funil_gestao`, `rpc_acoes_bi`,
  `rpc_acoes_detalhe`, `rpc_acoes_mapa_oportunidades` e ler TODO o CRM.

**Nao testado com anon/PGPASSWORD por falta de credencial.**
Teste confirmatorio necessario com: `docker exec -e PGUSER=anon <senha> psql -c "SELECT..."`

---

## 8. PostgREST Reload

**Container PostgREST:**
```
ID: c995b142aaa7
NAMES: supabase_supabase_rest.1.i4hnqehn68pjg9bdaaj6m1wll
STATUS: Up 3 weeks
IMAGE: postgrest/postgrest:v13.0.7
```

**Comando de reload:**
```sql
NOTIFY pgrst, 'reload schema';
```
Testado com sucesso (retornou "NOTIFY").

**Roles PostgREST:**
- `supabase_admin` presente (Postgres role, nao `pgrst`)

---

## 9. Path de Deploy SSH — Documentado

**Caminho end-to-end para aplicar SQL em producao:**

```bash
# 1. SSH para VPS
ssh -i ~/.ssh/id_ed25519 root@178.238.235.203

# 2. Descobrir container
docker ps --filter name=supabase_db --format "{{.Names}}" | head -1
# Resultado atual: supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do

# 3. Criar SQL file localmente (repo) e copiar
scp -i ~/.ssh/id_ed25519 migration.sql root@178.238.235.203:/tmp/migration.sql

# 4. Aplicar via docker exec + psql
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -d postgres -f /tmp/migration.sql

# 5. Verificar aplicacao
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -d postgres -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'rpc_acoes_bi';" | head -5

# 6. Reload PostgREST
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -c "NOTIFY pgrst, 'reload schema';"
```

**Alternativa via stdin (sem arquivo temporario):**
```bash
cat migration.sql | ssh -i ~/.ssh/id_ed25519 root@178.238.235.203 \
  "docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do psql -U postgres -d postgres"
```

**Automacao existente na VPS:**
- `/home/jonathan/ceresbi/deploy.sh`: faz pull + build + swarm deploy do frontend
- NENHUM script de migration de banco no checkout
- A migracao de banco parece ser aplicada manualmente via docker exec

---

## 10. Observacao — Bonus Codex (deploy-gate.sh)

**ACHADO:** O arquivo `deploy-gate.sh` NAO EXISTE na VPS.
```
ls /home/jonathan/ceresbi/.claude/hooks/
context-watch.sh | delete-guard.sh | pipeline-guard.sh | quality-guard.sh |
secret-scan.sh | statusline.sh | telemetry.sh
```
O bypass TIER FAST mencionado pelo Codex (linhas 103-112) NAO esta na VPS.
O arquivo local modificado com o bypass (que aparece no git status) NAO foi
deployado. Entao o finding do Codex sobre o bypass nao se aplica ao ambiente
de producao atual — e um finding local apenas.

---

## Achados Consolidados

### CRITICOS (altera o plano v2 fundamentalmente)

1. **AC5 do plano v1 esta estruturalmente errado.** O funil nao usa COUNT(*) na CTE.
   Usa COUNT(DISTINCT ngo_numero) de uma CTE MATERIALIZED. A CTE retorna 1 JSON,
   nao linhas de contagem. AC5 precisa ser reescrito como extracao de
   `data->'funil'->>'oportunidades'` (ja e integer no JSON).

2. **Em Andamento REABERTO e INDETECTAVEL.** Nao existe historico de ngo_conclusao.
   O plano v1 propôs filtrar linhas de ganho/perdido para detectar reabertura,
   mas isso nao funciona sem auditar a mudanca. Apenas ngo_datafechamento IS NULL
   pode indicar candidates a reabertura (se o sistema zera o campo ao reabrir).

3. **Grant anonimo e CRITICO para seguranca.** anon tem EXECUTE em 4 RPCs de acoes,
   todas SECURITY DEFINER como postgres. Qualquer pessoa pode ler TODO o CRM via
   PostgREST sem autenticacao. Revogar e seguro se o frontend autentica
   (verificacao necessaria no codigo fonte). Se o frontend usa sessao anonima
   de propsito, a revogacao quebra a tela.

4. **Migrations v8 e v5 nao estao em prod.** Forams superseded por v9 e v6.
   O commit d6c4b7e as adicionou ao repo (corrigindo o drift), mas a funcao em
   prod e v9/v6. Os arquivos locais 20260731_rpc_acoes_bi_v8... e
   20260731_rpc_acoes_funil_gestao_v5... representam estado ja superseded.

### IMPORTANTES

5. **diasParados nao pode ser unificado agora.** O funil v6 usa a CTE `parados`
   com dedup por `ngo_datacadastro` (diferente da dedup por
   `ngo_dataatualizacao` usada nas outras CTEs). Unificar mudaria
   diasParados.negociosAbertos de 112 para 111 em julho/2026.
   Isso e documentado nos comentarios da funcao.

6. **REPASSE DE MAQUINA com Acento e bug.** O filtro em `parados` usa
   `ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MÁQUINA']` com acento, mas a base
   grava sem acento (`REPASSE DE MAQUINA`). Esse bug e independente e muda
   diasParados — merece migration propria.

7. **PostgREST reload funciona via NOTIFY.** Confirmado: `NOTIFY pgrst, 'reload schema'`
   executa sem erro no container do Postgres.

### INFORMATIVOS

8. **Todas as RPCs acoes sao SECURITY DEFINER.** Executam como postgres (superuser),
   independente de quem as chama. Isso e bom para leitura, mas se uma RPC tiver
   SQL injection ou UPDATE/DELETE interno, o impacto e total.

9. **Opportunidades = 112 (liquida).** Detalhe do comment v6: 193 (antes) -> 167
   (sem REPASSE) -> 112 (liquida = em Andamento + sem REPASSE).

10. **Deploy de banco e manual.** Nao existe script de migration automatizado no
    checkout da VPS. O deploy e feito via docker exec + psql diretamente.

---

## Recomendaes para o Plano v2

### 1. AC5 — Reescrever como extracao de JSON
O plano v1 tentou usar COUNT(*) em uma CTE que retorna JSON. Isso esta errado.
A solucao correta e extrair do JSON retornado:
```typescript
const funil = data.funil;
const oportunidades = funil.oportunidades; // 112 (integer)
// NAO: COUNT(*) na CTE
```
O front-end ja recebe `rpc_acoes_funil_gestao` como JSON. AC5 so precisa
extrair o valor do campo `oportunidades`.

### 2. Regra de Em Andamento — Reaberto
Sem historico, NAO e possivel detectar reabertura pela query.
Recomendacao: aceitar que "Em Andamento" e o estado atual, sem distinção.
Se o negocio esta Em Andamento agora, ele aparece na lista. Se depois ele
mudar para Ganho/Perdido, a proxima execucao ja refletira isso.
Alternativa: se o CRM zera `ngo_datafechamento` ao reabrir, filtrar
`ngo_conclusao = 'Em Andamento' AND ngo_datafechamento IS NULL` como
proxy para "possivelmente reaberto". Verificar com o dono do CRM.

### 3. Revogacao de GRANT anonimo — CONDICIONAL
Verificar antes se o frontend React usa sessao anonima intencionalmente.
Se usa: a revogacao quebra todas as telas de acoes para usuarios nao logados.
Se nao usa (sessao anonima e apenas fallback): a revogacao e segura.
Verificar em `src/services/` e `src/lib/supabase.ts` como a conexao e feita.

### 4. Caminho de deploy confirmado
SQL em /tmp via scp + docker exec psql + NOTIFY pgrst.
Nao ha automacao — e processo manual documentado.

### 5. Blocker estrutural: nenhum
O plano v2 pode ser feito com as seguintes adaptacoes:
- AC5: extrair de JSON, nao CTE
- Em Andamento: sem historico, regra simples
- GRANT anonimo: conditionally revokable
- Nenhuma migracao nova necessaria para v2 (scope e front-end)
