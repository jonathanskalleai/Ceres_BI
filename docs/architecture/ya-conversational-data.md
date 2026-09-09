# Arquitetura — Assistente conversacional de dados

**Escopo:** arquitetura do chat conversacional com cobertura canônica e
exploratória do BI.
**Estado:** implementação local pronta no serviço de IA. O chat mantém os
contratos canônicos das dashboards e adiciona conversa livre, schema runtime e
consulta analítica somente leitura. A publicação e a validação viva de cada
pergunta continuam pendentes.

> Esta atualização substitui a decisão anterior de bloquear toda pergunta fora
> do catálogo. O modelo pode propor SQL exploratório, mas nunca o executa
> diretamente: o servidor valida, limita e executa em transação read-only.

## Decisões

### Catálogo antes do modelo

O serviço mantém um catálogo versionado em `ai-service/ya_catalog.py`. Cada
métrica declara definição, unidade, entidade/grão, coluna de competência,
deduplicação, dimensões aceitas, executor, versão, disponibilidade e suporte a
drill-down. O catálogo é o contrato que o narrador pode explicar; documentos
históricos não substituem essa fonte.

### QuerySpec validado

Toda pergunta passa por um `QuerySpec` limitado por Pydantic. O planejador pode
escolher conversa, fonte, um contrato canônico ou uma consulta exploratória.
Contratos canônicos continuam validando métrica, dimensão, filtro, período e
coorte antes do banco. Uma consulta exploratória sem métrica catalogada só
prossegue se o SQL for um único SELECT/WITH com tabelas `mirror` conhecidas,
colunas explícitas e sem operações administrativas. O parser determinístico
cobre saudações, pedido de fonte e follow-ups quando o planejador não estiver
disponível.

### Gateway determinístico

`ai-service/ya_tools.py` é o único ponto que conhece os executores de dados.
`ai-service/ya_db.py` concentra a conexão privada. Inicialmente o gateway
reutiliza RPCs existentes e normaliza seus blocos nomeados. Para perguntas
abertas, `ya_dynamic_query.py` valida a proposta do modelo contra o schema
descoberto por `ya_schema.py`, aplica limite/timeout e chama `query_read_only`.
O gateway nunca libera conexão ao cliente, credenciais ou SQL bruto.

Cada execução devolve `data`, `applied_scope`, `metric_definitions`, `freshness`,
`lineage`, `warnings`, `drilldown_ref` e `execution_metrics`. O modelo recebe
somente esse resultado limitado e é instruído a não calcular números fora dele.

### Memória factual separada

`ya_memory.py` persiste `conversation_state` com filtros efetivos e origem,
período/timezone, domínio, entidade resolvida, última `QuerySpec`, última
coorte, métricas exibidas e referências de drill-down. O resumo textual continua
apenas como ajuda de linguagem. Estado antigo não é evidência factual.

### Segurança e exposição

O endpoint continua protegido por JWT e permissão `bi.ya`. O banco é consultado
por conexão privada do serviço, com RPCs `SECURITY DEFINER` já aprovadas ou
transação dinâmica `READ ONLY`. O validador rejeita escrita, múltiplas
instruções, schemas de sistema e funções de arquivo/rede; o executor limita
linhas/colunas e remove CNPJ, telefone, e-mail, documentos e outros campos
sensíveis do resultado. O drill-down continua usando colunas aprovadas e
paginação; não expõe SQL ou credenciais.

## Organização proposta

```text
ai-service/
  ya_chat.py        # API, SSE e ciclo de turno
  ya_catalog.py     # métricas, dimensões e executores versionados
  ya_query_models.py # contratos Pydantic do plano
  ya_semantics.py   # parser e validação
  ya_intents.py     # reconhecimento de conversa/fonte
  ya_periods.py     # janelas e comparações temporais
  ya_tools.py       # executores RPC, normalização e envelopes de evidência
  ya_dynamic_query.py # consulta exploratória somente leitura
  ya_schema.py      # descoberta cacheada das colunas mirror
  ya_context.py     # carregamento do contexto permanente
  YA_CONTEXT.md     # regras das dashboards e limites da agente
  ya_db.py          # conexão e execução parametrizada privada
  ya_memory.py      # estado estruturado e persistência da conversa
```

No frontend, os tipos de contrato permanecem em `src/services/yaChatService.ts`;
componentes de escopo/evidência ficam separados de `YaChat.tsx` para manter a
regra de componentes pequenos e a lógica de transporte fora da UI.

## Primeiro corte de capacidades

| Capacidade | Situação inicial | Limite explícito |
|---|---|---|
| `get_metric` | RPCs de vendas, negócios, ações, pedidos e serviços | somente IDs do catálogo |
| `get_breakdown` | blocos nomeados de vendedor, cidade, produto, etapa, motivo e status | top-N já produzido pela RPC |
| `get_timeseries` | séries mensais existentes | não reamostra snapshot |
| `compare_periods` | duas janelas equivalentes, filtros idênticos | base zero gera aviso |
| `drill_down` | listas paginadas já expostas por RPC | mesma coorte do agregado |
| `explain_metric` | leitura do catálogo | não usa RAG |
| `get_freshness` | `mirror.sync_control` | ausência de estado vira aviso |
| `get_entity_360` | cliente com resolução limitada | homônimo exige desambiguação |
| `correlate` | validação de compatibilidade | sem chave/coorte, retorna bloqueio legível |
| `open_data_query` | perguntas exploratórias e cruzamentos ainda não catalogados | somente SELECT/WITH em `mirror`, com timeout, limite e redaction |
| `conversation` / `source` | saudações, conversa e explicação da última evidência | não inventa números; fonte usa a última execução registrada |

## Banco e observabilidade

Uma migration aditiva cria colunas JSONB para estado de conversa, `QuerySpec` e
evidência, além de campos de intenção/linhagem/contagem/cache nos tool-runs e
turn metrics. A migration é apenas arquivo nesta sessão; não será aplicada sem
um alvo de banco confirmado.

Por turno, registrar intenção, versão de métrica, ferramentas, filtros pedidos e
efetivos, frescura, cardinalidade, latência por etapa, warnings, drill-down e
feedback. Falha de telemetria não pode derrubar uma resposta, mas deve gerar log
estruturado no serviço.

## Ordem de implementação

1. Catálogo e validação puros, com testes de contrato.
2. Gateway e envelope sobre RPCs existentes, com filtros realmente propagados.
3. Memória/evidência e migration aditiva.
4. Orquestração SSE e prompts do narrador.
5. Tipos/UI de escopo, evidência, série/tabela e feedback.
6. Testes de integração sem banco e smoke de boot; validação viva fica pendente
   até existir um ambiente autorizado.

## Riscos aceitos

- As migrations documentam os contratos, mas não comprovam a função instalada no
  ambiente vivo; isso ficará como `CONCERNS` até uma validação runtime.
- Algumas RPCs retornam resumos amplos ou têm séries com janela própria. O
  catálogo marca esse limite em vez de prometer granularidade inexistente.
- `YA_CONTEXT.md` é contexto curado, não RAG factual: explica o produto e as
  dashboards, mas nenhum número atual pode sair dele sem uma consulta viva.
