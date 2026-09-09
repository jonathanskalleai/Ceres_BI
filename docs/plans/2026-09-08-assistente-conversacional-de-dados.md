# Plano técnico e de produto — Assistente conversacional de dados do Ceres BI

**Data:** 2026-09-08  
**Status:** proposta de execução; este documento não altera aplicação, banco, ETL ou publicação.  
**Objetivo:** evoluir a AI do BI de um chat que escolhe alguns resumos existentes para um assistente conversacional de dados que responda, com evidência, perguntas sobre o CRM no Postgres: métricas das telas, investigações novas, comparações temporais, drill-downs e correlações estatísticas.

## 1. Resultado de produto

O produto final deve permitir que uma pessoa pergunte em linguagem natural, continue a investigação sem repetir o contexto e obtenha uma resposta que seja:

- **correta e reproduzível:** todo número vem de um contrato determinístico no Postgres, nunca da memória do modelo;
- **situada:** a resposta declara período, filtros, entidade/granularidade, regra de data e atualização do mirror;
- **explicável:** cada conclusão traz métricas, definições aplicadas e um caminho para o detalhe que a sustenta;
- **conversacional:** referências como “compare com o anterior”, “e na região sul?” e “mostre os clientes” resolvem o contexto anterior de forma explícita;
- **ampla sem promessas vazias:** cobre progressivamente as áreas do BI e informa quando uma pergunta exige uma fonte ainda não espelhada, em vez de inventar uma análise.

O chat não substitui as dashboards. Ele passa a ser a superfície de investigação: a dashboard mostra o sinal; o chat explica, compara, segmenta e leva ao registro ou gráfico que sustenta a resposta.

## 2. Base comprovada e limite da evidência

### 2.1 Documentação conferida antes deste plano

Foram lidos `CLAUDE.md`, `docs/features/index.md`, `docs/features/painel-bi.md`, `docs/features/negocios-bi.md`, `docs/features/acoes-bi.md`, `docs/data-map.md`, `docs/bi-schema-reference.md`, `docs/PLANO-NOVAS-FUNCIONALIDADES-BI.md` e `docs/features/contra-analise-ia.md`, além do código atual de `ai-service/`, `src/components/bi/YaChat.tsx`, `src/services/yaChatService.ts`, `src/services/bi/` e das migrations de chat e RPCs.

Há uma ressalva importante: `docs/data-map.md` declara geração em 2026-06-08 e `docs/bi-schema-reference.md` declara atualização em 2026-06-15; ambos são úteis para inventário, mas não bastam para afirmar o contrato vigente. O próprio `CLAUDE.md` determina que a RPC/migration vigente e, para dado vivo, a função instalada no Postgres de produção prevalecem. Portanto, cada item de implementação deve reconfirmar no banco a definição da função, a granularidade, a data de competência e a frescura antes de virar uma métrica do chat.

Este diagnóstico é comprovado para o checkout atual; não alegamos ter validado neste planejamento uma resposta contra a base viva.

### 2.2 O que já existe

| Aspecto | Evidência no projeto | Consequência para o plano |
|---|---|---|
| Fluxo de dados BI | `CLAUDE.md` descreve CRM/SQL Server → ETL de 15 min → `mirror.*` → RPCs → React. | O assistente deve consumir os mesmos contratos server-side, não recalcular no navegador nem consultar o CRM legado diretamente. |
| Chat em tempo real | `POST /ai/chat/stream` em `ai-service/ya_chat.py` emite SSE de status, thread, fontes, deltas e conclusão; `YaChat.tsx` já renderiza progressivamente. | Preservar SSE e enriquecer os eventos com plano, evidência e progresso de ferramentas. |
| Acesso a dados mediado | `ya_chat.py` mantém um catálogo fechado e `_execute_tool` chama SQL/RPCs definidos no serviço; o comentário do módulo proíbe entregar conexão ou SQL ao modelo. | A arquitetura-alvo amplia contratos nomeados; não libera geração/executação de SQL pelo LLM. |
| Ferramentas atuais | Há sete contratos: `sales_overview`, `business_analysis`, `funnel`, `orders`, `after_sales`, `client_360` e `field_signals`. | É uma boa fundação, mas cada contrato retorna um resumo amplo, não uma linguagem analítica composável. |
| Roteamento | `_route_tools` decide por palavras-chave/rota e no máximo duas ferramentas; `_plan_tools` existe, mas não é o caminho usado pelo turno. | Perguntas multi-domínio, filtros sofisticados e pedidos não previstos não possuem planejador semântico confiável. |
| Memória | A conversa persiste mensagens, fontes e execuções; o serviço usa as últimas 8 mensagens e um resumo textual truncado a 3.200 caracteres. | Há continuidade básica, mas falta estado estruturado de filtros, entidades, comparações e fatos confirmados. |
| Evidência atual | A UI mostra rótulo da fonte, filtros e `refreshed_at`; `ya_chat_tool_runs` registra ferramenta, filtros e duração. | Falta linhagem por métrica, versão de definição, coorte, cardinalidade, drill-down e justificativa de uma conclusão. |
| Medição operacional | `ai_chat_turn_metrics` registra latência DB/modelo/total, cache, fontes, tamanho e status. | A telemetria inicial existe; precisa ganhar qualidade factual, cobertura e utilidade. |

### 2.3 Lacunas que impedem a promessa “qualquer pergunta sobre o CRM”

1. **Semântica incompleta.** O catálogo atual nomeia áreas, mas não registra formalmente fórmula, unidade, entidade, chave de deduplicação, coluna de competência, exceções ou dimensões aceitas por cada métrica. Isto é crítico em Ações: ganhos são pedidos aprovados por `pdo_dthaprovacao`, perdas são negócios por `ngo_datafechamento` e oportunidades são outra coorte. Esses valores não podem ser somados nem tratados como um funil convencional, conforme `docs/features/acoes-bi.md`.
2. **Filtros não são um contrato único.** O frontend manda `categoria` e `funil` no contexto do chat, mas `_context_filters`/`_execute_tool` só propagam efetivamente datas, vendedor e cidade às ferramentas atuais. Isso pode produzir a aparência de que um filtro da tela foi respeitado quando não foi.
3. **Cobertura pequena e agregada.** Não há ferramenta explícita para série temporal arbitrária, período anterior, decomposição por dimensão, lista paginada/drill-down, dados de metas, produtos/parque, operacional, administração, ETL ou muitas listas de Ações já expostas nas telas.
4. **Comparação e correlação não são produtos de dados.** A seleção de duas ferramentas em perguntas com “compar” ou “correla” não calcula variação, significância, coorte compatível ou causalidade. O modelo recebe dois JSONs e pode apenas narrá-los.
5. **Citação é insuficiente.** “Vendas e resultados · período” não permite reproduzir um KPI, descobrir que data foi usada, nem conferir os registros envolvidos.
6. **Qualidade ainda sem suíte dedicada.** A busca no checkout não encontrou testes do chat, do roteador, dos contratos de ferramentas ou do protocolo SSE; os testes existentes encontrados são de outros componentes de BI. Não há ainda golden set para perguntas factuais.
7. **Conhecimento documental e fatos correntes estão misturados por risco.** A fonte de verdade documental é dispersa e parte dela é histórica. Um RAG sem separação poderia transformar instruções antigas em números “atuais”.

## 3. Escopo analítico e cobertura

### 3.1 Cobertura inicial: o que já pode sustentar contratos

| Domínio | Fontes/RPCs já usadas pelo BI | Situação para o chat |
|---|---|---|
| Resultados e desempenho de vendas | `rpc_desempenho_vendas_bi`, negócios, pedidos e itens. | Parcialmente coberto por `sales_overview`; promover a métricas e cortes formais, incluindo produto, origem, banco, condição e funil quando o contrato da RPC os aceitar. |
| Negócios e funil | `rpc_negocios_bi`, `rpc_negocios_bi_expandido`, `rpc_resultados_negocios_bi`, `mirror.crm_funil_etapa`. | Parcialmente coberto por `business_analysis`; precisa de séries, etapas, motivos, velocidade, coortes e detalhes. |
| Ações e gestão comercial | `rpc_acoes_*`, listas de gestão, mapa, ganhos/perdidos/em andamento e clientes em risco. | Parcialmente coberto por `funnel`; faltam mapas/listas/drill-downs e preservação explícita dos três contratos de competência. |
| Pedidos | `rpc_pedidos_bi`, esteira de pendências, itens. | Parcialmente coberto por `orders`; faltam esteira, detalhe, decomposição por produto e comparação de status. |
| Serviços | `rpc_servicos_bi`, `mirror.ordens_servico`. | Coberto apenas no resumo por `after_sales`; falta cliente/filial/tipo/OS e análise temporal mais ampla. |
| Cliente 360 | `rpc_ya_cliente_360` junta carteira, ações, negócios, pedidos, parque e serviços por cliente. | Já é um bom padrão de ferramenta específica; precisa de resolução de entidade, ambiguidade, detalhes e referências aos registros. |
| Sinais de campo | `public.ai_sentimento_semanal`. | Resumo semanal já existe; classificações IA devem ser marcadas como interpretação derivada, não como fato transacional. |

### 3.2 Dashboards e dados ainda fora do contrato conversacional

| Área exposta no produto | Evidência de fonte | Próximo contrato a criar |
|---|---|---|
| Painel executivo | Combina `rpc_negocios_bi`, `rpc_acoes_bi` e `rpc_acoes_funil_gestao` (`docs/features/painel-bi.md`). | Um “resumo executivo” versionado, composto por métricas nomeadas — sem fingir que todas têm a mesma data ou unidade. |
| Produtos e parque | `rpc_produtos_bi`, `rpc_parque_renovacao_bi`, `mirror.cliente_parque_maquinas`. | Parque por marca/modelo/grupo/cliente e oportunidades de renovação, com o que a fonte realmente contém. |
| Operacional | `rpc_operacional_bi`; `docs/data-map.md` aponta TécnicoTempo e Agenda como fontes legadas. | Contrato de produtividade operacional somente após garantir a fonte e a semântica temporal. |
| Administrativo/carteira | `rpc_admin_bi`, `rpc_clientes_criticos_bi`, carteira de clientes. | Perfil e distribuição da carteira; declarar quando é snapshot e, portanto, não comparável no tempo. |
| Ações: listas e mapa | `rpc_acoes_gestao_listas`, `rpc_acoes_mapa_oportunidades`, `rpc_acoes_detalhe`, `rpc_acoes_pedidos_ganhos`, `rpc_acoes_negocios_perdidos`, `rpc_acoes_em_andamento`. | Drill-down paginado por coorte e explicação da regra que gerou a lista. |
| Consultores/CRM | `rpc_consultores_resumo_acoes`, `rpc_consultor_negocios_pipeline`, `rpc_equipe_desempenho_mensal_v2` e telas `/crm/*`. | Scorecard por consultor e transições de perguntas de equipe → pessoa → negócio. |
| ETL monitor | `rpc_etl_status`, `rpc_etl_log`, `mirror.sync_control`. | Ferramenta de frescura e cobertura da carga, distinta de uma resposta de negócio. |

### 3.3 Fontes que pedem expansão antes de prometer análises

O inventário documentado informa que AtendimentoOS, Ocorrências, TécnicoTempo e Agenda permanecem sem mirror e sem suporte confiável a `dateRange`. A contra-análise de IA também registra lacunas a confirmar no banco: propriedade do cliente/safra, pedidos usados, datas de etapas, idade/horímetro do parque, chave de cliente em OS e detalhes competitivos de perda. Elas não devem entrar como “inteligência” até que a descoberta confirme a origem, o ETL carregue a chave e o contrato semântico defina sua competência.

Prioridade de expansão de dados pelo valor analítico:

1. chaves estáveis cliente–OS–negócio e datas de etapa, para retenção, fricção e correlações vendas/pós-venda;
2. fontes operacionais com timestamps, para séries e comparações reais;
3. parque com idade/horímetro e propriedade/safra, para renovação e timing;
4. usado/concorrência/motivo detalhado, somente se a origem confirmar as colunas e a qualidade de preenchimento.

## 4. Arquitetura-alvo

```text
Pergunta + contexto de tela + estado estruturado da conversa
                         │
                         ▼
            Orquestrador conversacional
   (entende intenção, resolve referências, pede desambiguação)
                         │ QuerySpec validado
                         ▼
         Catálogo semântico versionado
 (métricas, dimensões, coortes, datas, regras e capacidades)
                         │ plano determinístico
                         ▼
       Gateway de ferramentas analíticas
  métricas | série | comparar | breakdown | drill-down | correlação
                         │ RPCs/consultas parametrizadas e aprovadas
                         ▼
        Postgres BI: public.rpc_* + mirror.* + estado de sync
                         │ resultado + evidência estruturada
                         ▼
 Modelo de linguagem para explicar, resumir e orientar a próxima pergunta
                         │ SSE
                         ▼
 Chat: resposta, evidências, definição, gráfico/tabela e links de detalhe
```

### Princípios de arquitetura

- O modelo **nunca** recebe credencial, acesso SQL ou liberdade para compor consultas. Ele pode produzir uma intenção/`QuerySpec` limitado por JSON Schema e escolher entre capacidades do catálogo.
- O gateway valida domínio, métrica, dimensões, filtros, período, cardinalidade, limite e compatibilidade antes de chamar uma RPC/consulta parametrizada.
- A execução retorna tanto valores quanto **proveniência estruturada**. O narrador não pode emitir uma métrica ou conclusão numérica que não esteja naquele resultado.
- Novas perguntas são implementadas primeiro como capacidade determinística e teste dourado; o LLM é a camada de linguagem, não a calculadora nem a fonte de fatos.
- O contexto da rota é apenas um padrão sugerido. Uma resposta deve mostrar os filtros realmente aplicados; filtros incompatíveis exigem esclarecimento ou são rejeitados de modo legível.

## 5. Camada semântica

### 5.1 Artefato central: catálogo de métricas e dimensões

Criar uma fonte versionada, revisável e testável — inicialmente pode viver no repositório e depois ter representação no banco — com uma entrada por métrica e dimensão. Cada métrica precisa declarar:

| Campo semântico | Exemplo necessário |
|---|---|
| Identidade | `pedido.valor_ganho_aprovado`, nome de produto e versão. |
| Definição de negócio | “Soma do valor de pedido aprovado”, em linguagem de usuário. |
| Unidade e formato | R$, contagem, percentual, dias, quilômetros; numerador/denominador se houver taxa. |
| Grão/entidade | Pedido, negócio canônico, ação, OS, cliente, item ou mês. |
| Chave/canonização | Ex.: pedido distinto por `pdo_codigointerno`; negócio canônico por `ngo_numero` com ordenação documentada. |
| Competência temporal | Coluna e semântica: aprovação, fechamento, conclusão, abertura, snapshot ou estoque. |
| Fórmula e exclusões | Status, funis, valores nulos, regras de normalização e suas justificativas. |
| Filtros e dimensões permitidos | Vendedor, cidade, funil, categoria, produto, banco, origem, etapa etc., com a semântica de cada um. |
| Compatibilidades | Quais medidas podem dividir, comparar ou correlacionar; por exemplo, não somar valor de pedido ganho com valor potencial perdido. |
| Executor | Identificador da ferramenta/RPC, parâmetros, shape de retorno e limites. |
| Evidência | ID/versão da definição, migration/RPC e testes dourados associados. |
| Estado de disponibilidade | Disponível, parcial, snapshot, legado sem período, bloqueado por fonte ou descontinuado. |

O catálogo também define dimensões compartilhadas (cliente, vendedor, cidade, filial, funil, etapa, produto, banco, tipo de ação, status) e mapeia seus identificadores/campos de exibição. Isso evita que “cidade” ora signifique filial, ora cidade do cliente, sem a resposta avisar.

### 5.2 Especificação de consulta (`QuerySpec`)

Antes de consultar dados, o orquestrador converte a pergunta para um objeto validado contendo: intenção (`metric`, `breakdown`, `timeseries`, `compare`, `drilldown`, `correlation`, `entity_360`), métricas, domínio, período explícito, comparação, filtros, dimensões, ordenação, limite, entidade referida e forma de saída. A validação deve:

1. resolver sinônimos somente para IDs permitidos do catálogo;
2. confirmar período ausente com o contexto visível ou a regra padrão exibida;
3. recusar combinação de métrica/dimensão que mude a granularidade sem uma regra definida;
4. separar coortes incompatíveis em blocos claramente nomeados;
5. retornar uma pergunta curta quando houver ambiguidade material — por exemplo, “ganho por aprovação de pedido ou por fechamento de negócio?”.

## 6. Ferramentas analíticas determinísticas

Cada ferramenta retorna `data`, `applied_scope`, `metric_definitions`, `freshness`, `lineage`, `warnings`, `drilldown_ref` e `execution_metrics`. O retorno é tipado e auditável; a resposta humana é uma projeção desse objeto.

| Ferramenta | Resolve | Regras essenciais |
|---|---|---|
| `get_metric` | KPI único ou conjunto compacto. | Uma métrica por definição; explicita grão, unidade e período. |
| `get_breakdown` | “por vendedor/cidade/funil/produto/banco”. | Agrega no grão correto e limita/ordena categorias com “outros” explícito. |
| `get_timeseries` | Evolução diária, semanal, mensal ou anual. | Escolhe grão viável, completa lacunas, declara a coluna de data e evita somar snapshots. |
| `compare_periods` | MoM, YoY, intervalo anterior equivalente, meta e coorte. | Compara janelas de mesmo comprimento e filtros idênticos; retorna absoluto, percentual, denominador e aviso para base zero. |
| `drill_down` | “quais clientes/pedidos/negócios explicam isso?”. | Usa lista paginada, colunas aprovadas e a mesma coorte do agregado; cada linha leva sua chave e regra de inclusão. |
| `get_entity_360` | Cliente, vendedor, negócio, pedido, OS ou produto. | Resolve identidade com confiança; se houver homônimos, lista opções antes de revelar análise. |
| `correlate` | Relação entre duas medidas por entidade/período. | Constrói pares no mesmo grão, retorna N, método, coeficiente, período, outliers e limites; nunca afirma causalidade. |
| `explain_metric` | “como esse número é calculado?” | Lê somente o catálogo semântico, não um LLM/RAG. |
| `get_freshness` | “os dados estão atualizados?” | Consulta estado do ETL/mirror e apresenta hora, cobertura e avisos, sem confundir com métrica de negócio. |
| `list_filter_values` | Sugestões e desambiguação de filtros. | Devolve valores canônicos, contagem opcional e escopo de validade. |

### 6.1 Comparações temporais

O produto deve suportar “mês anterior”, “mesmo período do ano passado”, “últimos 90 dias versus 90 dias anteriores”, “antes/depois de data X” e intervalos explícitos. A ferramenta deve guardar ambos os escopos completos na evidência. Não deve comparar automaticamente uma métrica por aprovação com outra por fechamento nem série de snapshot com série de eventos.

### 6.2 Correlações responsáveis

Uma correlação é um recurso específico, não um adjetivo para qualquer comparação. A ferramenta deve exigir duas medidas, um grão pareável (por exemplo, cliente-mês, vendedor-mês ou filial-semana), janela, filtros e mínimo de observações. Deve retornar pelo menos método (Pearson/Spearman, conforme distribuição), tamanho de amostra, coeficiente, sinal, intervalo/estabilidade quando aplicável, categorias excluídas e os maiores pontos influentes. A linguagem final usa “associação observada”, nunca “causou”; pode sugerir o drill-down que investigaria hipóteses.

## 7. Divisão de responsabilidades: IA versus Postgres

| Faz o Postgres/camada determinística | Faz a IA |
|---|---|
| Canonização, joins, filtros, agregações, séries, percentuais, comparação, correlação, paginação, limites e cálculo de frescura. | Entender a pergunta, resolver referência conversacional, escolher capacidade permitida, pedir esclarecimento e escrever em português natural. |
| Aplicar regra de competência, exclusões, dimensões, amostras e avisos do catálogo. | Transformar resultado estruturado em narrativa, destacar anomalias entregues pela ferramenta e sugerir próximo corte. |
| Produzir fontes, IDs de definição, coorte, chaves de drill-down e testes reproduzíveis. | Explicar a definição em linguagem de negócio e distinguir fato, inferência e dado indisponível. |
| Decidir se uma correlação é computável e calcular seus parâmetros. | Nunca inferir causalidade, preencher lacunas ou calcular números fora do resultado. |

Não usar SQL gerado pelo modelo, nem enviar tabelas cruas para “ele descobrir”. Isso diminuiria reprodutibilidade e reintroduziria os erros de granularidade que as RPCs atuais já protegem.

## 8. RAG e vector store: complemento documental, nunca base factual atual

Um RAG pode melhorar perguntas como “o que significa pipeline aberto?”, “por que ganho e perdido não formam taxa?”, “qual a definição da etapa?” ou “que fonte alimenta este gráfico?”. Ele deve indexar somente conteúdo documental curado:

- glossário de métricas/dimensões e sinônimos aprovados;
- descrições do catálogo semântico e changelog de versões;
- documentação de dashboard, contratos de RPC e runbooks de dado;
- decisões de negócio marcadas com vigência e dono.

Não indexar `mirror.*`, resultados correntes, dumps, histórico de conversa ou documentos de contato como mecanismo de recuperar “fatos atuais”. Para fatos atuais, a única via é ferramenta determinística. Cada trecho recuperado deve ter origem, versão, data de vigência e classificação (normativo, histórico ou obsoleto); conteúdo histórico não pode sobrescrever o catálogo vigente. Antes de uma resposta factual, o gateway de dados é obrigatório mesmo que o RAG encontre uma explicação plausível.

## 9. Memória e experiência de conversa

### 9.1 Estado de conversa

Substituir o resumo textual como única memória por um estado estruturado por conversa: filtros ativos e sua origem (tela ou fala), período e timezone, domínio, entidade resolvida, última `QuerySpec`, última coorte, métricas já exibidas, comparações pendentes e referências de drill-down. Mensagens e um resumo humano continuam úteis, mas não autorizam um fato.

Ao receber “e no mês anterior?”, o sistema deve reaplicar a última especificação factual com janela equivalente; ao receber “esses clientes”, deve usar o `drilldown_ref` ainda válido, não tentar inferir nomes a partir da prosa. Mudança de rota/filtro na UI deve ser apresentada como proposta de contexto, e não silenciosamente alterar uma pergunta em andamento.

### 9.2 Resposta e interação

Uma resposta completa apresenta, nesta ordem:

1. conclusão curta ou pergunta de esclarecimento;
2. bloco de escopo: período, filtros, métrica, competência temporal, atualização do mirror;
3. números/série/tabela solicitados;
4. interpretação separada de fato e limitada à evidência;
5. “como foi calculado” e fontes: definição, versão, contrato e link/ação de drill-down;
6. uma próxima pergunta útil, opcional.

No streaming, os estados devem comunicar “entendi o recorte”, “consultei N contratos”, “calculei a comparação/correlação” e “redigindo a explicação”. A UI precisa suportar tabela e série curtas, copiar escopo, abrir detalhe e fornecer feedback “número incorreto”, “fonte insuficiente” ou “útil”. O feedback guarda a `QuerySpec` e o resultado, permitindo reprodução.

## 10. Plano por fases

### Fase 0 — Baseline factual e contrato de sucesso

**Entrega:** inventário das métricas e dashboards, matriz de cobertura, 30–50 perguntas reais classificadas por intenção e um conjunto de consultas douradas validado contra as RPCs vigentes/no banco vivo.

**Trabalho:** confirmar cada RPC instalada que já alimenta tela, registrar grão/data/dedup/exclusões, medir frescura e preencher matriz “disponível/parcial/bloqueado”. Incluir casos notoriamente perigosos: ganhos/perdas de Ações, filtro de funil, pedido versus item, negócio canonizado e snapshots de carteira.

**Aceite:** cada pergunta dourada tem resultado esperado, escopo e evidência humana revisada; não há métrica catalogada apenas com base em nome de coluna ou documento histórico.

### Fase 1 — Fundação semântica e gateway de consulta

**Entrega:** catálogo versionado, `QuerySpec` validado, provedores de filtro/entidade e envelopes de evidência padronizados.

**Trabalho:** começar pelos domínios já usados no chat e pelas métricas do Painel/Ações; transformar chamadas genéricas em capacidades por métrica, breakdown e série. Corrigir a incompatibilidade atual de filtros: um filtro enviado só pode aparecer como aplicado se o executor o recebeu e o contrato o suporta.

**Aceite:** 100% das métricas dessa primeira fatia mostram definição, unidade, competência, filtros efetivamente aplicados e frescura; consultas inválidas falham antes do banco; resultados batem com as RPCs/telas de referência na suíte dourada.

### Fase 2 — Núcleo analítico conversável

**Entrega:** ferramentas `get_metric`, `get_breakdown`, `get_timeseries`, `compare_periods`, `drill_down`, `explain_metric`, `get_freshness` e resolução de entidade.

**Trabalho:** construir RPCs/consultas parametrizadas estreitas e testes de coorte; manter payloads pequenos, mas oferecer cursor/referência para o detalhe. Implementar comparação equivalente e regras de base zero. Cobrir vendas, negócios, ações, pedidos, serviços e Cliente 360 antes de expandir para áreas parcialmente espelhadas.

**Aceite:** perguntas simples, temporais e de drill-down da suíte respondem com o mesmo número do contrato de referência; todo agregado tem drill-down ou declara por que não é drillable; nenhuma resposta numérica sai sem escopo e fonte.

### Fase 3 — Correlação, explicabilidade e conversação robusta

**Entrega:** ferramenta de correlação, memória estruturada, referências de contexto, interface de evidências e feedback de qualidade.

**Trabalho:** iniciar por relações viáveis e bem pareadas — esforço/resultado por vendedor-período, fricção de etapa/resultado e, após chave estável, OS/negócio por cliente-período. Adicionar RAG documental curado somente depois de o catálogo ser fonte de explicação. Versionar resultado e definição para reprodução posterior.

**Aceite:** “compare com o anterior”, “quebre por vendedor” e “quais registros explicam?” preservam a mesma coorte; correlações declaram N/método/limitações e nunca usam causalidade; uma conversa longa não troca filtros silenciosamente.

### Fase 4 — Cobertura das dashboards e tarefas de gestão

**Entrega:** contratos para painel executivo composto, produtos/parque, carteira/administração, consultores, listas/mapas de Ações, esteira de pedidos e monitor de ETL.

**Trabalho:** priorizar pelo uso e pela maturidade da fonte, não pelo nome da página. Expandir ao menos uma capacidade por dashboard: resumo, série, breakdown e detalhe quando fizer sentido. Para snapshots, usar linguagem e UX própria, sem “comparação temporal” falsa.

**Aceite:** a matriz de cobertura diferencia claramente perguntas suportadas, suportadas com aviso e bloqueadas; todos os cards/visuais prioritários das dashboards têm um ID de métrica ou uma decisão explícita de exclusão.

### Fase 5 — Expansão de dados e análises avançadas

**Entrega:** fontes temporais hoje ausentes no mirror e novas correlações de valor comprovado.

**Trabalho:** discovery na origem → qualidade/chave/data → ETL/mirror → catálogo → contrato analítico → perguntas douradas. Seguir a prioridade da seção 3.3; não iniciar pelo prompt ou pelo vector store. Só então ativar motores de renovação, safra, competitivo e pós-venda avançado que dependem dessas fontes.

**Aceite:** cada nova fonte possui dono, chave de junção, SLA de atualização, cobertura temporal, taxa de nulos e ao menos uma pergunta de negócio validada. Caso uma coluna não exista/tenha qualidade insuficiente, a capacidade permanece bloqueada e o chat explica isso.

## 11. Testes e observabilidade

### Testes obrigatórios

| Nível | Casos |
|---|---|
| Catálogo/validação | Métrica desconhecida, dimensão incompatível, filtro sem suporte, unidade, competência, deduplicação, versão e sinônimos. |
| Banco/dados | Testes dourados de RPC/consulta para cada métrica; igualdade agregado ↔ drill-down; intervalos vazios; base zero; timezone; paginação; dados nulos; concorrência e correlação com amostra insuficiente. |
| Contrato de ferramenta | JSON Schema, escopo aplicado, fontes, warnings, limites, cursor e tratamento de erro. |
| Orquestração | Perguntas ambíguas, follow-ups, troca de filtro/rota, referências a entidade e resistência a instruções que tentem contornar ferramentas. |
| Integração/SSE | Ordem e integridade dos eventos, cancelamento, falha de ferramenta, resposta parcial e persistência/auditoria de conversa. |
| E2E de produto | Perguntar a partir de cada dashboard prioritária, abrir evidência/drill-down, visualizar série/tabela e enviar feedback. |
| Avaliação contínua | Conjunto versionado de perguntas reais com precisão numérica, completude de evidência, acerto do recorte, qualidade de desambiguação e linguagem não causal. |

### Observabilidade do core analítico

Além de `ai_chat_turn_metrics`, registrar por turno: intenção/`QuerySpec` (sem dados sensíveis desnecessários), versão de métrica, ferramentas chamadas, filtros efetivos versus pedidos, frescura, linhas/pares retornados, cache, latência por etapa, aviso emitido, drill-down aberto e feedback do usuário. Painéis de operação devem mostrar:

- taxa de respostas com fonte, definição e escopo completos;
- divergências entre resposta dourada e contrato, por versão;
- taxa de perguntas sem capacidade/que exigiram esclarecimento;
- cobertura por domínio/dashboard e uso de cada capacidade;
- latência p50/p95 por planejamento, banco e redação;
- idade do mirror e respostas feitas com dado possivelmente desatualizado;
- correlações recusadas por amostra/coorte e respostas corrigidas por feedback.

Alertas analíticos prioritários: definição sem teste dourado, aumento de divergência, ferramenta com falha recorrente, frescura acima do SLA e resposta factual sem evidência estruturada. Segurança, autenticação e publicação permanecem requisitos de plataforma, mas não são o foco deste plano.

## 12. Ordem de priorização e decisões de produto

1. **Confiabilidade antes de amplitude:** Fases 0–2 para as métricas comerciais que já têm RPC e documentação de regra, especialmente Ações/Pedidos/Negócios.
2. **Explicação antes de “insight”:** uma resposta reproduzível, com comparação e detalhe, vale mais do que uma narrativa ampla sem coorte.
3. **Cobrir fluxo de decisão:** Painel → diagnóstico → corte → registro/cliente deve funcionar sem trocar de ferramenta mentalmente.
4. **Dados faltantes antes de IA avançada:** correlação de safra, concorrência ou renovação só entra quando fonte, chave e data existem e passam nos testes.

Decisões a fechar no kickoff da execução:

- lista de personas prioritárias (direção, gestor comercial, consultor, pós-venda/controladoria) e suas primeiras perguntas douradas;
- métricas do Painel/Ações que são oficialmente canônicas quando telas antigas divergem;
- política de período padrão por domínio e de comparação equivalente;
- limite de detalhe por resposta e experiência de abrir registros/telas;
- dono de negócio e cadência de revisão do catálogo semântico.

## 13. Critério de sucesso final

O assistente estará pronto para ser chamado de “assistente conversacional de dados completo” quando um usuário puder partir de uma pergunta aberta sobre o CRM, refiná-la por tempo, pessoa, cidade, funil, cliente ou produto, pedir comparação e detalhe, e receber sempre uma resposta cujo número seja reproduzível no Postgres, cuja interpretação separe associação de causa e cuja evidência revele exatamente o que foi contado, em qual período e com qual definição. Para fontes que ainda não suportam a pergunta, a resposta deve ser igualmente útil: identificar a lacuna concreta e o passo de dados necessário, sem preencher o vazio com linguagem convincente.
