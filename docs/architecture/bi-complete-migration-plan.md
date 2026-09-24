# Plano fechado — migração completa do Ceres BI para arquitetura Power BI-like

**Status:** implementação da borda semântica concluída; publicação progressiva
dos read models continua por dashboard
**Escopo:** todas as dashboards BI e todas as RPCs usadas por elas
**Objetivo:** substituir as RPCs pesadas como caminho normal de leitura, sem
alterar o resultado visual ou os números

## 1. Regra de conclusão

“100% migrado” só será declarado quando todos os itens abaixo forem verdadeiros:

- nenhuma página BI em produção depender de consulta Supabase direta;
- nenhuma página depender de uma RPC pesada como fonte principal quando existir
  read model equivalente;
- cada indicador tiver contrato semântico versionado;
- cada read model tiver refresh, versão, frescor, reconciliação e fallback de
  canário;
- o frontend receber apenas cards, séries agregadas, rankings limitados e
  tabelas paginadas;
- paridade numérica for comprovada contra a consulta atual;
- p50, p95 e p99 forem medidos com carga fria, quente e concorrente;
- p95 normal ficar abaixo de 3 s e p95 pesado abaixo de 5 s;
- nenhuma consulta normal depender de timeout elevado;
- rollback por dashboard puder ser feito sem alterar regra de negócio.

## 2. Estado de partida confirmado

- 11 páginas: Ações, Admin, Comercial, Desempenho, ETL Monitor, Inteligência,
  Painel, Pedidos, Produtos, Operacional e Serviços.
- 48 RPCs no catálogo allow-listado do FastAPI.
- O caminho de produção é frontend → FastAPI → PostgreSQL.
- Existem quatro read models físicos: `acoes_daily`, `negocios_daily`,
  `pedidos_daily` e `servicos_daily`.
- Os read models ainda não são a fonte principal de todas as telas.
- O maior custo atual é `rpc_desempenho_vendas_bi` (~724–760 ms nos eventos
  recentes); `painel.kpis` já chegou a ~1,04 s.
- O cache atual é L1, process-local, com TTL curto; não há invalidação por
  publicação de snapshot nem cache compartilhado.
- `query_ms` e `api_ms` existem, mas linhas lidas, `db_ms`, temporários e
  p95/p99 de carga real ainda não estão fechados.

## 3. Arquitetura alvo

```text
Origem
  ↓
ETL Python + staging + reconciliação retroativa
  ↓
PostgreSQL: fatos, dimensões e tabelas canônicas
  ↓
Read models diários/mensais + snapshots semânticos
  ↓
FastAPI: contrato, autorização, filtros, cache, paginação e métricas
  ↓
React: estado visual, gráficos, tabelas paginadas e mensagens de frescor
```

Estratégia de armazenamento:

- **Import:** históricos e agregações nos read models.
- **DirectQuery:** janela quente e drill-down paginado no PostgreSQL.
- **Hybrid:** histórico publicado + janela recente direta.
- **Dual:** dimensões compartilhadas usadas tanto no caminho agregado quanto
  no caminho quente.
- **Fallback de canário:** permitido somente durante a migração; removido da
  configuração de produção após a paridade.

Referências conceituais: [DirectQuery](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-directquery-about),
[modelos compostos](https://learn.microsoft.com/en-us/power-bi/guidance/composite-model-guidance)
e [refresh incremental/híbrido](https://learn.microsoft.com/en-us/power-bi/connect-data/incremental-refresh-overview).

## 4. Matriz de substituição

| Dashboard | Consultas atuais | Read model/contrato novo | Ordem |
| --- | --- | --- | --- |
| Ações | core, funil, mapa, detalhe, termômetro, pedidos ganhos/perdidos | `dashboard_acoes_daily`, `dashboard_acoes_monthly`, mapa paginado e detalhe DirectQuery | 1 |
| Desempenho | `rpc_desempenho_vendas_bi`, pedidos pendentes | `dashboard_desempenho_monthly`, `dashboard_desempenho_daily`, listas paginadas | 2 |
| Painel | KPIs compostos de negócios, ações e operacional, GPO 12m | `dashboard_painel_daily`, `dashboard_painel_monthly`, evolução GPO snapshot | 3 |
| Comercial/Negócios | negócios, resultados, ranking, evolução, CRM | `dashboard_negocios_daily/monthly`, dimensões compartilhadas | 4 |
| Pedidos | pedidos, esteira e rankings | `dashboard_pedidos_daily/monthly` | 5 |
| Serviços/Operacional | serviços, produtividade e atendimento | `dashboard_servicos_daily`, `dashboard_operacional_daily` | 6 |
| Produtos | parque, renovação e produtos | `dashboard_produtos_snapshot`, drill-down paginado | 7 |
| Admin | carteira e clientes críticos | `dashboard_admin_daily`, listas limitadas | 8 |
| Inteligência | esforço, sinais e análises | snapshots específicos após estabilização dos fatos | 9 |
| ETL Monitor | status/logs de execução | leitura operacional direta, sem agregação BI | 10 |

## 5. Fases de execução

### Fase 0 — congelamento e contrato de referência

1. Congelar a saída visual atual como golden dataset.
2. Catalogar para cada página: hook, RPC, parâmetros, tabelas, filtros,
   medidas, payload, ordenação e paginação.
3. Salvar exemplos de resposta sem PII para todos os cenários: mês, ano,
   vendedor, cidade, múltiplos filtros e vazio.
4. Definir o grão e a regra de cada indicador.

**Saída:** catálogo versionado e testes de paridade preparados.

### Fase 1 — fatos, dimensões e reconciliação

1. Padronizar dimensões `dim_date`, vendedor, cidade, filial, cliente, status,
   funil, produto e origem.
2. Definir fatos de ações, negócios, pedidos, serviços e vendas.
3. Fazer o ETL Python carregar staging e fatos canônicos.
4. Reconciliar pelo menos os últimos 90 dias em toda execução; executar
   reconciliação mensal histórica em job separado.
5. Registrar contagem, soma financeira, IDs ausentes, exclusões e alterações
   retroativas.

**Gate:** nenhum read model é publicado se a reconciliação falhar.

### Fase 2 — read models e snapshots

Para cada domínio:

1. Criar tabela diária no grão usado pelos filtros.
2. Criar tabela mensal para séries e KPIs históricos.
3. Criar índices alinhados aos filtros reais, depois de `EXPLAIN (ANALYZE,
   BUFFERS)`.
4. Atualizar somente a janela alterada e republicar atomicamente a versão.
5. Manter o snapshot anterior disponível durante o refresh.
6. Publicar `snapshot_at`, versão, período coberto, status e idade.

**Gate:** refresh repetível, idempotente e sem tabela parcialmente publicada.

### Fase 3 — substituição da RPC de Desempenho

Esta é a primeira substituição obrigatória, não apenas otimização da RPC.

1. Separar as medidas da função atual em fatos agregados: vendas, perdas,
   origens, motivos, tipos de cliente, cidades, produtos, vendedores e bancos.
2. Criar `dashboard_desempenho_monthly` e `dashboard_desempenho_daily`.
3. Criar endpoint semântico `/api/bi/desempenho` com o mesmo DTO visual atual.
4. Servir histórico do snapshot e mês atual do fato quente.
5. Comparar cada chave do JSON antigo e novo por período/filtro.
6. Habilitar canário para um usuário autorizado.
7. Medir antes/depois; só então remover a RPC do caminho normal.

**Aceite:** paridade total, p95 pesado < 5 s e nenhum aumento de payload.

### Fase 4 — substituição de Painel e Ações

1. Painel: materializar KPIs compostos e GPO 12m; não executar sete RPCs em
   cada abertura.
2. Ações: usar daily/monthly para cards e gráficos; manter mapa e detalhe
   como DirectQuery paginado por filtro/viewport.
3. Consolidar apenas consultas que têm o mesmo grão; não criar uma RPC gigante.
4. Isolar erro de mapa, detalhe ou gráfico sem invalidar os cards.

**Aceite:** mesma saída visual, menor fan-out e p95 abaixo da meta.

### Fase 5 — demais dashboards

Migrar na ordem da matriz: Negócios, Pedidos, Serviços/Operacional, Produtos,
Admin e Inteligência. Cada dashboard passa individualmente por:

1. adapter do read model;
2. endpoint semântico;
3. paridade;
4. carga fria/quente;
5. canário;
6. remoção do caminho RPC principal.

### Fase 6 — frontend e query reduction

1. Aplicar filtros pesados somente no botão “Aplicar”.
2. Debounce em busca textual.
3. Manter dados anteriores enquanto o novo snapshot carrega.
4. Paginar e virtualizar tabelas.
5. Remover agregações financeiras no React.
6. Exibir `snapshot_at`, `is_stale` e mensagens por bloco.
7. Não fazer retry automático de RPC pesada.

### Fase 7 — cache e observabilidade

1. Cache compartilhado por dashboard, tenant, usuário quando necessário e
   filtros normalizados.
2. Invalidar por versão do ETL, não apenas por TTL.
3. Medir `db_ms`, `query_ms`, `api_ms`, `frontend_ms`, bytes, linhas lidas,
   linhas retornadas, temporários, cache hit e snapshot age.
4. Criar alarmes para erro, p95, payload, snapshot atrasado e divergência.

### Fase 8 — carga, publicação e encerramento

Executar cenários sem filtro, mês, ano, vendedor, cidade, múltiplos filtros,
troca rápida, 2 usuários, 10 usuários, cache frio, cache quente, refresh em
andamento e falha parcial.

Publicar uma dashboard por vez:

1. testes locais;
2. benchmark;
3. review/security/QA;
4. deploy de canário;
5. validação de dados;
6. medição em produção;
7. ativação progressiva;
8. remoção do fallback somente após aceite.

## 6. Rollback

- Cada dashboard terá flag independente.
- O snapshot anterior nunca será apagado durante refresh.
- Falha de paridade reverte para a consulta canônica apenas durante o canário.
- Após o aceite, rollback será para a versão anterior do read model/API, não
  para acesso direto do navegador ao Supabase.

## 7. Critério final de aceite

A migração só será encerrada quando existir uma matriz preenchida para as 11
dashboards com: fonte principal, read model, contrato, paridade, p50/p95/p99,
payload, cache hit, idade do snapshot, smoke de erro e rollback testado.

## 8. Execução realizada nesta release

- O caminho de produção do frontend permanece no FastAPI e agora usa
  `POST /api/bi/v1/query/{rpc_name}` para todo o catálogo; `/api/bi/rpc` fica
  como rota de compatibilidade e rollback.
- Desempenho ganhou `POST /api/bi/v1/desempenho`, com snapshot quente e
  fallback DirectQuery sem mudança do DTO visual.
- Painel ganhou `GET /api/bi/v1/painel/kpis`, mantendo composição server-side e
  o envelope parcial quando um bloco falha.
- A tabela `bi.semantic_snapshots` e o worker publicam versões/frescor sem
  bloquear o usuário durante o refresh.
- O frontend continua tratando envelopes `ok`, `partial` e `error`; dados
  ausentes não são preenchidos com zero e o erro de um bloco não derruba os
  demais.

Essa execução fecha a migração de transporte e contrato para as dashboards. A
matriz de read models específicos por indicador permanece uma etapa de
otimização incremental; os caminhos sem snapshot usam DirectQuery parametrizado
no PostgreSQL, não consulta ou cálculo no navegador.
