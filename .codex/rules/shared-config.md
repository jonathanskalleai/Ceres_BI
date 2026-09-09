# AIVOUX - Configuracao Compartilhada

## Matriz de Permissoes Git

| Agente | add | commit | push | PR | branch | merge local |
|--------|-----|--------|------|----|--------|-------------|
| @dev | SIM | SIM | NAO | NAO | SIM | SIM |
| @architect | NAO | NAO | NAO | NAO | NAO | NAO |
| @qa | NAO | NAO | NAO | NAO | NAO | NAO |
| @pm | NAO | NAO | NAO | NAO | NAO | NAO |
| @devops | SIM | SIM | SIM | SIM | SIM | SIM |
| @data-engineer | SIM | SIM | NAO | NAO | SIM | SIM |
| @ux | NAO | NAO | NAO | NAO | NAO | NAO |
| @analyst | NAO | NAO | NAO | NAO | NAO | NAO |
| @security | NAO | NAO | NAO | NAO | NAO | NAO |

Operacoes bloqueadas devem ser delegadas ao @devops.

## Quality Gates

No modo DEVELOPMENT, @dev roda os checks locais que forem proporcionais à
mudança e registra a pendência; a validação bloqueante abaixo é consolidada pelo
@qa no modo FULL/auditoria:
1. `npm run lint` - deve passar sem erros
2. `npm run typecheck` - deve passar sem erros
3. `npm test` - todos os testes devem passar
4. `npm run build` - deve completar com sucesso

Se CodeRabbit estiver habilitado em `.aivoux/config.yaml`:
5. CodeRabbit nao deve reportar issues CRITICAL

Se `coding_standards.enforce: true`:
6. Validar 12 best practices (ver `coding-standards.md`)

## Security Gates (10 Security Standards)

Aplicaveis conforme escopo (ver matrix em `security-standards.md`):

7. **Secret scan** - `git diff --cached` nao pode conter API keys/tokens hardcoded (pre-commit hook)
8. **Dependency audit** - `npm audit --audit-level=high` deve retornar 0 issues HIGH/CRITICAL
9. **RLS check** (quando ha schema novo) - tabelas Supabase com RLS habilitado
10. **Headers check** (deploy) - HTTPS + HSTS + CSP configurados antes de release
10.1 **Security gate** (escopo sensivel) - mudanca que toca auth/authz/entrada externa/dados sensiveis/upload/infra exposta passa pelo `@security` (apos @reviewer, antes do @qa); verdict VULNERABLE (CRITICAL/HIGH) volta ao @dev (ver `security-standards.md` secao Enforcement via @security)

## Change & Deploy Safety Gates

11. **Environment preflight** (mutacao remota) - repo/branch/host/DB ALVO confirmados antes de push/SSH/SQL (ver `change-safety.md` A)
12. **Mental-model confirm** (dados/semantica ambigua) - modelo + blast radius confirmados antes de editar (ver `change-safety.md` B)
13. **Deploy boot + smoke** (deploy) - servico sobe + processa payload real + SHA no remoto antes de DONE (ver `deploy-safety.md`)
14. **Regression gate** (codigo tocado) - blast radius computado (manual no Codex) + smokes das features afetadas e critical_paths executados pelo @qa; afetada SEM_SMOKE reportada explicitamente (ver `regression-gate.md`)

## Observability Gates (F5)

15. **Regra do catch** (codigo novo) - nenhum `catch` sem log/report do erro; catch silencioso = FAIL no @qa (ver `observability-standards.md` #1)
16. **Log de fronteira** (backend/API/worker novo) - entrada de API/webhook, falha de chamada externa e job com log estruturado (ver `observability-standards.md` #1)
17. **Error tracking** (deploy com usuarios reais) - handler global + canal configurado + 1 evento de teste RECEBIDO antes de DONE (ver `observability-standards.md` #2)

## Pipeline Integrity Gates (F6 — COMPORTAMENTAIS no Codex)

> No Claude Code estes gates sao MECANICOS (hooks que bloqueiam). O **Codex nao
> roda hooks** — aqui valem como obrigacao comportamental do orquestrador. Nada
> bloqueia sozinho; pular = quebrar o pipeline em silencio (ver `pipeline-integrity.md`).

18. **Deploy gate (FULL/produção)** - merge/release/deploy e push de produção só saem com `.aivoux/gates/qa-verdict.json` PASS ancorado ao SHA atual + @qa tendo REALMENTE rodado + `## Smoke` em todo critical_path. DEVELOPMENT permite apenas push de branch/PR/preview não produtivo e registra a pendência. Override so com autorizacao explicita do usuario
19. **Scribe gate** - REMOVIDO
20. **Subagente/etapa falhou ≠ pular etapa** - retry 1x, depois PARAR e perguntar ao usuario; inline so com autorizacao = `INLINE_DEGRADED` (nunca PASS)
21. **Feature-Docs Lookup gate** - projeto com `docs/features/index.md`: LER o index antes do primeiro agente de trabalho. Em divergencia entre resumo do AGENTS.md e router/rules, o router/rules VENCEM (ver `pipeline-integrity.md` Regra 8)
22. **Security gate (CONDICIONAL no FULL)** - no modo FULL, diff que toca superficie sensivel (auth/authz/RLS/entrada externa/dados sensiveis/upload/infra exposta) so publica com `.aivoux/gates/security-verdict.json` SECURE ancorado ao SHA + @security tendo rodado. No DEVELOPMENT o gate é adiado; diff nao-sensivel passa sem verdict de seguranca. VULNERABLE bloqueia (ver `security-standards.md` + `pipeline-integrity.md`)
23. **Review gate (FULL apenas)** - @reviewer e obrigatorio em TODO pipeline FULL que toca codigo, inclusive SIMPLE. `reviewer-verdict.json` PASS ancorado ao SHA antes do deploy. DEVELOPMENT registra a pendência para auditoria posterior (ver `pipeline-integrity.md` Regra 9)

## 12 Best Practices

Quando `coding_standards.enforce: true` (default), @dev aplica; @qa valida no
FULL/auditoria:

1. **DRY** - Evitar duplicacao
2. **Dead Code** - Remover codigo nao usado
3. **TypeScript** - Sem `any` injustificado
4. **Component Size** - meta <200, aviso 300, HARD gate 400 (FAIL acima) — @reviewer
5. **State Mgmt** - Sem prop drilling >2 niveis
6. **React Hooks** - Rules e deps corretas
7. **Logic/UI** - Separacao clara
8. **Error Handling** - try/catch + boundaries; catch SEMPRE loga (regra do catch)
9. **Performance** - Medir antes de otimizar
10. **Structure** - Organizacao por feature
11. **Accessibility** - WCAG 2.1 AA minimo
12. **Tests** - Cobertura >=80% para logica critica

Detalhes completos em `.codex/rules/coding-standards.md`.

## Modos de Execucao

### YOLO Mode (`yolo_mode: true`, default)
- Smart Router executa pipeline end-to-end automaticamente
- Confirmacao apenas no inicio (apresentacao do plano)
- Loop de QA automatico (max 3 iteracoes)
- **yolo_mode ≠ mode_selection:** significa apenas "nao pausar entre etapas".
  O modo DEVELOPMENT/FULL continua sendo escolhido por `pipeline_mode` (ver
  `pipeline-integrity.md` Regra 4)

### Codex Runtime
- Todos os agentes usam o modelo atual da sessao Codex
- Nao ha auto-switch por agente no Codex
- `model_tier`, Opus, Sonnet e Haiku continuam sendo configuracao exclusiva do
  modulo Claude Code

### Story Mode (`story_mode: false`, default)
- Quando true: cria story em docs/stories/ antes de implementar
- @dev atualiza checkboxes, File List e Change Log
- Status: Draft → Ready → InProgress → InReview → Done

## CodeRabbit Integration

Quando habilitado (`coderabbit.enabled: true`):
- Pre-commit: `coderabbit --prompt-only -t uncommitted`
- Severidade: CRITICAL=bloqueia, HIGH=flag, MEDIUM=tech debt, LOW=ignorar
- Self-healing: max 2 iteracoes para CRITICAL (@dev), max 3 para @qa
- Timeout: 15 minutos

## Context Watch

Quando o hook de contexto injeta `[AIVOUX-CONTEXT-WATCH turns=N]` no prompt:
- **Apresentar o aviso ao usuario imediatamente**, antes de qualquer outra coisa
- Formato: `⚠ Sessao com N turnos — contexto longo. Se esta e uma nova demanda, considere /clear primeiro.`
- Nao bloquear nem pedir confirmacao — apenas informar e prosseguir normalmente
- Se o usuario confirmar que quer /clear: responder "Ok, de /clear e repita sua demanda."
- Se o usuario quiser continuar: processar normalmente sem mais avisos

## Padroes de Codigo

- Codigo limpo e auto-documentado seguindo padroes existentes
- Error handling compreensivo
- Testes para toda funcionalidade nova
- TypeScript/JavaScript best practices
- Imports absolutos com alias `@/` quando disponivel
- Aplicar as 12 best practices em todo codigo novo
