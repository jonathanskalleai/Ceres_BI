---
feature: bi-pool-resilience
updated_at: 2026-09-24T11:25:00Z
updated_by: scribe (pool queue + scenario benchmark)
status: active
---

# BI — resiliência do pool e benchmark concorrente

**Propósito:** evitar HTTP 503 quando várias telas consultam o BI ao mesmo tempo. O pool agora enfileira aquisições por até 10s, em vez de falhar imediatamente quando as oito conexões estão ocupadas.

## Entry Points
- `bi-service/db.py` — semáforo e timeout de espera ao adquirir conexão.
- `bi-service/config.py` — `pool_wait_timeout_ms` / `BI_POOL_WAIT_TIMEOUT_MS`.
- `ops/bi_gateway_scenario_benchmark.py` — carga autenticada com cenários variados.
- `ops/bi_gateway_scenarios.json` — 16 cenários cobrindo as dashboards.

## Dependências internas
- `docker-stack.yml` e `deploy.sh` — propagam o limite para o serviço BI.
- `bi-service/README.md` e `docs/runbooks/bi-baseline.md` — operação e diagnóstico.

## Banco
- Pool PostgreSQL compartilhado pelo gateway; nenhuma tabela ou RPC foi removida.
- O limite atual em produção é `BI_DATABASE_POOL_MAX=8` e a espera é 10s.

## Como alterar com segurança
1. Rode `python ops/bi_gateway_scenario_benchmark.py --help` e o benchmark com token de teste.
2. Valide 0 respostas 503, envelope `ok` e paridade dos números das telas.
3. Não aumente timeout para esconder SQL lento; `Resultados` e `Desempenho` históricos ainda são candidatos a read model/SQL dedicado.
4. Rode os testes Python, Vitest, typecheck, build e `ruff` antes do deploy.

## Riscos / acoplamentos
- Pool cheio agora cria fila; p95 de carga mista pode crescer antes de retornar, embora não quebre a tela.
- O benchmark não substitui a análise SQL individual nem confirma que todos os RPCs pesados estão abaixo de 3s.
