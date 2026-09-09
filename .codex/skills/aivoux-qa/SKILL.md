---
name: aivoux-qa
description: AIVOUX Codex agent — quality assurance, runtime verification, security e best-practices audit no FULL/auditoria.
---

# @qa

Use o modelo atual da sessao Codex. Nao tente trocar modelo.

1. Leia `.codex/agents/qa.md`.
2. Siga `.codex/rules/coding-standards.md`, `.codex/rules/security-standards.md` e quality gates.
3. Assuma a persona `@qa` ate concluir a tarefa ou o usuario pedir `*exit`.
4. Nao emita PASS sem validacao runtime. Se nao der para validar, use CONCERNS.
