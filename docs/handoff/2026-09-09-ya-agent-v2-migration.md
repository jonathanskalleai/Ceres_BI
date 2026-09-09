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

Na etapa inicial da migration, o código v2 ainda não estava publicado; a
migration foi validada separadamente e o chat legado permaneceu como rollback.
Depois dessa validação, a publicação do código e a ativação da flag foram
executadas conforme a seção seguinte.

## Publicação do código

Depois da migration, o código foi publicado na mesma VPS pela branch
`release/bi-consolidacao-fase-1`. O SHA do código efetivamente publicado nos
serviços é `2ce52bd4ee237c61c628f98cd9545f44998fac3f`; commits posteriores
somente de documentação não alteram essa imagem de runtime.

- `ceresbi_web` e `ceresbi_ai`: `1/1`;
- `YA_AGENT_V2_ENABLED=true` no serviço AI;
- `VITE_YA_AGENT_V2_ENABLED=true` e
  `CERESBI_AI_YA_AGENT_V2_ENABLED=true` no `.env` da VPS;
- `/api/ai/v2/health`: `200`, `enabled=true`, provider configurado, banco de
  estado/analítico OK e 10 tools;
- web público: `200`;
- `/api/ai/health`: `200`;
- chamada v2 sem autenticação: `401`;
- bundle público contém a rota `/api/ai/v2/chat/stream`.

O deploy foi protegido por uma checagem no `deploy.sh` que compara a flag
esperada com o spec real do serviço; se divergirem, o deploy falha.

Para preservar um arquivo local não rastreado que conflitava com o checkout,
`ai-service/README.md` foi movido, sem apagar, para
`/home/jonathan/ceresbi-untracked-backup-20260909/ai-service/README.md` na VPS.

No momento há 2 contas com a permissão `bi.ya`, ambas com papel `admin`; não há
conta não-admin com essa permissão. Um usuário comum só verá/testará o chat
quando `bi.ya` for concedida a ele.

## Regra para próximas aplicações

Use sempre o playbook em
[`docs/architecture/production-runtime.md`](../architecture/production-runtime.md).
O alvo correto é `178.238.235.203`/`ceres-prod`; `147.93.182.245`/`ceres-vps` é
outro host e não deve receber migrations do Ceres BI. Descubra o nome atual do
container pelo filtro `name=supabase_supabase_db`; nunca reutilize um ID antigo.

Não use o projeto Supabase indicado em `supabase/config.toml` para produção:
este ambiente é Supabase self-hosted na VPS. Não registre credenciais, tokens ou
URLs com segredos em documentação, logs ou comandos versionados.
