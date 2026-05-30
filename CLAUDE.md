<!-- AIVOUX-START v2.11.0 -->
# AIVOUX v2.10 - Lean AI Development Framework (Squad Mode)

Este projeto usa o **AIVOUX** — framework AI-Orchestrated para Claude Code
com YOLO mode (auto-orquestracao), Plan Mode (Opus + Sonnet automatico via
Task tool), e Discussion Mode (deliberacao multi-agente).

## Quick Start

Use o Smart Router para qualquer demanda:

```
/aivoux/router Corrigir bug de login
/aivoux/router Criar sistema de notificacoes em tempo real
/aivoux/router Auditar tech debt do projeto
```

O router analisa, delibera entre agentes quando apropriado, e executa o
squad inteiro automaticamente ate a entrega.

## Squad de Agentes (10)

### Planning Agents (Opus automatico)
- `/aivoux/agents/analyst` — Analise de negocio, pesquisa, PRD
- `/aivoux/agents/pm` — Product management, stories, priorizacao
- `/aivoux/agents/architect` — Arquitetura, design, brownfield discovery
- `/aivoux/agents/ux` — UX/UI design, fluxos, a11y

### Development Agents (Sonnet automatico)
- `/aivoux/agents/dev` — Implementacao + 12 best practices
- `/aivoux/agents/data-engineer` — Schemas, RLS, migrations
- `/aivoux/agents/qa` — Quality assurance + audit das 12 praticas
- `/aivoux/agents/devops` — Git push, PRs, CI/CD (EXCLUSIVO)

### Scan/Docs (Haiku automatico — barato)
- `/aivoux/agents/scribe` — Context scan (cache) + feature docs

### Meta
- `/aivoux/agents/squad-creator` — Criar squads customizadas

Comandos de agente usam prefixo `*` (ex: `*develop`, `*review`, `*push`).

## Principios (nao negociaveis)

1. **Context First** — Antes de criar ou alterar, entender o estado atual do projeto
2. **Quality First** — Lint, typecheck, tests e build devem passar
3. **12 Best Practices** — Aplicadas pelo @dev e validadas pelo @qa
4. **No Invention** — Implementar apenas o que foi especificado
5. **Agent Authority** — Apenas @devops pode fazer push/PR
6. **Squad Mode** — Agentes colaboram como time coeso

## Engineering Discipline (regras aplicadas a TODA sessao)

Estas regras vem de analise de padroes reais de falha em sessoes Claude Code:

### Scope Discipline
Nunca exceder o escopo pedido. Se notar um bug nao relacionado, **mencione
ao final** mas NAO corrija sem pedir autorizacao. Scope creep gera reverts
e desperdicio — uma tarefa de 1 fix vira 5 fixes nao validados.

### Artifact Inspection First (antes de adivinhar)
Ao corrigir bugs em **artefatos gerados** (templates, exports, arquivos
serializados, output de build, HTML/XML/DOCX/PDF/JSON gerados), **sempre
extraia literais reais do artefato** antes de editar. Nunca adivinhe nomes
de campos, chaves ou estrutura. Desempaquete, leia, entenda — depois edite.

### QA Runtime Verification (antes de PASS)
QA gate NUNCA emite PASS apenas por code inspection. Exige **verificacao
runtime**: rodar, ver output real (screenshot, log, arquivo gerado, teste
passando). Teorizar sobre deploy nao conta. Sem runtime visivel = sem PASS.

### Diagnose Before Fix
Em bugs de output/formatacao/comportamento: **adicione logging diagnostico
PRIMEIRO** para encontrar root cause. Nao aplique fixes especulativos. Um
fix errado quebra outras coisas e gasta 3× mais tokens que 1 log bem posto.

### Read Large Files with offset/limit
Arquivos > 2000 linhas: use Read com `offset` + `limit` em janelas de 500
linhas ao inves de ler tudo. "File Too Large" e um dos erros mais comuns
e consome tokens inutilmente.

### Deploy Tasks = Read-Only
Quando o trabalho e deploy/release/push, **nao edite codigo**. Se notar
problemas, liste ao final como observacao. Zero edits durante deploy.

## 12 Best Practices

DRY, no dead code, strict TypeScript, components <250 lines, efficient
state mgmt, proper React hooks, logic/UI separation, proper error handling,
performance optimizations, project structure, accessibility, adequate testing.

Detalhes em `.claude/rules/coding-standards.md`.

## 10 Security Standards

Secret mgmt, no frontend API exposure, input validation, auth/authz +
least privilege, common attacks (SQL/XSS/CSRF), secure logging,
password hashing, backup & recovery, dependency security, HTTPS + headers.

**Aplicacao situacional** — matrix por escopo (backend / frontend / infra / auth).
Detalhes em `.claude/rules/security-standards.md`.

## Modos de Operacao

- **YOLO Mode** (default on) — Pipeline end-to-end automatico
- **Plan Mode** (default on) — 3 tiers: Opus planning, Sonnet dev, Haiku scan/docs
- **Discussion Mode** (default on) — Agentes deliberam em paralelo antes de features MEDIUM/COMPLEX
- **Context Scan** (default on) — @scribe cacheia snapshot do projeto, re-scan so se stale
- **Documentation Mode** (default on) — @scribe gera `docs/features/{slug}.md` apos @qa PASS
- **Telemetry Mode** (default on) — Hooks coletam eventos em `.aivoux/telemetry/` (local, gitignored). Rode `/aivoux/insights` para relatorio
- **Context Watch** (default on) — Avisa quando sessao tem muitos turnos e sugere `/clear` para reduzir custo e melhorar foco. Threshold configuravel em `.aivoux/config.yaml`
- **Story Mode** (default off) — Cria story em docs/stories/ antes de implementar

Config: `.aivoux/config.yaml`

## Arquivos do Framework

- `.aivoux/config.yaml` — Modos e quality gates
- `.claude/rules/coding-standards.md` — 12 best practices detalhadas
- `.claude/rules/security-standards.md` — 10 security standards (situacional por escopo)
- `.claude/rules/discussion-protocol.md` — Protocolo de deliberacao
- `.claude/rules/shared-config.md` — Config compartilhada
- `.claude/rules/agent-authority.md` — Matriz de autoridade
- `.claude/commands/aivoux/router.md` — Smart Router
- `.claude/commands/aivoux/agents/*.md` — 9 agentes
- `.mcp.json` — MCP servers (supabase, playwright, context7, github, vercel, magic)

## Git Flow

`@dev` commita local → `@qa` revisa → `@devops` faz push + cria PR.
APENAS `@devops` pode fazer push/PR.

## Brownfield Discovery

Para projetos existentes, o router **automaticamente** faz context scan
antes de propor qualquer mudanca. Para audit profundo de tech debt:

```
/aivoux/agents/architect
*brownfield-discover
```
<!-- AIVOUX-END -->
