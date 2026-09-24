# Baseline operacional do BI — 2026-09-24

## Escopo

Leitura de eventos `bi_query` do serviço em produção e abertura das telas
`Ações` e `Desempenho de Vendas` com cache frio. A amostra contém 55 eventos;
ela é operacional e ainda não representa um p95 estatístico por rota (há menos
de 20 amostras em cada grupo).

## Resultado observado

| Tela/rota | Maior `query_ms` observado | Payload máximo | Estado |
| --- | ---: | ---: | --- |
| Painel/KPIs | 1.039 ms | 3,5 KB | OK |
| Desempenho de Vendas | 854 ms | 10,5 KB | OK |
| Ações — mapa | 418 ms | 20,1 KB | OK |
| Ações — lote | 414 ms | 13,0 KB | OK |
| Ações — termômetro | 378 ms | 16,9 KB | OK |
| Ações — detalhe | 270 ms | 35,4 KB | OK |
| Produtos | 89 ms | 1,6 KB | OK |
| Pedidos | 215 ms | 2,9 KB | OK |
| Serviços | 66 ms | 0,9 KB | OK |

Todos os eventos após a publicação `4d8cf3a75af4` ficaram com `status=ok` nas
rotas exercitadas. O único erro encontrado no recorte foi anterior à publicação:
`rpc_evolucao_ganhos_perdidos_12m` falhou ao desserializar uma função
table-valued; a correção passou a usar `SELECT * FROM public.func(...)` e o
mesmo carregamento seguinte retornou 1.633 bytes com sucesso.

## Diagnóstico do maior custo

`rpc_desempenho_vendas_bi` executou em 721,5 ms no `EXPLAIN (ANALYZE,
BUFFERS)` e consumiu 7.386 buffers compartilhados, sem leitura de disco. O
gargalo atual é CPU/CTE/deduplicação/agregação JSON da função, não um índice
ausente ou I/O. Reescrever a SQL sem teste de paridade seria arriscado.

## Decisão de engenharia

1. Manter as RPCs atuais como caminho de compatibilidade e fallback.
2. Criar um read model/snapshot específico para Desempenho de Vendas, com
   atualização assíncrona e janela de reconciliação.
3. Comparar snapshot e RPC antiga por período, vendedor, cidade e funil antes
   de trocar o endpoint.
4. Só promover a nova leitura após benchmark frio/quente e teste de carga.

O banco já possui a base de read models (`bi.*_daily`, manifesto e worker), mas
ela ainda não cobre todos os indicadores de Desempenho e não substitui as RPCs
das telas. Portanto, a arquitetura está parcialmente no formato Import/
Composite: o frontend recebe resultados agregados e há cache/read models, mas o
principal caminho de Desempenho ainda recalcula a RPC completa a cada abertura.

## Próximo marco

Implementar `desempenho` no read model com contrato versionado, fallback
automático para a RPC e evidência de paridade. A meta de aceite permanece p95
normal < 3 s, p95 pesado < 5 s, sem timeout e sem divergência numérica.
