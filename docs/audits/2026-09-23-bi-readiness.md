# Auditoria de prontidão do BI — 2026-09-23

## Escopo

Este documento preserva o snapshot inicial somente leitura e, ao final, registra
o canário autenticado e a publicação progressiva executados após autorização
explícita. Credenciais não aparecem no relatório.

Host: `178.238.235.203` (`ceres-prod`, porta administrativa `2222`).

## Snapshot inicial da infraestrutura

- PostgreSQL 15.8 está saudável no serviço `supabase_supabase_db`.
- Existem `ceresbi_web` e `ceresbi_ai`.
- **Não existia `ceresbi_bi` em execução no início da auditoria.**
- A role dedicada ainda não estava provisionada naquele snapshot.
- A flag estava desligada por padrão.

## Estado final publicado

- Commit publicado e executado: `c5e5d3b18caa` (`c5e5d3b18caadeafe3fcb5687071f89d10eeabd5`).
- `ceresbi_web`, `ceresbi_ai` e `ceresbi_bi`: `1/1` no Swarm.
- `/api/bi/health`: `status=ok`, banco alcançável e JWT configurado.
- `ceres_bi_api`: `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`,
  `NOINHERIT`, `NOBYPASSRLS`, transação read-only e limites de timeout.
- Credenciais do BI montadas exclusivamente como Docker Secrets externos.
- Função `rpc_bi_authorize_user(uuid,text[])` instalada como `SECURITY DEFINER`
  com `search_path` fixo; a API não recebeu `BYPASSRLS` nem leitura ampla.
- `VITE_BI_API_ENABLED=true` na configuração privada de produção. Todas as
  leituras de BI passam pelo gateway: as RPCs allow-listadas e os dois caminhos
  legados (`rpc_negocios_crm` e `rpc_clientes_criticos_legacy`) agora usam a API
  FastAPI. O acesso direto ao Supabase continua apenas para operações
  administrativas de escrita e como fallback de rollback quando a flag é
  desligada.

### Composição server-side do painel

O painel passou a usar `GET /api/bi/painel/kpis`. A API valida os filtros,
autoriza o usuário, executa em paralelo as leituras PostgreSQL do período atual
e anterior e calcula no backend os indicadores derivados (tendência, ticket
médio e variações). O React recebe uma resposta semântica única; ele apenas
mantém o estado visual e renderiza cards, séries e tabelas.

Quando uma origem não retorna um campo, a resposta mantém compatibilidade de
shape, mas marca `dataQuality.status=partial`, lista os campos ausentes e emite
`BI_PANEL_DATA_INCOMPLETE`. Campo ausente não é tratado como zero válido.

## Medições diretas no banco

As medições abaixo foram executadas com `clock_timestamp()` e payload completo,
sem rede, autenticação HTTP, parsing ou renderização do navegador. Elas são
amostras pontuais, não p95/p99.

| Consulta | Janela | Tempo | Payload |
|---|---:|---:|---:|
| `rpc_acoes_bi_periodo` | 01/01/2026–22/09/2026 | 781 ms | 10.298 B |
| `rpc_acoes_funil_gestao_periodo` | 01/01/2026–22/09/2026 | 347 ms | 5.896 B |
| `rpc_acoes_mapa_oportunidades` | 01/01/2026–22/09/2026 | 399 ms | 214.453 B / 703 pinos |
| `rpc_desempenho_vendas_bi` | 01/01/2026–22/09/2026 | 1.317 ms | 41.042 B |
| `rpc_desempenho_vendas_bi` | ano completo de 2026 | 1.431 ms | 41.042 B |
| `rpc_resultados_negocios_bi` | 01/01/2023–22/09/2026 | 2.072 ms | 6.214 B |
| `rpc_resultados_negocios_bi` | ano completo de 2023–2026 | 2.070 ms | 6.214 B |

O fast path hash de `rpc_resultados_negocios_bi` está presente na produção e o
wrapper seleciona a variante anual/longa. Os históricos de `pg_stat_statements`
ainda misturam chamadas antigas e mostram máximos de até 9,7 s; isso não deve
ser tratado como latência atual sem separar as amostras por assinatura e
janela.

## Leitura de arquitetura

O PostgreSQL já faz joins e agregações server-side. A camada nova adiciona:

- catálogo allow-listado para as RPCs das dashboards;
- autenticação/autorização antes da execução;
- timeout, conexão read-only e telemetria;
- batch concorrente dos blocos principais de Ações;
- coalescência/single-flight e cache L1 de TTL curto;
- envelope parcial sem transformar erro em zero;
- benchmark HTTP autenticado para fechar p50/p95/p99.

Isso é uma fundação backend-first inspirada nos princípios do Power BI, não uma
prova de que a produção já foi migrada nem um substituto para read models.

## Evidência do canário autenticado

O token de teste foi gerado em memória a partir do JWT já configurado no
serviço, sem ser impresso. As chamadas abaixo percorreram HTTPS, Traefik,
FastAPI, autorização e PostgreSQL com a role dedicada:

| RPC / rota | amostras | sucesso | p95 HTTP | p95 API | cache hit | payload |
|---|---:|---:|---:|---:|---:|---:|
| `rpc_acoes_bi_periodo` | 20 | 20/20 | 1.240 s | 0.956 s | 95% | 9,6 KB |
| `rpc_acoes_funil_gestao_periodo` | 20 | 20/20 | 0.605 s | 0.382 s | 95% | 5,6 KB |
| `rpc_acoes_mapa_oportunidades` | 20 | 20/20 | 0.801 s | 0.562 s | 95% | 213 KB |
| `rpc_desempenho_vendas_bi` | 20 | 20/20 | 1.711 s | 1.535 s | 95% | 40 KB |
| `rpc_resultados_negocios_bi` | 20 | 20/20 | 1.505 s | 1.352 s | 95% | 6 KB |

Também passaram as rotas específicas de Ações (`core`, `detalhe`, `funil`,
`mapa` e `batch`), todas com envelope `ok`. A comparação estrutural do payload
de `rpc_acoes_bi_periodo` entre a API e a chamada direta PostgreSQL foi `PASS`.

O canário da composição nova retornou `status=ok` e
`dataQuality.status=ready` para `01/01/2026–20/09/2026`, com payload de 3,9 KB,
`query_ms≈1,33 s` e `ticketMedio` calculado no servidor. As leituras legadas
também passaram pelo gateway: `rpc_negocios_crm` em aproximadamente 242 ms
(191 KB) e `rpc_clientes_criticos_legacy` em aproximadamente 408 ms (62,6 KB),
ambas HTTP 200 com envelope `ok`.

Os testes de contrato retornaram: período inválido `422`, RPC não permitida
`404`, chamada anônima `401` e usuário inexistente `401`. Nenhuma falha HTTP ou
erro de envelope ocorreu no benchmark.

A validação de qualidade da release também passou: 19 testes Python do serviço
BI, 276 testes Vitest, `npx tsc --noEmit`, `ruff check bi-service` e o build
Vite de produção.

## Critérios e limitações residuais

Os critérios de gateway foram atendidos:

1. autorização antes da RPC;
2. paridade do canário;
3. benchmark autenticado com concorrência 4;
4. p95 abaixo de 3 s para todas as rotas medidas e nenhuma chamada acima de
   10 s;
5. flag global habilitada somente depois das evidências.

Ainda não foi executado um teste visual manual com a sessão do cliente nem um
teste de carga com dezenas de usuários reais. O próximo monitoramento deve
acompanhar p95/p99, 5xx, idade dos dados e cache hit em tráfego real. A flag pode
ser revertida para `false` em um novo deploy sem remover a role, os secrets ou
as RPCs legadas.
