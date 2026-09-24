# Baseline de performance do BI

Este runbook descreve a coleta local/offline do baseline do Ceres BI. Os eventos
`bi_query` são linhas JSON estruturadas emitidas pelo gateway e pelo transporte
do navegador. Eles não contêm token, SQL, valores de filtros, PII ou payload de
negócio; `filters_hash` é apenas um agrupador não reversível.

## Coleta

O gateway registra `query_ms` ao redor da RPC e `api_ms` no handler. O navegador
mede `frontend_ms` do início da chamada até o envelope ser parseado. O campo
`payload_bytes` é o tamanho UTF-8 do envelope JSON no gateway.

O coletor deve preservar uma linha por evento. Não agregue nem reescreva as
linhas antes do baseline. Em produção, encaminhe stdout para o coletor de logs
da plataforma; não grave filtros, cabeçalhos Authorization ou SQL.

## Agregação

```bash
python ops/bi_baseline.py /tmp/ceres-bi-events.jsonl > /tmp/ceres-bi-baseline.json
cat /tmp/ceres-bi-events.csv | python ops/bi_baseline.py - --format csv
```

Para validar um canário autenticado ponta a ponta, use o benchmark HTTP. O
token deve vir somente da variável de ambiente e nunca é impresso:

```bash
BI_BENCHMARK_TOKEN="$TOKEN" \
  python ops/bi_gateway_benchmark.py \
  --url https://ceresbi-bi-canary.internal \
  --rpc rpc_desempenho_vendas_bi \
  --params '{"p_from":"2026-01-01","p_to":"2026-12-31","p_funis":null}' \
  --requests 20 --concurrency 4
```

O relatório mostra latência de rede (`wall_ms`), latência do banco/API,
payload, status, códigos de erro e taxa de `cache_hit`. O script retorna código
2 quando existe erro HTTP, erro de envelope ou falha de transporte. Ele não
altera dados nem ativa a feature flag.

Para exercitar filtros variados em várias telas, use o cenário versionado:

```bash
BI_BENCHMARK_TOKEN="$TOKEN" \
  python ops/bi_gateway_scenario_benchmark.py \
  --url https://ceresbi.vouxconsultoria.com.br \
  --scenario-file ops/bi_gateway_scenarios.json \
  --requests 64 --concurrency 16
```

Esse runner distribui as requisições entre cenários e agrupa o resultado por
RPC e por label, sem imprimir os parâmetros. Ele é o teste adequado para
detectar saturação do pool que um benchmark repetindo uma única chave de cache
não revela.

O agregador agrupa por `dashboard_id`, `route`, `endpoint` e `case` (`monthly`,
`annual` ou `custom`). Ele calcula p50 sempre que houver amostras e só publica
p95/p99 quando o grupo tiver pelo menos 20 amostras. Percentis usam interpolação
linear. `error_rate` e `timeout_rate` são separados; timeout é status `timeout`
ou `error_code` contendo `TIMEOUT`. Quando o evento possui `cache_hit`, o grupo
também expõe `cache_hit_rate`; eventos legados sem esse campo não entram no
denominador.

Entrada vazia é válida e produz grupos vazios. JSON/CSV inválido retorna código
de saída 2 e uma mensagem curta em stderr; nenhum evento parcial é publicado.

## Inventário e baseline mínimo

O catálogo em `docs/data/bi-dashboard-inventory.json` é a fonte de escopo. Para
cada rota liberada, coletar ao menos 20 amostras mensais e 20 anuais antes de
tratar p95/p99 como representativos. Rotas sem gateway devem continuar sendo
medidas no transporte legado quando possível e permanecem marcadas como
`legacy_pending`.

Metas de engenharia:

- dashboard normal: p95 abaixo de 3 s;
- dashboard pesada: p95 abaixo de 5 s;
- payload padrão preferencialmente abaixo de 200 KB;
- nenhuma consulta normal dependente de timeout elevado;
- erro e timeout analisados separadamente.

O gateway também possui `BI_POOL_WAIT_TIMEOUT_MS` (padrão `10000`). Quando o
pool estiver cheio, a requisição aguarda uma conexão por esse intervalo em vez
de falhar imediatamente em `PoolError`; se o limite for atingido, a falha é
registrada e permanece explícita no envelope/health, sem fabricar dados.

## Segurança e privacidade

Não inclua `Authorization`, JWT, e-mail, telefone, nomes, SQL, parâmetros de
filtro ou dados do dashboard nos eventos. O `request_id` aceita apenas caracteres
seguros e no máximo 128 caracteres; valores inválidos são substituídos por UUID.

O baseline é diagnóstico. Ele não autoriza alterar SQL, criar índices ou ativar
a feature flag. Qualquer otimização deve passar por paridade e benchmark antes
de publicação.
