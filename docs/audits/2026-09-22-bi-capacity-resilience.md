# Auditoria de capacidade, performance e resiliência do Ceres BI

**Data:** 22/09/2026

**Escopo:** leitura do código local, reprodução autenticada no BI e inspeção
read-only da VPS/PostgreSQL.
**Produção observada:** `178.238.235.203`, branch
`release/bi-consolidacao-fase-1`, SHA `ead1742538d2`.

## Veredito executivo

O congelamento relatado pelo cliente é real e tem mais de uma causa. Não é
correto tratar isso como “uma RPC lenta” ou como um problema que se resolve
apenas mudando o host do Supabase.

Há quatro camadas que se combinam:

1. **Fan-out excessivo no navegador.** A troca de um filtro dispara muitas
   consultas independentes ao mesmo tempo. Ações abre aproximadamente 11 RPCs
   na primeira onda e o Painel pode chegar a 10–14 requisições entre período
   atual, comparação, serviços, clientes e GPO.
2. **Payload e renderização acima do necessário.** A visão anual de Desempenho
   monta 50 linhas com produto e observação de texto livre, enquanto Ações
   monta o mapa com 702 pinos. O banco termina em cerca de 1 s, mas o browser
   ainda precisa transformar, medir e pintar milhares de nós.
3. **Contratos de resposta frágeis.** Muitos serviços fazem cast de JSON sem
   validação de runtime e trocam erro/ausência por `0` ou `[]`. Um payload
   parcial pode exibir números falsos ou lançar uma exceção durante o render.
4. **Falha de isolamento.** O `ErrorBoundary` atual envolve a rota inteira,
   não cada cartão. Um gráfico ou tabela defeituoso pode derrubar a página
   inteira. Também reproduzi recargas em que a tela ficou somente com o shell
   enquanto o perfil/permissões expirava o timeout.
5. **Contrato ambíguo no gateway.** A produção mantém dois overloads da RPC de
   Desempenho com defaults; uma chamada legítima sem `p_funis` recebe PGRST203
   antes mesmo de executar SQL.

**Conclusão:** a prioridade é reduzir o trabalho concorrente e o volume
renderizado, corrigir o contrato da RPC, validar respostas na fronteira e
isolar cada widget. A troca de transporte (proxy same-origin) é uma melhoria
útil, mas não é a causa raiz única nem suficiente.

## Evidência de reprodução no navegador

Medições feitas na aba autenticada do BI, sem alterar dados. Os valores são
fotografias de uma sessão real, não um benchmark formal de p95.

### Desempenho: mensal versus anual

| Estado | Nós DOM | HTML serializado | Texto visível | Tabelas | Linhas |
|---|---:|---:|---:|---:|---:|
| Mensal estável | 1.142 | 172.624 B | 12.186 B | 6 | 45 |
| Anual (01/01–22/09) | 3.516 | 541.598 B | 43.703 B | 6 | 258 |

Na visão anual, a tabela de pedidos renderiza a primeira página inteira (50
linhas) e inclui as colunas de produto e **observação do negócio** sem truncar
o conteúdo. Isso explica o salto de aproximadamente 3× no DOM e o custo de
layout/medição mesmo quando a RPC principal já terminou.

### Rotas principais após 7–10 s

| Rota | Nós DOM | HTML | Tabelas/linhas | Classificação |
|---|---:|---:|---:|---|
| `/bi/acoes` | 4.349 | 580.882 B | 5 / 110 | crítica: fan-out + mapa + render |
| `/bi/desempenho` anual | 3.516 | 541.598 B | 6 / 258 | crítica: drill-down/texto |
| `/bi/comercial` | 1.424 | 195.745 B | 2 / 13 | média |
| `/bi/painel` | 746 | 120.914 B | 0 / 0 | média: muitas RPCs, pouca tabela |
| `/bi/servicos` | 763 | 99.520 B | 0 / 0 | média: erro mascarado |
| `/bi/operacional` | 737 | 96.203 B | 0 / 0 | baixa/média |
| `/bi/pedidos` | 605 | 88.076 B | 0 / 0 | média: defaults silenciosos |
| `/bi/produtos` | 453 | 69.313 B | 0 / 0 | baixa nesta amostra |
| `/bi/inteligencia` | 427 | 62.763 B | 0 / 0 | média: vários blocos vazios |
| `/bi/admin` | 411 | 66.036 B | 0 / 0 | média: depende de auth/permissões |
| `/bi/etl-monitor` | 338 | 59.400 B | 1 / 13 | baixa nesta amostra |

### Reprodução do “F5 fica carregando”

Em três recargas consecutivas de `/bi/desempenho`:

- a primeira carregou a tela em até 7 s;
- a segunda e a terceira permaneceram, após 7 s, com somente 55 nós DOM e o
  título “Desempenho de Vendas” — sem filtros, cards ou gráficos;
- o console registrou `Failed to refresh profile: Tempo esgotado ao carregar
  seu perfil` e também `Failed to load profile after session initialization`;
- após mais aproximadamente 15 s, o conteúdo apareceu.

O endpoint de perfil, isolado, respondeu em cerca de 0,67–0,70 s em cinco
amostras de `curl`. Portanto, não há evidência de que a tabela `profiles`
esteja permanentemente lenta. O sintoma aponta para concorrência/filas de
requests e para o fato de a inicialização de permissões/auth não possuir um
estado de degradação claramente visível.

## Medição das RPCs na produção

As chamadas abaixo foram executadas com `EXPLAIN (ANALYZE, BUFFERS)` ou com
consulta de tamanho do JSON. Datas representam o recorte anual corrente usado
na reprodução (01/01/2026–22/09/2026), salvo indicação contrária.

| RPC | Execução observada | Payload | Cardinalidade/observação |
|---|---:|---:|---|
| `rpc_desempenho_vendas_bi` | 1.138 ms | 47.609 B | 12 meses, 16 vendedores |
| `rpc_acoes_pedidos_ganhos` | 665 ms | 35.852 B | 50 linhas, total 206 |
| `rpc_acoes_negocios_perdidos` | 177 ms | 25.808 B | 50 linhas, total 150 |
| `rpc_pedidos_pendentes_esteira` | 13 ms | 2.336 B | 6 itens neste recorte |
| `rpc_acoes_bi_periodo` | 876 ms | 10.310 B | 9 meses, 15 clientes |
| `rpc_acoes_funil_gestao_periodo` | 395 ms | 5.895 B | 36 itens de ranking |
| `rpc_acoes_mapa_oportunidades` | 627 ms | **231.669 B** | 702 pinos, 961 oportunidades |
| `rpc_resultados_negocios_bi` (YTD) | 1.187 ms | ~6 KB | caminho anual especializado |
| `rpc_resultados_negocios_bi` (01/2023–22/09/2026) | **8.739 ms** | ~6 KB | 3.968 blocos temporários lidos |
| `rpc_resultados_negocios_bi` (mês) | 1.822 ms | ~6 KB | caminho core |

O payload do mapa é o maior item agregado medido, embora sua execução de banco
seja sub-segundo. O gargalo percebido pelo usuário é a soma de consultas,
serialização, transferência e renderização.

### O que o plano mostra

As funções de resultados chamam internamente `rpc_acoes_bi_periodo` e
`rpc_acoes_funil_gestao_periodo`. Os planos observados mostram recomputação de
CTEs, `DISTINCT ON` com ordenação, agregação de produtos e chamadas repetidas
de `mirror.fn_cli_cidade`. A base é pequena hoje (aproximadamente 42 mil ações,
5,1 mil negócios e 1,7 mil pedidos), mas a forma da consulta cresce mal com
janela e concorrência.

O salto de 1,2 s para 8,7–9,3 s em janela de vários anos é especialmente
perigoso para qualquer tela que permita “ano completo” ou histórico sem limite.
O problema não é falta simples de índice: já existem índices de data,
negócio, vendedor e expressões `::date`. É necessário comparar planos após
reescrever a consulta para filtrar cedo e não recomputar o mesmo conjunto em
RPCs aninhadas.

### Achado adicional reproduzido na VPS: overloads ambíguos

Na inspeção read-only de `178.238.235.203` foram encontradas duas assinaturas
instaladas de `public.rpc_desempenho_vendas_bi`:

- a legada, com 10 argumentos, sem `p_funis` (`text` no último argumento);
- a vigente, com 11 argumentos, incluindo `p_funis text[]`.

Ambas possuem parâmetros opcionais. A chamada nominal usada quando nenhum funil
é selecionado — somente `p_from` e `p_to` — foi reproduzida e falhou com
`function ... is not unique` (o erro que o PostgREST expõe como conflito de
overload/PGRST203). A mesma função, quando recebe explicitamente
`p_funis => ARRAY['VENDAS']::text[]`, respondeu normalmente.

A reprodução também foi feita pelo endpoint HTTP de produção: o corpo sem
`p_funis` retornou HTTP 300/PGRST203, enquanto os corpos com
`"p_funis": null` e com uma lista retornaram HTTP 200. Isso confirma que o
problema atravessa o gateway e não é apenas uma peculiaridade de chamada via
`psql`.

Isso é uma causa-raiz concreta para telas que ficam em carregamento ou exibem
erro depois de um filtro: não é latência de Python nem falta de índice. A
migration histórica `20260824_remove_ambiguous_rpc_desempenho_overload.sql`
removeu uma assinatura de seis argumentos, mas não removeu o overload legado de
10 argumentos que ainda está instalado. O repositório agora contém uma
correção estreita (`20260922_remove_ambiguous_rpc_desempenho_vendas_overload.sql`)
que valida o contrato de 11 argumentos, remove somente o de 10 sem `CASCADE` e
confirma o estado depois. Ela foi aplicada na VPS com transação e validada por
SQL e HTTP após o recarregamento do PostgREST.

Como defesa adicional, `fetchDesempenhoVendas` passou a sempre enviar a chave
`p_funis` (`null` quando não há filtro), evitando que novos callers atinjam a
resolução ambígua enquanto a migration aguarda aprovação.

A mesma falha foi reproduzida pelo gateway para os drill-downs da tela Ações:

- `rpc_acoes_pedidos_ganhos`: assinaturas de 6 e 7 argumentos;
- `rpc_acoes_negocios_perdidos`: assinaturas de 6 e 7 argumentos.

Nos dois casos, o corpo com período, mas sem `p_funis`, retornou HTTP 300/PGRST203;
com `p_funis: null`, retornou HTTP 200. Os serviços locais desses drill-downs
também omitiam a chave quando a lista estava vazia, portanto o defeito era
alcançável por uso normal da tela.

Há ainda duas assinaturas públicas de
`rpc_evolucao_ganhos_perdidos_12m` (uma com `p_vendedor`, outra com período).
O corpo vazio também retorna PGRST203; o hook atual já envia as três chaves,
mas a assinatura legada continua sendo uma fonte de risco para outros callers.
O inventário completo e a migration corretiva foram aplicados na VPS. O cache
do PostgREST precisou de um restart controlado do serviço `supabase_rest` para
descartar as assinaturas antigas; depois disso, todas as chamadas de período
sem `p_funis` retornaram HTTP 200.

| RPC | Legado ambíguo | Contrato preservado | Gateway sem argumento novo |
|---|---|---|---|
| Desempenho | 10 args | 11 args + `p_funis` | HTTP 300/PGRST203 |
| Ações — ganhos | 6 args | 7 args + `p_funis` | HTTP 300/PGRST203 |
| Ações — perdidos | 6 args | 7 args + `p_funis` | HTTP 300/PGRST203 |
| Evolução GPO | 1 arg | 3 args + período | HTTP 300/PGRST203 (corpo vazio) |

As migrations corretivas usaram transação, `DROP ... RESTRICT`, validação de
retorno/ACL/`SECURITY DEFINER` e `NOTIFY pgrst`. O banco e o REST ficaram
saudáveis após o restart; a ACL pública preexistente das versões vigentes não
foi alterada.

### Observação de carga acumulada (`pg_stat_statements`)

Uma leitura agregada desde o último reset/reinício do PostgreSQL mostrou que o
problema de janela longa se soma ao custo de várias telas:

| RPC | Chamadas | Média | Máximo |
|---|---:|---:|---:|
| `rpc_resultados_negocios_bi` | 25 | 2,34 s | 9,27 s |
| `rpc_desempenho_vendas_bi` | 58 | 0,98 s | 3,61 s |
| `rpc_acoes_bi_periodo` | 105 | 0,54 s | 3,19 s |
| `rpc_acoes_funil_gestao_periodo` | 76 | 0,47 s | 2,02 s |
| `rpc_acoes_mapa_oportunidades` | 40 | 0,76 s | 6,00 s |

Esses números são acumulados, não p95 e não substituem um teste de carga. Eles
confirmam, porém, que a prioridade SQL deve ser `rpc_resultados_negocios_bi`
em janelas multi-ano e o mapa em picos, enquanto o overload de Desempenho deve
ser eliminado antes de qualquer promessa de estabilidade.

### Estado da VPS

- `max_connections = 100`; fotografia durante a auditoria: 52 sessões, 2
  ativas.
- PostgREST informa pool máximo de 10 conexões.
- Host com 8 GB RAM, aproximadamente 4,8 GB disponíveis, load average perto de
  1; não há evidência de CPU/RAM continuamente esgotada.
- Disco raiz em aproximadamente 83% de uso: não causa o congelamento atual,
  mas deve entrar no alerta operacional.
- Serviços `ceresbi_web`, `ceresbi_ai`, Kong, REST e banco estavam `1/1`.

Uma captura curta durante a abertura de Ações mostrou no máximo duas consultas
ativas simultâneas no PostgreSQL. Isso descarta saturação contínua do banco
naquele instante, mas não descarta fila no cliente, no Kong/PostgREST ou no
pool durante picos; a amostra não é um teste de carga.

## Arquitetura real e papel do Python

O banco de produção é **PostgreSQL self-hosted na VPS `178.238.235.203`**.
Não é Supabase Cloud. A VPS, porém, executa componentes self-hosted com nomes
`supabase_supabase_db`, `supabase_supabase_rest`, `supabase_supabase_auth` e
`supabase_supabase_kong`; eles formam a camada de PostgREST/Auth/gateway que o
frontend usa. Portanto, não se deve remover esses arquivos ou serviços como
“lixo antigo” sem verificar o caminho de produção.

O repositório também contém `ai-service/`, um FastAPI/Uvicorn em `/api/ai`,
com `psycopg2`, `ThreadPoolExecutor(max_workers=4)` e consultas próprias. Ele é
um serviço lateral de IA/relatórios: as telas principais do BI chamam as RPCs
PostgreSQL diretamente por `@supabase/supabase-js`/PostgREST. Assim, o ganho
principal precisa vir de SQL/RPC, transporte e renderização; o Python deve ter
uma trilha separada de pool, timeout e contratos de resposta.

No `ai-service`, há bons controles já presentes (JWT, Pydantic em partes do
fluxo, consulta dinâmica read-only com `statement_timeout`/`lock_timeout` e
logger estruturado). Ainda existem riscos para a fase própria: algumas rotas
legadas abrem uma conexão nova por consulta, executam consultas paralelas e
retornam `{"error": ...}` com HTTP 200; há também chamadas externas com timeout
de 120 s. Isso não prova que o Python causou o congelamento dos dashboards, mas
justifica o endurecimento descrito no [plano de entrega](../plans/2026-09-22-bi-improvement-and-client-delivery.md).

## Auditoria do código de dados e de renderização

### Pontos concretos

- `src/services/bi/biRpcService.ts:21-24` faz `unwrapRpc<T>` com cast direto;
  vários fetchers aceitam qualquer objeto como o tipo esperado.
- `src/services/bi/desempenhoVendasService.ts:51-63` só verifica erro nativo e
  presença de `data`; objeto parcial vira uma estrutura preenchida por zeros e
  arrays vazios.
- `src/hooks/bi/useDesempenhoVendas.ts:25-31` devolve
  `EMPTY_DESEMPENHO_DATA` quando a query ainda não tem resultado. A página
  recebe `isError/error`, mas não os usa para bloquear cartões falsos.
- `src/services/bi/pedidosEsteiraService.ts:65-67` faz cast de resposta bruta
  para `PedidosEsteiraData`; `PedidosEsteiraCard` preenche campos ausentes com
  `{ qtd: 0, valor: 0 }`.
- `useInteligenciaBIRpc` expõe arrays vazios e KPIs zero sem expor erro por
  bloco; Serviços, Pedidos, Comercial, Admin e Clientes têm padrões semelhantes.
- `src/components/bi/ChartCard.tsx` não possui `error` nem boundary local.
- `src/components/layout/AppShell.tsx:123-125` envolve o `Outlet` inteiro em um
  único `ErrorBoundary`. Um `.map`, `.toFixed` ou `toLocaleString` inválido em
  um cartão pode desmontar a rota inteira.
- `AcoesMapaOportunidades.tsx:17-43` não valida coordenadas antes de chamar
  `.toFixed`; `meta` também é assumido em partes do render. `NaN`, string ou
  `null` mal normalizados podem quebrar o mapa.
- Os gráficos convertem valores com `Number(...)` sem eliminar `NaN` em todos
  os caminhos.
- `DesempenhoDetalheListas.tsx:46-72` mantém as consultas de ganhos e perdas
  habilitadas ao mesmo tempo, mesmo com somente uma aba visível.
- `AcoesSection.tsx:164-169` consulta a esteira sem `enabled`; filtros podem
  disparar a chamada mesmo quando a seção não está pronta.
- O seletor de datas aplica alterações imediatamente. Não há uma etapa de
  “rascunho + aplicar”, debounce consistente ou orçamento de concorrência.

### Por que isso vira “zero” em vez de erro

Há três estados que hoje são misturados:

1. zero válido (nenhum pedido no período);
2. dado ainda carregando;
3. RPC falhou ou retornou contrato inválido.

O frontend trata os estados 2 e 3 como a mesma estrutura vazia em vários
lugares. Isso é perigoso para BI: o usuário não consegue distinguir “zero
vendas” de “não consegui consultar vendas”.

## Diagnóstico por tela

| Tela | Fan-out/risco | Ação prioritária |
|---|---|---|
| **Ações** | ~11 RPCs iniciais; anteriores, termômetro, gestão e mapa; 4.349 nós | orçamento de concorrência, mapa sob demanda, deduplicar `rpc_acoes_bi`, validação por widget |
| **Desempenho** | principal + esteira + dois drill-downs; anual 3.516 nós | carregar agregados primeiro, detalhe somente aba/viewport, truncar observações |
| **Painel** | 4 atuais + 3 comparativos atrasados + operacional; página adiciona mais domínios | pipeline em fases e cache de agregados; comparação sob demanda |
| **Comercial** | RPC de resultados pode cair no caminho de 8–9 s em histórico | separar KPIs de listas/projeção e materializar resumo mensal |
| **Inteligência** | até cinco RPCs conforme escopo; falha vira arrays vazios | estado parcial por bloco e schemas |
| **Pedidos/Serviços/Admin** | menor DOM, mas erros são ignorados em vários consumidores | propagar erro e mostrar “indisponível”, nunca zero silencioso |
| **Produtos/Operacional/ETL** | baixo custo na amostra | manter smoke e contratos; monitorar atualização dos dados |

## Plano de correção proposto

### P0 — impedir travamento e números falsos

1. **Contrato runtime por RPC.** Introduzir schemas (Zod ou validadores
   equivalentes) na fronteira de cada service. Validar objeto, arrays, datas,
   coordenadas e números finitos. Resposta deve carregar:

   ```ts
   type WidgetResult<T> = {
     status: "ok" | "partial" | "error";
     data: T | null;
     issues: Array<{ path: string; code: string }>;
     fetchedAt: string;
   };
   ```

   `null`/`unknown` representa ausência ou falha; `0` só pode vir de um campo
   validado pelo backend como zero.

2. **Boundary por widget.** Envolver cada `ChartCard`, tabela, mapa e bloco de
   KPI em `WidgetErrorBoundary`. O fallback deve manter o restante da tela,
   explicar “dados inválidos neste bloco” e oferecer retry daquele query key.

3. **Preservar último dado válido.** Usar `keepPreviousData`/cache por chave e
   exibir selo “atualização pendente” durante refetch. Uma falha nova não deve
   substituir o último dado válido por zeros.

4. **Desempenho em duas fases.** Primeiro KPIs e séries agregadas; depois
   detalhes, IA e mapa somente quando visíveis/abertos. Na visão anual, limitar
   a primeira página a campos resumidos, truncar observação e abrir texto
   completo sob demanda. Manter paginação server-side e considerar
   virtualização.

5. **Ações/mapa.** Começar o mapa fechado ou carregá-lo quando entrar no
   viewport; retornar resumo + pinos paginados/clusterizados. Rejeitar
   coordenadas não finitas antes de criar qualquer ponto.

6. **Filtros e concorrência.** Separar estado de filtro em rascunho e aplicado,
   usar debounce de 300–500 ms e cancelar/coalescer queries obsoletas. Impor
   orçamento de 2–3 requisições pesadas por tela e deduplicar chamadas iguais.

### P1 — reduzir tempo de banco e transporte

1. Reescrever `rpc_resultados_negocios_bi` para não chamar duas RPCs pesadas
   aninhadas quando os mesmos agregados já estão disponíveis.
2. Filtrar a coorte antes de `DISTINCT ON`, `STRING_AGG` e enriquecimento de
   cidade/produto; medir cada mudança com `EXPLAIN (ANALYZE, BUFFERS)`.
3. Criar resumos diários/mensais (ou materialized views atualizadas pelo ETL)
   para KPIs, séries e comparativos. Deixar o drill-down nominal separado.
4. Usar paginação por cursor/chave para listas grandes, evitando recomputar
   toda a base a cada `OFFSET`.
5. Publicar o proxy same-origin preparado no commit local `6a25076` apenas
   depois de QA/rollback: a configuração atual da produção ainda é somente
   SPA fallback e não contém `location /supabase` nem `limit_req`. Isso reduz
   variabilidade de origem/CORS, mas não substitui as correções P0/P1.

### P2 — observabilidade e evolução

- Registrar duração, tamanho do payload, query key, status de schema e request
  id por widget; nunca registrar observação, nome de cliente ou token.
- Medir `first meaningful paint`, tempo até primeiro KPI, tempo até tela útil,
  long tasks do navegador e erro por RPC.
- Reduzir chunks iniciais (o build local ainda alerta chunks de aproximadamente
  670–779 KB) depois que a fan-out estiver controlada.

## Critérios objetivos de aceite

Antes de chamar a correção de concluída, executar em staging e depois em uma
janela controlada de produção:

- primeiro KPI visível em até **2 s** e tela útil em até **4 s** no mês;
- visão anual útil em até **4 s**, com drill-down/mapa fora do caminho crítico;
- p95 de RPC agregada abaixo de **1,5 s** e nenhuma RPC de tela acima de **10 s**;
- payload de agregado abaixo de **250 KB**; mapa inicial apenas resumo e pinos
  paginados;
- no máximo **3 consultas pesadas simultâneas** por rota;
- 20 recargas consecutivas não podem deixar somente o shell por mais de 2 s;
- resposta malformada afeta apenas o widget correspondente, com mensagem e
  retry, sem desmontar a rota;
- zero válido continua visível como zero; erro, timeout e campo inválido nunca
  são apresentados como zero;
- testes de filtro anual, filtro sem resultados, timeout, 401/5xx, `NaN`,
  coordenada inválida e payload parcial cobrem cada RPC crítica.

## Estado desta auditoria

- As duas migrations de remoção de overloads foram aplicadas na VPS de
  produção com snapshot de rollback, validação SQL e reload controlado do
  schema cache do PostgREST.
- O commit `4c38c89b6b93bcb270246ef3bf147b1242565055` foi publicado na branch
  `release/bi-consolidacao-fase-1`; a imagem web em produção é
  `ceresbi:4c38c89b6b93` e o serviço `ceresbi_web` está `1/1`.
- Boot, `/`, `/api/ai/health` e smoke HTTP das quatro RPCs críticas passaram.
  O smoke visual autenticado do navegador ainda precisa ser executado com uma
  sessão de usuário real.
- O lint global continua com baseline legado (126 erros/25 warnings) fora do
  escopo; TypeScript, 259 testes, build, lint direcionado e diff check passaram.
- A consulta multi-ano continua sendo um item de performance aberto: não foi
  declarada otimizada sem EXPLAIN/medição antes-depois.
- Os arquivos não relacionados já existentes no working tree não foram
  incluídos no commit.

Próximos passos: executar smoke visual autenticado, medir p50/p95/p99 da visão
anual e decidir separadamente o endurecimento das ACLs PUBLIC/anon das RPCs
SECURITY DEFINER.
