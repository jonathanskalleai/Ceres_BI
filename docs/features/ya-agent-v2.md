---
feature: ya-agent-v2
updated_at: 2026-09-09T00:00:00-03:00
updated_by: codex
status: full-pipeline-pending-gates-and-runtime-release
plan: docs/plans/2026-09-08-agente-analitico-v2.md
---

# Agente Analítico Conversacional v2

Auditoria de conclusão atual: [`docs/handoff/2026-09-09-ya-agent-v2-completion-audit.md`](../handoff/2026-09-09-ya-agent-v2-completion-audit.md).

Este é o documento operacional do agente descrito no Plano v2. Ele existe para
que uma correção futura não volte ao fluxo antigo de resposta fixa, uma única
consulta ou concatenação de histórico.

## Diagnóstico do incidente de 09/09/2026

O runtime observado na VPS estava no SHA `2ce52bd4ee237c61c628f98cd9545f44998fac3f`,
com prompt `ya-agent-v2.1`. A chamada era de fato feita ao modelo e à tool,
mas o fluxo antigo permitia que o modelo escolhesse uma única consulta de
vendas sem um contrato server-side de comparação, não persistia o período no
estado da thread e gerava apenas o grupo de KPIs para perdas. Por isso:

- a pergunta comparativa retornava somente setembro, sem agosto, escopo ou
  variação;
- o diagnóstico e o detalhamento de perdas repetiam o último resumo;
- o texto podia transformar `45.060` em `4.506.000`, enquanto o card visual
  mostrava outro valor;
- o banco não era a causa daqueles números: as RPCs vivas retornaram os dados
  do recorte solicitado; o defeito estava na orquestração, no contrato e na
  verificação da resposta.

## Contrato vigente

Cada pergunta passa por uma interpretação JSON curta. O servidor então fixa o
contrato do turno antes do loop do modelo:

| Pergunta | Contrato obrigatório |
|---|---|
| resultado de vendas | `consultar_desempenho_vendas`, período atual até hoje, KPIs e resumo |
| comparação | `comparar_periodos`, dois períodos, mesmas métricas/filtros e variação |
| “diagnóstico dessas perdas” | vendas no recorte herdado, blocos de perdas e rankings |
| “detalhes das perdas” / “percas” | vendas no recorte herdado, motivos, rankings e produtos |
| produtos que explicam diferença | `comparar_periodos` + detalhe de vendas, na ordem definida pelo contrato |
| incluir/somente Repasse | modo de funil fixado no servidor e declarado na evidência |

Quando “este mês até agora” é comparado com “mês passado” sem cobertura
explícita, a UI recebe exatamente duas escolhas: “Agosto inteiro” ou “Mesmos N
dias”. Escolher uma delas envia uma nova mensagem livre e preserva a thread.

O loop permite até 6 rodadas do modelo, 8 chamadas de tool, 2 explorações
somente leitura e 90 segundos. A tool requerida é forçada no primeiro turno e
em uma tentativa de reparo. Datas, blocos, filtros e funil são corrigidos pelo
servidor; o modelo não pode trocar o recorte.

## Evidência, memória e apresentação

- Fato atual só pode vir de um `ToolExecution` bem-sucedido deste turno.
- O verificador rejeita números ausentes ou numericamente diferentes da
  evidência, inclusive formatação de ticket com valor alterado.
- A memória da thread guarda assunto, período, comparação, filtros, blocos e
  IDs de evidência; não trata a resposta anterior como fonte de números.
- A memória duradoura pertence ao `user_id`, aceita apenas conteúdo pessoal
  explicitamente fornecido e recusa segredo, contato, documento e números
  correntes do BI.
- A resposta pode conter conclusão, KPIs, tabelas de perdas/comparação,
  barras/linha, choices, fontes, competência, frescura e feedback. O frontend
  não interpreta HTML ou código produzido pelo modelo.

## Segurança e autorização

As rotas v2 exigem JWT válido, permissão `bi.ya` e escopo do próprio usuário.
O banco self-hosted aplica ownership/RLS nas conversas, mensagens, tool runs,
métricas e memórias. O modelo não recebe credenciais nem nomes de implementação
na resposta ao usuário. O modo exploratório é read-only e não persiste SQL bruto.

## Smoke

Local, no checkout:

```bash
cd ai-service
PYTHONPATH=. /tmp/ceres-bi-test312/bin/python -m unittest discover -s tests -v
cd ..
npx vitest run --reporter=dot
npx tsc --noEmit
npm run build
```

Runtime, no alvo correto (`root@178.238.235.203 -p 2222`, checkout
`/home/jonathan/ceresbi`):

```bash
curl -fsS https://ceresbi.vouxconsultoria.com.br/api/ai/v2/health
curl -i -X POST https://ceresbi.vouxconsultoria.com.br/api/ai/v2/chat \
  -H 'Content-Type: application/json' -d '{"message":"teste"}'
```

O primeiro comando precisa retornar `200`, `enabled=true`, provider e bancos
configurados, catálogo/prompt atuais e 10 tools. O segundo precisa retornar
`401`; nunca colocar JWT em documentação ou shell history compartilhado.

O smoke autenticado deve ser executado por uma conta autorizada com `bi.ya` e
registrar, sem conteúdo sensível:

1. “Como foi o resultado deste mês até agora, comparado com o mês passado?” →
   duas choices, não um resumo parcial;
2. “Agosto inteiro.” → dois períodos, cinco métricas e variações;
3. “Me manda um diagnóstico dessas percas.” → ferramenta de vendas, período
   herdado e tabelas de perdas;
4. “Me fala mais sobre as perdas, quero detalhes.” → detalhe adicional sem
   repetir apenas KPIs;
5. “Agora inclua Repasse.” e “Mostre somente Repasse.” → mudança explícita de
   conceito/funil;
6. marcar feedback, abrir nova thread e conferir que memória do usuário é
   recuperada sem compartilhar dados entre usuários.

Não declarar aprovação factual sem esse smoke autenticado. Se não houver sessão
autenticada disponível, o resultado deve ser registrado como pendente, não como
“testado”.

## Publicação e rollback

1. Confirmar branch/remote e migration já aplicada; não usar Supabase Cloud.
2. Executar o pipeline FULL e criar os verdicts ancorados ao SHA do código.
3. `git push origin release/bi-consolidacao-fase-1` somente após reviewer,
   security (escopo sensível), QA e observabilidade.
4. Na VPS, rodar `bash deploy.sh`; o script constrói imagens imutáveis com o
   SHA, valida as flags e atualiza o Swarm.
5. Conferir SHA remoto, `ceresbi_ai`/`ceresbi_web` `1/1`, health, `401`, web e
   smoke autenticado.

Rollback preferencial: desativar `YA_AGENT_V2_ENABLED` e
`VITE_YA_AGENT_V2_ENABLED` no próximo deploy, preservando o chat legado e os
dados persistidos. Para uma imagem específica, voltar ao SHA anterior pelo
mesmo `deploy.sh`; não apagar imagens, migrations, `.env` ou backups.

## Observabilidade

Cada turno registra trace pseudonimizado, modelo, prompt, intenção, rodadas,
tools, status, latência, tokens, custo estimado, fontes, warnings, artefatos,
feedback e categoria de falha. O logger remove token, autorização, senha,
segredo e PII conhecida. O frontend possui ErrorBoundary e recuperação de
chunks; antes de uma release com usuários reais também é obrigatório configurar
um canal externo de error tracking e receber um evento de teste. Enquanto
`observability.error_tracking` estiver vazio, o gate de produção permanece
bloqueado.

## Estado de aceite

Implementação local do Plano v2 e testes automatizados estão no checkout; a
migration de memória/trace já foi aplicada na base correta. A imagem antiga
descrita no diagnóstico não deve ser usada para validar o comportamento novo.
O SHA novo só pode ser chamado de publicado depois de boot, smoke autenticado,
regressão dos caminhos afetados e observabilidade comprovados no runtime.
