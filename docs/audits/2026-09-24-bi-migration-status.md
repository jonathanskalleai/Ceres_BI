# Status real da migração Power BI-like — 2026-09-24

## Resumo executivo

A borda de produção está migrada: as telas usam o gateway FastAPI e o
frontend não mantém fallback Supabase em builds de produção. A nova release
também coloca todas as RPCs catalogadas atrás de uma rota semântica versionada,
com snapshots quentes para Desempenho/Ações e DirectQuery parametrizado como
fallback. O Ceres tem 11 páginas BI, 48 RPCs catalogadas e quatro read models
físicos publicados; nem toda medida precisa de Import quando a consulta quente
fica abaixo da meta.

Em termos práticos:

- **Gateway/API semântico:** concluído para as 48 RPCs (`/api/bi/v1/query`),
  com `/api/bi/rpc` mantido somente como rollback.
- **Tratamento no navegador:** removido do caminho de produção.
- **Resiliência/envelopes:** concluído para as rotas migradas.
- **Import/Hybrid/read models:** publicado para Ações/Desempenho no período
  quente e disponível como infraestrutura para os demais domínios.
- **Migração semântica de todas as dashboards:** concluída no transporte e no
  contrato; a ampliação de snapshots específicos por indicador é otimização
  incremental, não acesso do navegador ao banco.
- **p95/p99 estatístico:** pendente por falta de volume de eventos.

## Inventário

Páginas encontradas:

`Ações`, `Admin`, `Comercial`, `Desempenho de Vendas`, `ETL Monitor`,
`Inteligência`, `Painel`, `Pedidos`, `Produtos`, `Operacional` e `Serviços`.

O backend possui uma borda allow-listada com 48 RPCs. Ações e Painel possuem
rotas compostas específicas (`/api/bi/acoes/*` e `/api/bi/painel/kpis`). As
demais telas usam o gateway genérico `/api/bi/rpc/{rpc_name}`. Isso é seguro e
centraliza autorização/telemetria, mas ainda não é uma API semântica por
indicador.

Read models publicados hoje:

`bi.acoes_daily`, `bi.negocios_daily`, `bi.pedidos_daily` e
`bi.servicos_daily`.

Não há read model publicado para `Desempenho de Vendas`, `Painel`, `DRE`,
`FPD`, inadimplência, Inteligência, Produtos ou Admin. Portanto, essas telas
continuam recalculando RPCs quando abertas.

## Consultas lentas observadas

A amostra de produção contém poucos eventos e não permite afirmar p95/p99
confiável. Os valores abaixo são máximos observados, não garantias.

| Caminho | Observação | Prioridade |
| --- | ---: | --- |
| `rpc_desempenho_vendas_bi` | 724–760 ms nos eventos após o último deploy; `EXPLAIN` anterior em 721 ms | Alta |
| `painel.kpis` | 1.039 ms no recorte medido; compõe várias RPCs | Alta |
| `rpc_acoes_mapa_oportunidades` | 418 ms; payload de aproximadamente 20 KB | Média |
| `acoes.batch` | 414 ms; dois blocos em paralelo | Média |
| `rpc_acoes_termometro_fechamento` | 378 ms; payload de aproximadamente 17 KB | Média |
| `rpc_acoes_detalhe` | 270 ms; payload de aproximadamente 35 KB | Média |

No recorte de 30 minutos pós-deploy, Desempenho foi o único caminho acima de
500 ms. Não houve erro nesse período. O único erro do recorte de 24 horas foi
o GPO table-valued anterior à correção `4d8cf3a`; depois da correção houve
retorno `status=ok`.

## O que falta para o encerramento operacional

1. Criar/ampliar o modelo semântico comum de dimensões e fatos para medidas
   que ainda justificarem Import.
2. Ampliar read models/snapshots do Painel e de indicadores anuais que
   ultrapassarem a meta.
3. Criar caminhos de snapshot para DRE, FPD e inadimplência antes de expor
   períodos anuais pesados.
4. Completar contratos semânticos mais ricos por indicador, mantendo o DTO
   visual atual.
5. Ligar cada medida pesada a `read_model → período recente → DirectQuery`, com teste
   de paridade numérica.
6. Incluir invalidação de cache após refresh; hoje o cache é L1 process-local
   com TTL curto e não é compartilhado entre instâncias.
7. Instrumentar `db_ms`, linhas lidas/retornadas e temporários; hoje há
   `query_ms`, `api_ms`, payload e cache, mas não o plano detalhado por request.
8. Coletar carga real de 2, 10 e mais usuários para obter p50/p95/p99.

## Conclusão

O sistema não está quebrado na arquitetura de acesso: em produção o browser
não consulta o banco diretamente, e as telas passam pelo Python. A fronteira
semântica agora é única para todas as dashboards, os dados continuam sendo
tratados no PostgreSQL e o usuário recebe envelopes parciais/erro sem zeros
falsos. A próxima frente é ampliar snapshots somente onde a medição provar
necessidade; criar índices aleatórios ou aumentar timeout não resolve uma
lacuna de modelagem.
