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

Operacoes bloqueadas devem ser delegadas ao @devops.

## Quality Gates

Antes de marcar qualquer trabalho como completo:
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

## Change & Deploy Safety Gates

11. **Environment preflight** (mutacao remota) - repo/branch/host/DB ALVO confirmados antes de push/SSH/SQL (ver `change-safety.md` A)
12. **Mental-model confirm** (dados/semantica ambigua) - modelo + blast radius confirmados antes de editar (ver `change-safety.md` B)
13. **Deploy boot + smoke** (deploy) - servico sobe + processa payload real + SHA no remoto antes de DONE (ver `deploy-safety.md`)

## 12 Best Practices

Quando `coding_standards.enforce: true` (default), @dev aplica e @qa valida:

1. **DRY** - Evitar duplicacao
2. **Dead Code** - Remover codigo nao usado
3. **TypeScript** - Sem `any` injustificado
4. **Component Size** - <300 linhas (HARD gate, FAIL acima; meta <200) — @reviewer + quality-guard hook
5. **State Mgmt** - Sem prop drilling >2 niveis
6. **React Hooks** - Rules e deps corretas
7. **Logic/UI** - Separacao clara
8. **Error Handling** - try/catch + boundaries
9. **Performance** - Medir antes de otimizar
10. **Structure** - Organizacao por feature
11. **Accessibility** - WCAG 2.1 AA minimo
12. **Tests** - Cobertura >=80% para logica critica

Detalhes completos em `.claude/rules/coding-standards.md`.

## Modos de Execucao

### YOLO Mode (`yolo_mode: true`, default)
- Smart Router executa pipeline end-to-end automaticamente
- Confirmacao apenas no inicio (apresentacao do plano)
- Loop de QA automatico (max 3 iteracoes)

### Plan Mode (`plan_mode.enabled: true`, default)
- Agentes de planejamento (@pm, @architect, @analyst, @ux) usam Opus
- Agentes de execucao (@dev, @qa, @devops, @data-engineer) usam Opus
- Scribe usa Haiku
- Auto-switch via `plan_mode.auto_switch: true`

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
