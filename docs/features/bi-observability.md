---
feature: bi-observability
updated_at: 2026-09-24T11:58:00Z
updated_by: scribe (haiku)
status: active
---

# BI — observabilidade do gateway

**Propósito:** publicar eventos `bi_query` no stdout do serviço para medir
latência, cache, payload e falhas sem expor filtros, SQL, tokens ou PII.

## Entry Points
- `bi-service/logging_config.py` — configura o logger `ceresbi.bi`.
- `bi-service/observability.py` — emite eventos redigidos.
- `bi-service/main.py` — inicializa o logging no boot.

## Dependências internas
- `docker-stack.yml` e `deploy.sh` — propagam `BI_LOG_LEVEL` (padrão `INFO`).
- `bi-service/tests/test_logging_config.py` — valida níveis permitidos.

## Como alterar com segurança
1. Nunca adicionar filtros, payloads, credenciais ou identificadores ao evento.
2. Manter `INFO` em produção para medir o gateway; `WARNING` perde métricas.
3. Rodar pytest/ruff, Vitest, typecheck, build e validar `event=bi_query` no log.

## Smoke
- `PYTHONPATH=bi-service pytest -q bi-service/tests` deve passar.
- Após deploy, uma requisição BI deve gerar JSON com `event=bi_query` no log,
  e `/health` deve continuar 200.

## Riscos / acoplamentos
- `INFO` aumenta volume de logs; manter retenção/rotação do Docker sob controle.
- Métricas confirmam gargalos, mas não substituem `EXPLAIN (ANALYZE, BUFFERS)`.
