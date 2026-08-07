<!-- AIVOUX-START v2.14.0 -->
# AIVOUX v2.14 - Lean AI Development Framework (Squad Mode)

Este projeto usa o **AIVOUX** — framework AI-Orchestrated para Claude Code
com YOLO mode (auto-orquestracao), Plan Mode (todos os agentes em Opus via
Task tool; scribe em Haiku), e Discussion Mode (deliberacao multi-agente).

## Quick Start

Use o Smart Router para qualquer demanda:

```
/aivoux/router Corrigir bug de login
/aivoux/router Criar sistema de notificacoes em tempo real
/aivoux/router Auditar tech debt do projeto
```

O router analisa, delibera entre agentes quando apropriado, e executa o
squad inteiro automaticamente ate a entrega.

## Squad de Agentes (11)

> Todos os agentes rodam **Opus** (scribe em Haiku). Sem tiers, sem modo economy.

### Planning Agents (Opus)
- `/aivoux/agents/analyst` — Analise de negocio, pesquisa, PRD
- `/aivoux/agents/pm` — Product management, stories, priorizacao
- `/aivoux/agents/architect` — Arquitetura, design, brownfield discovery
- `/aivoux/agents/ux` — UX/UI design, fluxos, a11y

### Development Agents (Opus)
- `/aivoux/agents/dev` — Implementacao + 12 best practices
- `/aivoux/agents/data-engineer` — Schemas, RLS, migrations
- `/aivoux/agents/reviewer` — Code-quality gate: DRY, monolitos (gate 300), dead code, estrutura
- `/aivoux/agents/qa` — Quality assurance + audit das 12 praticas + runtime + seguranca
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
7. **Honestidade Brutal** — Nenhum agente bajula. Se a ideia e ruim, diz que e ruim,
   com o porque e a alternativa. Sem elogio automatico, sem concordar para agradar,
   sem desculpas teatrais. Reporta o estado real (nao funciona / nao testei / nao sei).
   Empurrar de volta ma pratica e DEVER, nao opcao. Detalhes em `agent-conduct.md` §0.
8. **Nunca deletar sem perguntar** — QUALQUER delete/sobrescrita destrutiva exige
   confirmacao EXPLICITA do usuario. `.env`, chaves e segredos: NUNCA, jamais, sem o
   usuario mandar. Reforco deterministico em `.claude/hooks/delete-guard.sh` (bloqueia
   de fato; regra em prosa nao basta). Se o hook bloquear: PARE, explique, deixe o
   usuario executar — nao tente contornar.

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

### Deploy Safety (F1) — boot + smoke antes de DONE
`git push` exit 0 ≠ deploy funcionando. Apos qualquer deploy/release: o servico
DEVE subir limpo (boot check) e processar >=1 payload real (smoke test) antes de
declarar DONE. Reportar SHA do **remoto**, nunca do local stale. Detalhes em
`.claude/rules/deploy-safety.md`.

### Environment Preflight (F3) — verificar alvo antes de mutar remoto
Antes de push/SSH/SQL em prod/deploy: confirmar repo (`git remote -v`), branch,
host/VPS e DB ALVO (ativo, nao descomissionado), e citar a evidencia. Detalhes em
`.claude/rules/change-safety.md` A.

### Confirm Mental-Model (F2) — antes de editar dados/semantica ambigua
Mudanca que toca modelo de dados ou regra de negocio com requisito ambiguo:
enunciar o modelo entendido + blast radius e ter OK antes de editar quando muda
comportamento existente ou e irreversivel. Detalhes em `.claude/rules/change-safety.md` B.

### Context Rehydration (automatica)
Apos qualquer compactacao ou /clear, o hook `context-watch.sh` injeta
automaticamente o estado salvo em `.aivoux/session-digest.md` no seu contexto.
Ao receber `[AIVOUX-REHYDRATION]`: leia o digest injetado, diga ao usuario em
1 frase o que esta retomando, e continue trabalhando sem pedir para repetir.
Ao receber `[AIVOUX-COGNITIVE-SAVE]`: salve silenciosamente seu estado cognitivo
em `.aivoux/session-digest.md` usando o template fornecido e continue normalmente.
Ao receber `[AIVOUX-AUTO-COMPACT]`: salve estado, processe a demanda do usuario,
e execute /compact. Nao peca permissao — o sistema cuida da rehydration apos.
Se a injecao nao acontecer (hook desabilitado), leia `.aivoux/session-digest.md`
ANTES de qualquer acao e retome sem perguntar ao usuario.

## Infrastructure (preencher por projeto)

> **Template — substitua pelos valores reais do seu projeto.** Esta secao existe
> para eliminar wrong-repo / wrong-DB / wrong-VPS. Deixe explicito o que e canonico.

- **Repo canonico:** `git@github.com:ORG/REPO.git` (confirmar com `git remote -v`)
- **Branch de producao:** `main`
- **Banco ATIVO:** {host/projeto Supabase} — ⚠ NAO usar instances descomissionados
- **VPS/host de producao:** {IP/hostname canonico}
- **Self-hosted?** {sim/nao — ex: Supabase self-hosted na VPS, nao Cloud}
- **Comando de smoke test:** {ex: curl payload de teste ao webhook e conferir 200 + persistencia}

## 12 Best Practices

DRY, no dead code, strict TypeScript, components <300 lines (HARD gate, FAIL acima; meta <200), efficient
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
- **Plan Mode** (default on) — Opus para TODOS os agentes (exceto scribe/Haiku). Sem tiers, sem modo economy.
- **Discussion Mode** (default on) — Agentes deliberam em paralelo antes de features MEDIUM/COMPLEX
- **Context Scan** (default on) — @scribe cacheia snapshot do projeto, re-scan so se stale
- **Documentation Mode** (default on) — @scribe gera `docs/features/{slug}.md` apos @qa PASS
- **Telemetry Mode** (default on) — Hooks coletam eventos em `.aivoux/telemetry/` (local, gitignored). Rode `/aivoux/insights` para relatorio
- **Context Watch** (default on) — Avisa quando sessao tem muitos turnos e sugere `/clear` para reduzir custo e melhorar foco. Threshold configuravel em `.aivoux/config.yaml`
- **Context Rehydration** (default on) — Salva estado cognitivo a cada N turnos e re-injeta automaticamente apos compactacao/clear. Status line mostra T:N e CTX:Xk/Yk. Config em `.aivoux/config.yaml`
- **Story Mode** (default off) — Cria story em docs/stories/ antes de implementar

Config: `.aivoux/config.yaml`

## Arquivos do Framework

- `.aivoux/config.yaml` — Modos e quality gates
- `.claude/rules/coding-standards.md` — 12 best practices detalhadas
- `.claude/rules/security-standards.md` — 10 security standards (situacional por escopo)
- `.claude/rules/deploy-safety.md` — gate de boot + smoke test pre-deploy (F1)
- `.claude/rules/change-safety.md` — preflight de alvo (F3) + confirmacao de modelo (F2)
- `.claude/rules/discussion-protocol.md` — Protocolo de deliberacao
- `.claude/rules/shared-config.md` — Config compartilhada
- `.claude/rules/agent-authority.md` — Matriz de autoridade
- `.claude/rules/agent-conduct.md` — NEVER/ALWAYS: honestidade brutal (§0) + nunca deletar sem confirmar
- `.claude/commands/aivoux/router.md` — Smart Router
- `.claude/commands/aivoux/agents/*.md` — 10 agentes (inclui @reviewer)
- `.claude/hooks/quality-guard.sh` — enforcement do gate de 300 linhas + `any`
- `.claude/hooks/delete-guard.sh` — BLOQUEIA delecao/sobrescrita de .env, chaves, segredos, .git e rm -rf perigoso (PreToolUse)
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
## 🤖 Instruções para o Claude Code (Auto-Registro)
- Você está conectado ao meu Obsidian via MCP (servidor `mcp-tools-istefox`).
- O alvo do auto-registro é a nota do vault Obsidian **`Log-Sessoes-Ceres.md`** — NÃO este `CLAUDE.md` de disco (o MCP do Obsidian só enxerga o vault, então não consegue editar arquivos fora dele).
- **LEITURA (no início de qualquer trabalho no Ceres BI):** antes de agir, leia `Log-Sessoes-Ceres.md` via MCP do Obsidian (`get_vault_file`) para recuperar o contexto das sessões anteriores (decisões arquiteturais e problemas encontrados). Diga ao usuário em 1 frase o que está retomando e siga — não peça para ele repetir. Se a nota estiver vazia ou não existir, apenas prossiga.
- Sempre que resolver um bug crítico, alterar a arquitetura ou tomar uma decisão importante, use a ferramenta MCP do Obsidian (`patch_vault_file`) para inserir a entrada na seção apropriada de `Log-Sessoes-Ceres.md`.
- Toda vez que eu disser "Sessão encerrada" ou "Fechar", você DEVE obrigatoriamente fazer um resumo do que foi feito e salvá-lo em `Log-Sessoes-Ceres.md`, na seção `## Decisões Arquiteturais` ou `## Problemas Encontrados`, antes de fechar.

<!-- AIVOUX-END -->
