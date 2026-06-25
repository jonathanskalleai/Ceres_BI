# Handoff: Migração ETL Edge Functions → Python

## Status: PLANEJAMENTO APROVADO — Aguardando Execução

---

## Contexto

**Problema:** Edge Functions do Supabase crasham com `CPU time soft limit reached` durante ETL, causando defasagem de dados de 8-10 dias.

**Causa-raiz:** Limite de 50s CPU time do Deno em Edge Functions — não importa quantos cores a máquina tem.

**Solução:** Migrar ETL para Python nativo na VPS, mantendo Supabase como banco de dados.

**Validação:** Benchmark demonstrou que Python processa 28k registros em **0.19 segundos** — sem limite artificial.

---

## Arquitetura Decidida

```
┌─────────────────────────────────────────────────────────────────┐
│                          VPS (mesmo servidor)                   │
│                                                                 │
│   SQL Server (Campos Dealer)                                    │
│   Host: wfrsistemas.net.br:1433                                 │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Python ETL (VPS)                                       │  │
│   │  - Sem limite de CPU                                    │  │
│   │  - Cron job a cada 5 minutos                            │  │
│   │  - Batch size: 500 registros                            │  │
│   └─────────────────────────────────────────────────────────┘  │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Supabase (Docker local)                                │  │
│   │  - PostgreSQL: localhost:5432                           │  │
│   │  - Schema: mirror                                       │  │
│   │  - Auth/RLS/APIs REST: mantidos                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Manter do Supabase
- ✅ Auth (GoTrue)
- ✅ RLS (Row Level Security)
- ✅ REST/GraphQL APIs
- ✅ Studio (interface admin)
- ✅ Realtime subscriptions

### Remover (migrar para Python)
- ❌ Edge Function `sync-campus-dealer`

---

## Recursos VPS

| Recurso | Disponível | ETL usa |
|---------|------------|---------|
| CPU | 4 cores AMD EPYC | **SEM LIMITE** |
| RAM | 3.4GB livre | ~500MB |
| Disco | 56GB livre | ~1GB para logs |

---

## 5 Fases de Execução

### Fase 1: Setup Python (30 min)
- [ ] Criar virtualenv `/opt/etl/venv`
- [ ] Instalar dependências
- [ ] Criar diretórios
- [ ] Configurar `config.yaml`

### Fase 2: Implementar ETL (3h)
- [ ] `connectors/sqlserver.py` — conexão SQL Server
- [ ] `connectors/postgres.py` — conexão PostgreSQL
- [ ] `transformers/mappings.py` — mapeamentos por tabela
- [ ] `etl_campos_dealer.py` — entry point

### Fase 3: Tabela de Controle (15 min)
- [ ] Criar `mirror.sync_control`

### Fase 4: Configuração Final (30 min)
- [ ] Cron job `*/5 * * * *`
- [ ] Systemd service (opcional)
- [ ] Logs em `/var/log/etl/`

### Fase 5: Validação (48h)
- [ ] Testar manualmente
- [ ] Ativar cron paralelo
- [ ] Monitorar 48h
- [ ] Desativar Edge Functions

---

## Views a Sincronizar

| View SQL Server | Tabela Supabase | Watermark | Overlap |
|-----------------|-----------------|-----------|---------|
| VW_Ceres_CRM_Acoes | crm_acoes | ACO_DthAtualizacao | 2h |
| VW_Ceres_CRM_Negocios | crm_negocios | NGO_DataAtualizacao | 2h |
| VW_Ceres_CRM_Pedidos | crm_pedidos | dthRegistro | 2h |
| VW_Ceres_CRM_PedidosItem | crm_pedidos_item | dthRegistro | 2h |
| VW_Ceres_CRM_CarteiraClientes | crm_carteira_clientes | dthRegistro | 2h |
| VW_Ceres_Usuario | usuarios | dthRegistro | 2h |
| VW_Ceres_OrdemServico | ordens_servico | dthRegistro | 2h |
| VW_Ceres_CRM_Negocios_Etapas | crm_funil_etapa | dthRegistro | 2h |
| VW_Ceres_CRM_ClienteParqueMaquinas | cliente_parque_maquinas | dthRegistro | 2h |

---

## Estrutura de Arquivos na VPS

```
/opt/etl/
├── etl_campos_dealer.py      # Entry point principal
├── connectors/
│   ├── __init__.py
│   ├── sqlserver.py          # Conexão SQL Server (pyodbc)
│   └── postgres.py           # Conexão PostgreSQL/Supabase
├── transformers/
│   ├── __init__.py
│   └── mappings.py           # Mapeamentos por tabela
├── config/
│   ├── __init__.py
│   └── settings.py           # Config e credenciais
├── logs/                     # Logs de execução
├── requirements.txt
├── config.yaml               # Credenciais (chmod 600)
└── README.md
```

---

## Tabela sync_control

```sql
CREATE TABLE IF NOT EXISTS mirror.sync_control (
    id SERIAL PRIMARY KEY,
    table_name TEXT NOT NULL UNIQUE,
    source_view TEXT NOT NULL,
    watermark_column TEXT NOT NULL,
    watermark_value TIMESTAMP,
    last_sync_at TIMESTAMP,
    rows_synced INT DEFAULT 0,
    status TEXT DEFAULT 'idle',  -- idle, running, error
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Estratégia de Transição

### Paralelo Temporário (RECOMENDADO)

1. Implementar Python ETL
2. Testar standalone (execução manual)
3. Ativar cron Python (cada 5min)
4. **Manter Edge Functions rodando** (paralelo)
5. Monitorar por 48h
6. Validar que Python está correto
7. Desativar Edge Functions

### Rollback
```bash
# Desativar cron Python
rm /etc/cron.d/ceres-etl

# Edge Functions voltam automaticamente
# (cron existente no Supabase continua)
```

---

## Comandos de Execução

### Preparar VPS
```bash
ssh root@178.238.235.203

# Criar estrutura
mkdir -p /opt/etl/{connectors,transformers,config,logs}
mkdir -p /var/log/etl

# Setup Python
python3 -m venv /opt/etl/venv
source /opt/etl/venv/bin/activate
pip install -r requirements.txt
```

### Verificar Status
```bash
# Logs
tail -f /var/log/etl/ceres.log

# Status no banco
docker exec supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm \
  psql -U supabase_admin -d postgres \
  -c "SELECT * FROM mirror.sync_control ORDER BY last_sync_at DESC;"

# Últimos dados
docker exec supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm \
  psql -U supabase_admin -d postgres \
  -c "SELECT MAX(aco_dth_atualizacao) FROM mirror.crm_acoes;"
```

---

## Riscos e Mitigações

| Risco | Prob | Mitigação |
|-------|------|-----------|
| Perda de dados | Baixa | Paralelo 48h |
| Conexão SQL Server | Média | Retry com backoff |
| Memória estourar | Baixa | Batch 500 registros |
| Credenciais expostas | Baixa | chmod 600 no config.yaml |

---

## Timeline

| Fase | Atividade | Tempo |
|------|-----------|-------|
| 1 | Setup Python + dependencies | 30 min |
| 2 | Implementar connectors | 1h |
| 2 | Implementar ETL + transformações | 2h |
| 3 | Criar tabela sync_control | 15 min |
| 4 | Configurar cron + systemd | 30 min |
| 5 | Testes manuais | 1h |
| 5 | Transição paralela | 48h |

**Total: ~6 horas + 48h validação**

---

## Próxima Sessão

Para iniciar a implementação, basta dizer:

> **"Vamos implementar o ETL do Ceres BI"**

Este handoff será carregado automaticamente com todos os detalhes.

---

*Planejamento aprovado em: 2026-06-22*
*Plano completo em: `.claude/plans/cosmic-wibbling-spring.md`*