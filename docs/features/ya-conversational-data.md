---
feature: ya-conversational-data
updated_at: 2026-09-08T22:45:00Z
updated_by: codex
status: active
---

# Assistente conversacional de dados

**Propósito:** conversar naturalmente e responder BI com contexto, comparação,
detalhe e evidência. O modelo pode propor uma consulta exploratória, mas quem
valida e executa o SQL é o servidor em modo somente leitura.

## Entry Points
- `src/components/bi/YaChat.tsx` — chat no `BiLayout`.
- `src/services/yaChatService.ts` — REST/SSE e feedback.
- `ai-service/ya_chat.py` — auth, memória e streaming.
- `ai-service/ya_catalog.py`, `ya_catalog_extensions.py`, `ya_semantics.py` — catálogo, snapshots e `QuerySpec`.
- `ai-service/ya_tools.py`, `ya_snapshot_tools.py` — gateway e adaptadores determinísticos para RPCs.
- `ai-service/ya_dynamic_query.py`, `ya_schema.py` — consulta exploratória validada e schema runtime.
- `ai-service/ya_context.py`, `ai-service/YA_CONTEXT.md`, `ya_intents.py` — contexto permanente e conversa natural.

## Database
- Tabelas: `ya_chat_conversations`, `ya_chat_messages`, `ya_chat_tool_runs`, `ai_chat_turn_metrics`.
- RLS/ownership: JWT, permissão `bi.ya` e `user_id` validados pela API.
- Migration aditiva: `supabase/migrations/20260908_ya_chat_semantic_core.sql`.

## Padrões
- RPCs aprovadas continuam sendo preferidas para cards conhecidos; perguntas abertas usam apenas tabelas de negócio autorizadas em `mirror`.
- Evidência traz escopo, definição, competência, frescura, linhagem e preview sanitizado; consultas exploratórias não persistem SQL bruto.
- Snapshots de produtos, administração, operação e frescura usam contratos explícitos sem janela temporal; comparações/séries não são inventadas.
- Testes: `ai-service/tests/` e `src/services/__tests__/`.

## Como Alterar com Segurança
1. Atualizar catálogo, aliases, filtros e contratos de RPC juntos; não criar KPI implícito.
2. Preservar coorte e redaction de PII antes do prompt/UI.
3. Rodar testes, build e smoke SQL autorizado.

## Smoke
- `ai-service/tests/` → 53 testes verdes no ambiente Python do serviço.
- `npx --no-install vitest run --reporter=dot` → 22 arquivos / 195 testes; `npm run build` → concluído (aviso de chunks >500 kB).
- Imagem Docker nova → build e testes verdes; boot local `/health` → HTTP 200. SQL/RPC, SSE e UI autenticados em produção continuam pendentes sem publicação/credenciais nesta sessão.

## Riscos / Acoplamentos
- RPCs e números do mirror precisam de validação viva antes do release.
- `ya_catalog.py`, `ya_semantics.py` e `ya_tools.py` estão na zona de aviso de tamanho.
- `DATABASE_URL`, credenciais Supabase/JWT e `OPENROUTER_API_KEY` não estão disponíveis nesta sessão.
- ETLs novos, RAG e dashboards ficaram fora deste incremento.
