<!-- AIVOUX-CODEX-START v2.21.0 -->
# AIVOUX — Codex Runtime

Este projeto usa o **AIVOUX** tambem no Codex.

O modulo Claude Code continua separado em `CLAUDE.md` e `.claude/`. No Codex,
use este arquivo, `.codex/skills/` e `.codex/agents/`.

## Como usar

Use o router para qualquer demanda:

```text
@router Corrigir bug de login
@router Criar sistema de notificacoes em tempo real
@router Auditar tech debt do projeto
```

Se o cliente Codex expuser skills na interface, prefira a skill
`aivoux-router`.

## Runtime Codex

- Use sempre o modelo atualmente escolhido na sessao Codex.
- Nao tente trocar modelo por agente.
- As configuracoes Claude `model_tier`, Opus, Sonnet e Haiku nao se aplicam ao
  Codex; elas continuam existindo apenas para Claude Code.
- Preserve a mesma disciplina de pipeline, handoff, autoridade e quality gates
  do AIVOUX.

## Agentes

- `@analyst` — pesquisa, analise, discovery
- `@pm` — requisitos, PRD, stories, priorizacao
- `@architect` — arquitetura, design tecnico, brownfield discovery
- `@ux` — UX/UI design, fluxos, a11y
- `@dev` — implementacao, testes, 12 best practices
- `@data-engineer` — schemas, RLS, migrations
- `@reviewer` — code-quality gate no modo FULL/auditoria: DRY, monolitos (aviso 300 / gate 400), dead code, estrutura. DEVELOPMENT registra a pendencia
- `@security` — security gate CONDICIONAL no FULL/auditoria: 10 security standards + threat model (auth/API/dados sensiveis/upload/secrets/deploy); verdict VULNERABLE volta ao @dev. Defensivo
- `@qa` — quality assurance, runtime verification, regressao (F4), audit das praticas no FULL/auditoria; DEVELOPMENT registra para depois
- `@devops` — git push, PRs, releases, CI/CD; em DEVELOPMENT publica apenas branch/PR/preview nao produtivo
- `@squad-creator` — criar squads/agentes customizados

## Atalhos

Quando o usuario chamar `@router`, `/aivoux/router` ou `aivoux-router`,
carregue `.codex/skills/aivoux-router/SKILL.md`.

Quando o usuario chamar `@dev`, `@qa`, `@architect`, `@security` etc., carregue a
skill correspondente em `.codex/skills/aivoux-{agent}/SKILL.md`.

Para revisar pendencias do modo development, carregue
`.codex/skills/aivoux-audit/SKILL.md`. Para auditar a seguranca de um sistema
EXISTENTE (read-only, relatorio + backlog), carregue
`.codex/skills/aivoux-audit-security/SKILL.md`.

## Regras Base

- Antes de implementar, pesquise o codigo existente com `rg`/leituras focadas.
- Nao invente requisitos fora da demanda.
- Mutacoes devem seguir a autoridade em `.codex/rules/agent-authority.md`.
- Para codigo, rode os quality gates aplicaveis antes de concluir.
- Se nao for possivel validar runtime, informe a limitacao claramente.

## Modos, gates e pipeline (F4/F5/F6 — no Codex sao COMPORTAMENTAIS)

> ⚠ **Diferenca critica vs Claude Code:** no Claude Code estes gates sao
> MECANICOS — hooks (`deploy-gate.sh`, `review-gate.sh`, `security-gate.sh`,
> `docs-gate.sh`) que BLOQUEIAM de verdade, mesmo se a IA esquecer. **O Codex
> NAO executa hooks.** Aqui NADA bloqueia sozinho: os gates valem como
> obrigacao comportamental do orquestrador. Pular uma etapa no Codex nao
> dispara erro — so quebra o pipeline em silencio. A disciplina e sua.

- **DEVELOPMENT (`*dev`, `*development`, alias `*fast`):** mantém planejamento,
  banco, `@dev` e `@devops` para branch/PR/preview, mas não aciona `@reviewer`,
  `@security` ou `@qa` na demanda. Toda mudança de código/schema vai para
  `pipeline_mode.pending_dir` com `PENDING_REVIEW`.
- **FULL (`*full`):** `dev → reviewer → security (condicional) → qa → devops`.
  Aqui a regra F6 é obrigatória: etapa falhou → retry 1x → PARAR e perguntar;
  inline só autorizado = `INLINE_DEGRADED` (nunca PASS).
- **Produção/merge/release:** `@devops` exige auditoria FULL para os registros
  pendentes, mesmo que a implementação tenha sido feita em DEVELOPMENT.
- **@security condicional:** no modo FULL entra (após `@reviewer`, antes do `@qa`)
  quando o diff toca superfície sensível (auth/authz/RLS/entrada externa/dados
  sensíveis/upload/secrets/deploy). VULNERABLE volta ao @dev.
- **Regressao (F4):** compute o blast radius do diff e rode o `## Smoke` das
  features afetadas + `critical_paths` no @qa. Ver `.codex/rules/regression-gate.md`.
- **Observability (F5):** codigo novo — nenhum `catch` sem log; deploy com
  usuarios reais — error tracking com evento de teste recebido + `/health`. Ver
  `.codex/rules/observability-standards.md`.
- **Deploy (F1):** `git push` exit 0 ≠ deploy OK. Boot + smoke + SHA no remoto
  antes de DONE. Ver `.codex/rules/deploy-safety.md`.
- **@devops** exige `qa-verdict.json` + `reviewer-verdict.json` PASS no
  FULL/merge/release/producao; DEVELOPMENT fica limitado a branch/PR/preview
  nao produtivo. No FULL, os verdicts ficam ancorados ao SHA atual (e
  `security-verdict.json` SECURE se o escopo for sensivel).

## Conduta (NAO NEGOCIAVEL — ver `.codex/rules/agent-conduct.md`)

- **Honestidade brutal:** nenhum agente bajula. Se a ideia e ruim, diga que e ruim,
  com o porque e a alternativa. Sem elogio automatico, sem concordar para agradar,
  sem desculpas teatrais. Reporte o estado real (nao funciona / nao testei / nao sei).
  Empurrar de volta ma pratica e dever, nao opcao.
- **Nunca deletar/sobrescrever sem perguntar:** QUALQUER delete destrutivo exige
  confirmacao EXPLICITA do usuario. `.env`, chaves e segredos: jamais sem o usuario
  mandar e confirmar. (No Codex nao ha hook de bloqueio como no Claude Code — aqui a
  regra e comportamental e ABSOLUTA; na duvida, pergunte antes.)

<!-- AIVOUX-CODEX-END -->
