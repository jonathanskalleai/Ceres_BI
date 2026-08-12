# Handoff: ETL Python Completo — Frontend Não Puxa Dados

## Status: ETL ✅ DONE | Frontend ❌ PENDENTE

---

## O que foi feito (sessão 2026-06-22)

### ETL Python → Supabase (100% funcional)

- **VPS:** 178.238.235.203
- **ETL:** `/opt/etl/` (Python 3 + pymssql + psycopg2)
- **Cron ativo:** `/etc/cron.d/ceres-etl` — 4 blocos a cada 15 min
- **11 views sincronizadas** do SQL Server (CamposDealer_BI) para Supabase (schema `mirror`)

| Bloco | Min | Views |
|-------|-----|-------|
| A | 0 | crm_acoes, crm_negocios, crm_pedidos |
| B | 5 | crm_pedidos_item, crm_carteira_clientes, usuarios |
| C | 10 | ordens_servico, crm_funil_etapa, cliente_parque_maquinas |
| D | 12 | empresas, produtos |

### Dados no Supabase (mirror.*)

| Tabela | Registros |
|--------|-----------|
| crm_acoes | 29.095 |
| crm_carteira_clientes | 15.036 |
| crm_funil_etapa | 13.997 |
| crm_negocios | 3.281 |
| crm_pedidos_item | 2.710 |
| crm_pedidos | 2.093 |
| cliente_parque_maquinas | 1.526 |
| ordens_servico | 147 |
| usuarios | 100 |
| produtos | 243 |
| empresas | 4 |

### Bugs corrigidos

- Nome do banco: `camposdealer__BI` → `CamposDealer_BI` (1 underscore)
- IP Postgres: `10.0.1.220` (overlay) → `172.19.0.2` (bridge acessível)
- Coluna `PDO_Frete`: numeric → TEXT (recebe "CIF"/"FOB")
- UUID adapter: `psycopg2.extras.register_uuid()` para `USR_idLicenca`
- Watermark skip para tabelas full_replace (empresas)
- Mappings reescritos do zero com colunas reais (nomes eram completamente diferentes)

---

## Problema pendente: Frontend não puxa dados

### Sintomas

- Dashboard não mostra dados (mesmo com mirror populado)
- Console mostra: `Edge Function returned a non-2xx status code`
- Sem outros erros visíveis no console

### Hipóteses para investigar

1. **O frontend ainda aponta para as Edge Functions antigas** (que faziam o sync direto) em vez de ler do schema `mirror` via REST/RLS
2. **As Edge Functions foram desativadas/quebradas** mas o frontend ainda as chama
3. **O `registrosService.ts` faz fetch via Edge Function** em vez de query direta ao Supabase (schema mirror)
4. **RLS policies** podem estar bloqueando leitura das tabelas mirror pelo anon user

### Arquivos relevantes para investigar

- `src/services/registrosService.ts` — onde o frontend busca dados (verificar se usa Edge Function ou query direta)
- `.env` — tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)
- Supabase Edge Functions (se ainda existem) — provavelmente a fonte do erro non-2xx
- RLS policies no schema `mirror` — verificar se anon/authenticated tem SELECT

### Ação recomendada

1. Ler `registrosService.ts` e entender de onde vêm os dados
2. Se usa Edge Function → migrar para query direta ao schema mirror (via Supabase client JS)
3. Se já faz query direta → verificar RLS/grants no schema mirror
4. Desativar/remover Edge Functions antigas que não servem mais

---

## Credenciais (NUNCA ALTERAR)

- **SQL Server:** wfrsistemas.net.br:1433 | DB: CamposDealer_BI | User: usrBI_CresCandiotto
- **Supabase (Docker):** 172.19.0.2:5432 | DB: postgres | User: supabase_admin
- **Config:** `/opt/etl/config/config.yaml` (chmod 600, header de proteção)

## Monitoramento

```bash
# Logs
tail -f /var/log/etl/cron_A.log

# Status sync
docker exec supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm \
  psql -U supabase_admin -d postgres \
  -c "SELECT table_name, watermark_value, last_sync_at, rows_synced, status FROM mirror.sync_control ORDER BY last_sync_at DESC;"
```

---

*Sessão: 2026-06-22 | Agentes: @dev | Branch: main*
