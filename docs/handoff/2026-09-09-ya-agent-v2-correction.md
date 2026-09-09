# Handoff — correção do Agente Analítico Conversacional v2

**Data:** 09/09/2026
**Plano:** [`docs/plans/2026-09-08-agente-analitico-v2.md`](../plans/2026-09-08-agente-analitico-v2.md)
**Feature doc:** [`docs/features/ya-agent-v2.md`](../features/ya-agent-v2.md)

## Motivo

O usuário reportou respostas repetidas e números mal formatados para comparação
e perdas. A investigação separou três fatos: o provedor suportava tool calling;
as RPCs vivas retornavam dados; o runtime antigo não impunha a semântica exigida
antes de deixar o modelo redigir.

## Alterações no checkout

- classificação semântica estruturada com data do servidor em São Paulo;
- contratos server-side para períodos, filtros, funil, blocos e ferramentas;
- loop real com múltiplas tools, `tool_choice`, limites e pós-condição;
- comparação de dois períodos com variação e escopo;
- diagnóstico/detalhamento de perdas com tabelas por motivo, vendedor, cidade,
  produto e origem;
- memória estruturada por assunto/thread e memória duradoura por usuário;
- trace de tool calls, métricas, fontes, artefatos, choices e feedback;
- verificador numérico que rejeita números fora da evidência deste turno;
- frontend para KPIs, tabela, barras, linha, choices, unidades e SSE;
- testes de transporte, contrato, incidente, hostil, memória e apresentação;
- arquivos centrais separados para manter o runner e o gateway revisáveis.

## Evidência técnica já coletada

- banco de produção correto: Supabase self-hosted na VPS `178.238.235.203:2222`;
- assinaturas das RPCs oficiais foram verificadas no container de banco;
- valores reais de setembro e agosto foram lidos somente para diagnóstico e
  não foram gravados como regra no código;
- teste controlado do OpenRouter confirmou: saudação sem tool, KPI com tool,
  chamada multi-tool e classificador JSON;
- migration `20260908_ya_agent_memory_and_tool_trace.sql` já foi aplicada;
- não há nova migration nesta correção.

## Checklist antes de declarar DONE

- [x] suíte backend local verde;
- [ ] Vitest, TypeScript, build e lint direcionado verdes no estado final;
- [ ] reviewer PASS ancorado ao SHA final;
- [ ] security PASS/SECURE ancorado ao SHA final;
- [ ] QA PASS com regressão e smoke;
- [ ] error tracking externo com evento recebido;
- [ ] push e SHA remoto verificados;
- [ ] boot/health/serviços e smoke autenticado golden verificados;
- [ ] documentação atualizada com SHA efetivamente publicado.

## Regra de segurança operacional

Não imprimir `.env`, JWT, chave OpenRouter, DSN ou PII. Não usar Supabase Cloud,
não apontar para `147.93.182.245`, não apagar backups e não considerar `git push`
como deploy. O rollback é a flag v2, seguido de novo deploy validado.
