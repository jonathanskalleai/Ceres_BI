# Handoff — migration do Agente Analítico v2

**Data:** 09/09/2026 03:32 UTC

**Migration:** `supabase/migrations/20260908_ya_agent_memory_and_tool_trace.sql`

**Alvo:** `ceres-prod` → `178.238.235.203:2222`

**Banco:** container Swarm `supabase_supabase_db`, database `postgres`

## Resultado

A migration foi aplicada remotamente com `psql -X -v ON_ERROR_STOP=1` e terminou
com `COMMIT`. O schema foi recarregado com `pg_notify('pgrst', 'reload schema')`.

Validações realizadas:

- `ya_user_memories`, `ya_chat_*` e `ai_chat_turn_metrics` existem;
- RLS ativo nas tabelas de memória, mensagens, tools e métricas;
- policy `Users read own Ya memories` usa `user_id = auth.uid()`;
- tentativa de `INSERT` como `authenticated` foi rejeitada por RLS e revertida;
- `ceresbi_ai` e `ceresbi_web` estavam `1/1`;
- web público respondeu `200`;
- `/api/ai/health` respondeu `200`.

O código v2 não foi publicado nesta operação: o endpoint v2 continua atrás da
flag desligada e o chat legado permanece o rollback. Portanto, o endpoint
`/api/ai/v2/chat/stream` não foi usado como smoke de código nesta etapa.

## Regra para próximas aplicações

Use sempre o playbook em
[`docs/architecture/production-runtime.md`](../architecture/production-runtime.md).
O alvo correto é `178.238.235.203`/`ceres-prod`; `147.93.182.245`/`ceres-vps` é
outro host e não deve receber migrations do Ceres BI. Descubra o nome atual do
container pelo filtro `name=supabase_supabase_db`; nunca reutilize um ID antigo.

Não use o projeto Supabase indicado em `supabase/config.toml` para produção:
este ambiente é Supabase self-hosted na VPS. Não registre credenciais, tokens ou
URLs com segredos em documentação, logs ou comandos versionados.
