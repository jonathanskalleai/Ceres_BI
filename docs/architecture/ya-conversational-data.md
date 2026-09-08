# Arquitetura — Assistente conversacional de dados

**Escopo:** primeiro incremento executável das fases 0–3 do plano de 2026-09-08.
**Estado:** desenho para implementação; a instalação das RPCs no Postgres vivo não
foi validada nesta sessão porque as credenciais de conexão não estão disponíveis.

## Decisões

### Catálogo antes do modelo

O serviço mantém um catálogo versionado em `ai-service/ya_catalog.py`. Cada
métrica declara definição, unidade, entidade/grão, coluna de competência,
deduplicação, dimensões aceitas, executor, versão, disponibilidade e suporte a
drill-down. O catálogo é o contrato que o narrador pode explicar; documentos
históricos não substituem essa fonte.

### QuerySpec validado

Toda pergunta passa por um `QuerySpec` limitado por Pydantic. O planejador pode
sugerir intenção e argumentos, mas não SQL nem ferramenta fora do catálogo. A
validação rejeita métrica desconhecida, dimensão incompatível, filtro não
suportado, período inválido e comparação entre coortes incompatíveis antes de
consultar o banco. O parser determinístico cobre os follow-ups mais importantes
quando o planejador não estiver disponível.

### Gateway determinístico

`ai-service/ya_tools.py` é o único ponto que conhece os executores de dados.
`ai-service/ya_db.py` concentra a conexão privada. Inicialmente o gateway
reutiliza RPCs existentes e normaliza seus blocos nomeados;
novas fontes precisam de um executor e de testes dourados antes de entrarem no
catálogo. O gateway nunca recebe SQL do modelo e não libera conexão ao cliente.

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
por conexão privada do serviço, com RPCs `SECURITY DEFINER` já aprovadas. O
drill-down usa somente colunas aprovadas e paginação; não expõe CNPJ, telefone,
e-mail, SQL ou credenciais. Alterações em auth, entrada externa e dados de CRM
passam pelo gate de segurança.

## Organização proposta

```text
ai-service/
  ya_chat.py        # API, SSE e ciclo de turno
  ya_catalog.py     # métricas, dimensões e executores versionados
  ya_query_models.py # contratos Pydantic do plano
  ya_semantics.py   # parser e validação
  ya_periods.py     # janelas e comparações temporais
  ya_tools.py       # executores RPC, normalização e envelopes de evidência
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
- Não haverá RAG nesta entrega: adicionar documentos antes de estabilizar a
  semântica aumentaria o risco de explicação histórica ser usada como fato atual.
