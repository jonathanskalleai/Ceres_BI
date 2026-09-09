---
feature: ya-agent-v2
updated_at: 2026-09-09
source_plan: docs/plans/2026-09-08-agente-analitico-v2.md
local_sha: 757a37d963bb7588e248c846181edde513f9ed7e
remote_sha: de774d52be7bedaa67b6621f82bee0c5c9c3a61d
status: NOT_PUBLISHED_PENDING_FULL_GATES
---

# Auditoria de conclusão — Agente Analítico v2

Este documento é um registro de evidência, não uma autorização para publicar.
A especificação continua sendo o Plano v2. Toda validação de gate precisa estar
ancorada ao SHA exato do checkout no momento da validação.

## Estado autoritativo

| Item | Estado comprovado |
|---|---|
| Checkout local | Implementação atual no SHA `757a37d` |
| Branch remoto | `release/bi-consolidacao-fase-1` ainda em `de774d5` |
| Produção observada | Runtime antigo, prompt `ya-agent-v2.1`; não é evidência do código novo |
| Banco correto | Supabase self-hosted na VPS `178.238.235.203:2222`; migration de memória/trace já aplicada |
| Flags observadas no runtime antigo | v2 habilitada, mas isso não prova que o SHA novo esteja rodando |
| Dados de negócio | Somente leitura; nenhum número foi codificado como regra |
| Publicação do SHA atual | NÃO REALIZADA |

## Matriz de requisitos

| Requisito do Plano v2 | Evidência atual | Estado |
|---|---|---|
| Tool calling real e múltiplas tools | `ya_provider.py`, `ya_agent_runner.py`, `test_ya_agent.py`, `test_ya_agent_provider.py` | IMPLEMENTADO/VERIFICADO LOCAL |
| Contratos das 10 tools | `ya_agent_tools/registry.py`, schemas estritos e teste de contagem | IMPLEMENTADO/VERIFICADO LOCAL |
| Comparação de dois períodos e variações | `ya_agent_tools/analysis.py`, `ya_agent_contract.py`, testes de comparação | IMPLEMENTADO/VERIFICADO LOCAL |
| Follow-up e período herdado | `ya_agent_periods.py`, `ya_agent_intent.py`, testes de perdas/follow-up | IMPLEMENTADO/VERIFICADO LOCAL |
| Diagnóstico e detalhes de perdas | blocos `perdas`, `rankings`, `produtos`, artefatos e testes de “percas” | IMPLEMENTADO/VERIFICADO LOCAL |
| Repasse padrão/todos/somente | `funnel_scope`, contrato server-side e testes | IMPLEMENTADO/VERIFICADO LOCAL; falta smoke vivo |
| Memória de thread | `ya_memory.py`, estado por tópico, resumo e persistência | IMPLEMENTADO/VERIFICADO LOCAL; falta smoke vivo |
| Memória duradoura isolada por usuário | migration, endpoints, filtro por `user_id`, testes | IMPLEMENTADO/VERIFICADO LOCAL; falta smoke autenticado |
| Evidência factual e unidades | `ya_agent_verifier.py`, contrato de evidência e formatadores | IMPLEMENTADO/VERIFICADO LOCAL |
| Tabelas, barras, linhas e choices | `AgentArtifact`, `YaChatArtifacts.tsx`, Vitest | IMPLEMENTADO/VERIFICADO LOCAL |
| SSE, cancelamento e compatibilidade | `ya_agent.py`, `yaChatService.ts`, testes de chunks/CRLF | IMPLEMENTADO/VERIFICADO LOCAL; falta runtime |
| Auth/JWT/bi.ya/RLS | `auth.py`, rotas protegidas, migration e testes de API | IMPLEMENTADO/INSPEÇÃO LOCAL; falta smoke autorizado |
| SQL exploratório read-only | `ya_dynamic_query.py`, `sqlglot`, allowlist e testes hostis | IMPLEMENTADO/VERIFICADO LOCAL |
| Observabilidade | métricas/trace/log sanitizado e reporter cliente | PARCIAL: sem canal externo e evento de teste |
| Golden questions | `agent_golden_questions.json` e testes de contrato | PARCIAL: falta execução factual autenticada |
| Conciliação com dashboards/RPCs vivas | consultas diagnósticas anteriores | PENDENTE NO SHA ATUAL |
| Reviewer, security e QA FULL | arquivos de gate não ancorados ao SHA atual | PENDENTE/BLOQUEADO F6 |
| Push, boot, health, smoke e rollback | `deploy.sh` endurecido e runbook | PENDENTE; nenhum deploy do SHA atual |

## Evidência local repetível

No checkout atual, os comandos abaixo passaram:

```bash
PYTHONPATH=ai-service /tmp/ceres-bi-test312/bin/python -m unittest discover -s ai-service/tests
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
bash -n deploy.sh
git diff --check
```

Resultado registrado: 100 testes Python, 200 testes Vitest, TypeScript/build e
lint direcionado verdes. O lint global e o `npm audit` continuam com problemas
de baseline fora do escopo; não tratá-los como aprovação geral.

## Golden runtime obrigatório antes de DONE

Executar com conta real autorizada, sem registrar JWT, PII ou resposta integral:

1. saudação sem tool;
2. comparação ambígua retornando as duas opções;
3. escolha “Agosto inteiro” com dois períodos e variações;
4. diagnóstico de “percas” com tabelas de perda;
5. detalhamento adicional sem repetir apenas KPIs;
6. inclusão e isolamento de Repasse;
7. sequência vendas → equipe → ações → vendas;
8. memória em nova thread do mesmo usuário;
9. isolamento de memória em outro usuário;
10. feedback, tabela, gráfico, loading, vazio, erro e cancelamento.

Cada caso deve conferir a evidência da tool, competência, período, filtro,
unidade e igualdade com os cards correspondentes. Contratos unitários não
substituem este smoke.

## Sequência segura para a próxima IA

1. Ler o Plano v2 e este documento.
2. Conferir `git rev-parse HEAD`, branch e o SHA remoto sem imprimir URL/token.
3. Preservar as alterações não relacionadas do usuário; não fazer reset/checkout
   destrutivo e não aplicar novamente a migration já instalada.
4. Se o código mudar, executar reviewer; em escopo sensível, security; depois
   QA com blast radius e os smokes das features afetadas.
5. Em qualquer timeout de agente: uma retentativa; se falhar novamente, parar e
   pedir direção. Não fabricar `PASS`, `WAIVED` ou reaproveitar veredito de outro
   SHA.
6. Configurar um canal externo de error tracking e confirmar um evento de teste.
   Nunca colocar DSN secreto ou webhook secreto no bundle do frontend.
7. Obter sessão autenticada de usuário/admin e executar os golden runtime.
8. Só depois de reviewer/security/QA atuais e observabilidade comprovada, usar
   `@devops` para push e `bash deploy.sh` no checkout da VPS correta.
9. Conferir SHA remoto, imagens imutáveis, serviços `1/1`, health v2, `401` sem
   JWT, smoke autenticado e rollback por flags.
10. Atualizar este arquivo e o feature doc somente com o SHA efetivamente
    publicado.

## Proibições operacionais

- Não usar `147.93.182.245` nem Supabase Cloud para este agente.
- Não imprimir `.env`, JWT, chave do provedor, DSN, Authorization ou PII.
- Não conceder `bi.ya` a usuários comuns sem solicitação/autorização explícita.
- Não declarar que o SHA novo está publicado porque o health do runtime antigo
  respondeu `200`.
- Não apagar backups, tabelas, migrations, imagens ou o chat legado durante o
  rollout/rollback.
