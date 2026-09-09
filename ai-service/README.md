# Serviço de IA — Chat do BI

O chat usa `POST /ai/chat/stream` (SSE) para entregar a resposta
progressivamente. Ele recebe o JWT do Supabase, mantém uma thread por conversa,
responde conversa livre e consulta os dados vivos do BI. `POST /ai/chat`
permanece como compatibilidade sem streaming.

O núcleo conversacional separa `ya_catalog.py` (métricas e contratos),
`ya_semantics.py`/`ya_periods.py` (QuerySpec e período), `ya_tools.py` (gateway
determinístico), `ya_dynamic_query.py` (consulta exploratória somente leitura),
`ya_schema.py` (schema vivo), `ya_context.py`/`YA_CONTEXT.md` (contexto do
produto), `ya_memory.py` (estado/evidência) e `ya_provider.py` (transporte do
modelo). Perguntas canônicas continuam usando RPCs parametrizadas; perguntas
fora do catálogo podem usar um SELECT/WITH gerado pelo modelo, mas o servidor
valida a instrução, limita-a às tabelas `mirror`, aplica timeout/read-only,
remove PII e nunca envia SQL ou credenciais ao navegador.

O arquivo `YA_CONTEXT.md` é carregado no início de cada planejamento e redação.
Ele documenta dashboards, tabelas, regras de competência, deduplicação e
limitações conhecidas. O banco vivo continua sendo a fonte dos números atuais;
o arquivo não deve ser usado para inventar valores.

## Testes locais

Com as dependências do serviço instaladas, rode:

```bash
PYTHONPATH=ai-service python -m unittest discover -s ai-service/tests -v
```

Os testes de contrato cobrem validação semântica, períodos equivalentes/ano
anterior, filtros, breakdowns, correlação pareada, sanitização e limites do
gateway. A validação contra RPCs instaladas e dados vivos continua sendo um
passo de ambiente autorizado.

## Variáveis obrigatórias

- `DATABASE_URL`: conexão privada com o Postgres do BI.
- `STATE_DATABASE_URL`: conexão de estado/memória; durante o desenvolvimento pode
  cair de volta para `DATABASE_URL`.
- `ANALYTICAL_DATABASE_URL`: conexão read-only das RPCs e exploração; durante o
  desenvolvimento pode cair de volta para `DATABASE_URL`.
- `OPENROUTER_API_KEY`: chave do provedor de IA.
- `AI_JOB_TOKEN`: token dos jobs semanais já existentes.
- `SUPABASE_JWT_SECRET`: mesmo segredo JWT configurado no Supabase self-hosted.

## Variáveis opcionais

- `SUPABASE_JWT_AUDIENCE=authenticated`
- `YA_CHAT_MODEL=meta-llama/llama-3.3-70b-instruct`
- `YA_AGENT_V2_ENABLED=false` — habilita apenas as rotas v2 após o preflight.
- `YA_AGENT_HISTORY_MESSAGES=18`
- `YA_AGENT_MEMORY_CONTEXT_CHARS=10000`
- `YA_SCHEMA_CACHE_TTL_SECONDS=300`
- `YA_DYNAMIC_QUERY_TIMEOUT_MS=8000`
- `YA_DYNAMIC_QUERY_LOCK_TIMEOUT_MS=1500`
- `YA_AGENT_INPUT_USD_PER_1K=0` e `YA_AGENT_OUTPUT_USD_PER_1K=0` para custo
  estimado opcional nas métricas.
- `CORS_ORIGINS=https://ceresbi.vouxconsultoria.com.br,http://localhost:5173`

## Ordem de publicação

1. Aplicar `supabase/migrations/20260822_ya_chat.sql`,
   `20260822_ai_chat_name.sql`, `20260822_ai_chat_threads.sql` e, depois,
   `20260908_ya_chat_semantic_core.sql`.
2. Configurar `SUPABASE_JWT_SECRET` e `CORS_ORIGINS` no serviço `ceresbi_ai`.
3. Construir/publicar a imagem de `ai-service/`.
4. Construir/publicar o frontend.

Sem `SUPABASE_JWT_SECRET`, os endpoints protegidos falham fechados com `503`;
não publique a AI sem configurar esse segredo.
