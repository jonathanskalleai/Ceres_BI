# Auditoria de prontidão do BI — 2026-09-23

## Escopo

Verificação somente leitura do PostgreSQL de produção e do estado do gateway
FastAPI. Nenhuma migration, role, serviço ou dado foi alterado nesta medição.

Host: `178.238.235.203` (`ceres-prod`, porta administrativa `2222`).

## Estado da infraestrutura

- PostgreSQL 15.8 está saudável no serviço `supabase_supabase_db`.
- Existem `ceresbi_web` e `ceresbi_ai`.
- **Não existe `ceresbi_bi` em execução.**
- A role dedicada `ceres_bi_api` ainda não foi provisionada.
- A flag `VITE_BI_API_ENABLED` permanece desligada por padrão.
- Portanto, o novo caminho FastAPI ainda não é o caminho de produção.

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

## Bloqueio de go-live

O próximo passo exige provisionar uma role PostgreSQL read-only exclusiva,
armazenar sua credencial no mecanismo seguro da stack e criar uma réplica
canário `ceresbi_bi`. Sem essa credencial não é seguro inventar uma URL de banco,
usar `postgres` ou publicar o serviço com privilégios excessivos.

Após o provisionamento, o aceite é:

1. 401 sem JWT e 403 sem permissão;
2. paridade mensal/anual com as RPCs legadas;
3. benchmark autenticado com 10 sessões concorrentes;
4. p95 agregado abaixo de 1,5 s e nenhuma chamada acima de 10 s;
5. só então habilitar gradualmente `VITE_BI_API_ENABLED`.
