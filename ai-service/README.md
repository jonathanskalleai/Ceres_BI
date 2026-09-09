# Serviço de IA — Agente Analítico Conversacional v2

O chat mantém `POST /ai/chat/stream` para compatibilidade e, quando
`YA_AGENT_V2_ENABLED=true`, usa `POST /ai/v2/chat/stream` (o REST
`POST /ai/v2/chat` segue a mesma seleção no frontend). O v2 recebe o JWT do
Supabase, mantém uma thread por conversa, conversa livre e consultas vivas do BI
com tool calling real. A resposta factual só é liberada depois de uma fonte
oficial retornar evidência no turno.

O núcleo v2 é dividido em:

- `ya_agent_intent.py` + `ya_agent_classifier_prompt.py`: interpretação semântica;
- `ya_agent_contract.py` + `ya_agent_periods.py`: contrato autoritativo do
  servidor para intenção, períodos, filtros, funil, blocos e ferramentas;
- `ya_agent_runner.py`: loop limitado de modelo → tools → evidência → resposta,
  com múltiplas ferramentas, verificação numérica e reparo único;
- `ya_agent_tools/`: dez contratos de ferramenta, RPCs oficiais, exploração
  somente leitura, memória e artefatos;
- `ya_memory.py` + `ya_memory_persistence.py`: memória de thread, memória
  duradoura por usuário, fontes e trace de cada tool call;
- `ya_agent_prompt.py`: prompt modular sem usar números da resposta anterior
  como evidência;
- `ya_provider.py`: transporte OpenAI-compatible com `tool_choice` e JSON mode;
- `ya_agent.py`: superfície HTTP/SSE e feature flag.

O agente usa RPCs parametrizadas para conceitos canônicos. Perguntas fora do
catálogo podem usar `consultar_banco_bi`, mas o servidor valida o SQL como
somente leitura, limita-o às tabelas `mirror`, aplica timeout, remove PII e
nunca envia SQL ou credenciais ao navegador.

O arquivo `YA_CONTEXT.md` é carregado no início de cada planejamento e redação.
Ele documenta dashboards, tabelas, regras de competência, deduplicação e
limitações conhecidas. O banco vivo continua sendo a fonte dos números atuais;
o arquivo não deve ser usado para inventar valores.

## Testes locais

Com as dependências do serviço instaladas, rode:

```bash
PYTHONPATH=ai-service python -m unittest discover -s ai-service/tests -v
```

Os testes de contrato cobrem interpretação, períodos equivalentes, comparação,
Repasse, diagnóstico/detalhamento de perdas, múltiplas tools, evidência, memória,
artefatos, sanitização, transporte, resposta inválida do provedor e limites do
gateway. A validação contra RPCs instaladas e dados vivos é um passo separado e
obrigatório antes da publicação.

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
- `YA_AGENT_V2_ENABLED=true` — ativa o runner sem retirar a rota legada, para
  rollback imediato por flag.
- `YA_AGENT_HISTORY_MESSAGES=18`
- `YA_AGENT_MEMORY_CONTEXT_CHARS=10000`
- `YA_SCHEMA_CACHE_TTL_SECONDS=300`
- `YA_DYNAMIC_QUERY_TIMEOUT_MS=8000`
- `YA_DYNAMIC_QUERY_LOCK_TIMEOUT_MS=1500`
- `YA_AGENT_INPUT_USD_PER_1K=0` e `YA_AGENT_OUTPUT_USD_PER_1K=0` para custo
  estimado opcional nas métricas.
- `CORS_ORIGINS=https://ceresbi.vouxconsultoria.com.br,http://localhost:5173`
- `VITE_ERROR_TRACKING_ENDPOINT` — endpoint externo para eventos de erro do
  frontend; é obrigatório quando `YA_AGENT_V2_ENABLED=true`, pois a release
  com usuários reais fica bloqueada pelo gate F5 sem canal e evento de teste.

## Ordem de publicação

1. Confirmar no alvo self-hosted que as migrations de chat/memória/trace já
   foram aplicadas; não reaplicar nem criar migration por causa de uma falha de
   interpretação.
2. Configurar `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`, o provedor e as flags no
   serviço `ceresbi_ai`, sem registrar valores.
3. Rodar os gates FULL, construir/publicar as imagens imutáveis de
   `ai-service/` e do frontend.
4. Conferir SHA remoto, boot, `/api/ai/v2/health`, `401` sem JWT e smoke
   autenticado dos golden questions antes de declarar release.

O runbook específico da VPS e o diagnóstico do incidente estão em
[`docs/features/ya-agent-v2.md`](../docs/features/ya-agent-v2.md) e
[`docs/handoff/2026-09-09-ya-agent-v2-correction.md`](../docs/handoff/2026-09-09-ya-agent-v2-correction.md).

Sem `SUPABASE_JWT_SECRET`, os endpoints protegidos falham fechados com `503`;
não publique a AI sem configurar esse segredo.
