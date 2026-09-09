# Handoff — chat conversacional de dados

**Data:** 08/09/2026  
**Branch:** `release/bi-consolidacao-fase-1`  
**SHA local:** `34794d42d4b2b6f3d248b7e6adfa452df3642a06`  
**Produção atual:** `443891485d8684529a28cb2b7e95103ab9ed9fe7` em `https://ceresbi.vouxconsultoria.com.br`

## Contexto

O usuário reportou que o chat não preservava contexto, mostrava o streaming técnico, formatava datas/valores no padrão americano e deixava evidências expostas como um relatório pré-pronto.

## Implementado no SHA local

- Memória no cliente com `conversationIdRef` + estado; o backend recebe resumo e últimas mensagens.
- SSE acumula a resposta e exibe apenas um estado `Pensando…`; o texto final aparece de uma vez.
- Resposta segura com parágrafos, listas e negrito; datas `dd/mm/aaaa`, horário de São Paulo, moeda `R$` e percentuais pt-BR.
- Evidências/escopo recolhidos em `Como foi calculado`.
- Pergunta fora do catálogo não reaproveita a métrica anterior; o planejador exige `metrics=[]` sem correspondência segura.
- Testes novos para memória, SSE, formatação e prompts.

Arquivos principais: `src/components/bi/YaChat.tsx`, `src/components/bi/ya-chat/YaChatAnswer.tsx`, `src/components/bi/ya-chat/YaChatEvidence.tsx`, `src/lib/yaChatFormatters.ts`, `src/services/yaChatService.ts`, `ai-service/ya_{chat,memory,prompts,semantics}.py`.

## Validação

- Python: **32 testes OK**.
- Vitest: **195 testes OK**.
- Build Vite: **OK**; há apenas aviso de chunks grandes.
- Reviewer no SHA atual: **PASS**.
- Security: **CONCERNS** por 8 vulnerabilidades high, 7 moderate e 1 low já existentes nas dependências; nenhum manifest foi alterado.
- `tsc`/lint global continuam falhando por baseline fora do diff; lint direcionado dos arquivos alterados passou.
- Smoke autenticado de memória, SSE, snapshot, histórico e feedback passou na produção anterior; ainda falta repetir no SHA atual.

## Próxima sessão — publicar e fechar

1. Confirmar que somente os commits `f23ae9b` e `34794d4` serão publicados; não adicionar o worktree sujo existente.
2. `git push origin release/bi-consolidacao-fase-1`.
3. No servidor, executar o `deploy.sh` com `SUPABASE_JWT_SECRET` obtido em memória do serviço `supabase_supabase_auth`; nunca imprimir o segredo.
4. Verificar SHA remoto, serviços `ceresbi_ai`/`ceresbi_web` em `1/1`, web e `/api/ai/health` `200`, chat sem autenticação `401`.
5. Repetir smoke autenticado: duas perguntas na mesma conversa (`Qual foi o faturamento?` → `E no mês anterior?`), SSE, snapshot de quilometragem, histórico/feedback e entradas vazia/grande/tipo inválido.
6. Atualizar `qa-verdict.json` para o SHA publicado e registrar o override autorizado pelo usuário antes do deploy, caso os gates baseline continuem pendentes.

Não executar `npm audit fix`, `git reset --hard`, limpeza de arquivos ou remoção dos backups remotos sem nova autorização explícita.
