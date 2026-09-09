---
name: aivoux-audit-security
description: AIVOUX Codex — auditoria de seguranca read-only de um sistema existente (10 security standards + OWASP), produz docs/security/report.md + backlog. Espelha aivoux-discover, focado em seguranca. Ativacao manual.
---

# AIVOUX — Audit Security (Codex)

Use o modelo atual da sessao Codex. Nao tente trocar modelo.

Workflow de ativacao MANUAL. Auditar a seguranca de um sistema EXISTENTE contra
os **10 Security Standards** (`.codex/rules/security-standards.md`) + OWASP Top
10, e produzir relatorio de postura (`docs/security/report.md`) + backlog
priorizado (`docs/security/findings.md`). O @security e o cerebro; esta skill
orquestra as fases.

## Regras Absolutas

1. **READ-ONLY no codigo.** Unico output: `docs/security/`. Correcoes viram
   demandas separadas via `aivoux-router` (com @security no pipeline).
2. **Defensivo apenas.** Auditar a superficie do PROPRIO sistema do usuario. Sem
   exploracao ativa, sem scan de terceiros, sem exploit ofensivo.
3. **Segredo achado = PATH + tipo, NUNCA o valor.** Vazar o segredo no proprio
   relatorio e o pior erro possivel aqui.
4. **Evidencia de ferramenta, nao opiniao.** Sem ferramenta, o achado entra como
   `nao verificado por ferramenta` (confianca menor), nunca como afirmacao.
5. **Achado so vira "confirmado" apos validado com o usuario (FASE 3).** O
   contexto do usuario vence a inferencia do modelo. Zero auto-fix.

## FASE 0 — Preflight

Ler `.aivoux/config.yaml` (`security_gate` + `observability`), `package.json`, e
`docs/features/index.md` se existir. Se `docs/security/report.md` ja existe,
perguntar antes de sobrescrever. Acima de ~2000 arquivos, sugerir escopo por area.

## FASE 1 — Scan Mecanico (deterministico)

Com timeout e degradacao graciosa (falhou → registrar "nao rodou" e seguir):

- Grep de segredos: `rg -nE '(API_KEY|SECRET|TOKEN|PASSWORD|service_role|BEGIN
  (RSA|EC|OPENSSH) PRIVATE KEY)'` → credenciais hardcoded. **So PATH+tipo.**
  (No Codex nao ha `secret-scan.sh` — o scan e via `rg`/grep manual.)
- `.gitignore` cobre `.env`, `*.key`, `*.pem`, `secrets/`?
- `git log --all -p -- '*.env' '*.pem' '*.key' 2>/dev/null | head` → segredo que
  ja passou pelo historico (precisa rotacionar mesmo se removido depois).
- Grep de superficie: `dangerouslySetInnerHTML`, template literal em query SQL,
  `cors({origin: '*'})`, service key no client, `md5(`/`sha1(`.
- `npm audit --audit-level=high --json` → CVEs (projeto JS/TS).
- Se disponivel: `npx -y gitleaks detect --no-git -v`, semgrep (timeout 120s).

## FASE 2 — Threat Model + Sintese (@security)

Assumir a persona `@security` (ler `.codex/agents/security.md`) com TODO o output
da FASE 1. Produzir o MODELO DE AMEACA + achados priorizados: para cada
superficie sensivel, quem e o atacante (STRIDE leve), achados com PATH+linha +
standard violado (#1-#10) + severidade, e FIX concreto (descrever, nao
implementar). NUNCA o valor de nenhum segredo.

## FASE 3 — Validacao com o Usuario (coracao — NUNCA pular)

Apresentar achados (CRITICAL/HIGH primeiro). Cada achado: confirmado / falso
positivo (usuario explica) / a investigar. Perguntar quais fluxos sao "coroa"
para priorizar e alimentar `security_gate.sensitive_paths`.

## FASE 4 — Escrita

1. `docs/security/report.md` — postura + modelo de ameaca por fluxo.
2. `docs/security/findings.md` — backlog priorizado (severidade, PATH sem o
   valor, standard, evidencia, FIX). Header: "NAO corrigir daqui — abrir demanda
   via aivoux-router".
3. `.aivoux/config.yaml` — sugerir `security_gate.sensitive_paths` validados.
4. Segredo no historico do git → item DESTACADO "ROTACIONAR".

## Fechamento (literal)

```
✓ AIVOUX audit-security concluido
Achados: {N} ({C} CRITICAL · {H} HIGH · {M} MEDIUM · {L} LOW) · {F} falso-positivo
Relatorio: docs/security/report.md + backlog: docs/security/findings.md
Secrets: {N rotacoes necessarias, ou "nenhum segredo exposto encontrado"}
Proximo: corrigir CRITICAL/HIGH primeiro via aivoux-router (cada um = 1 demanda)
```

NUNCA declarar o sistema "seguro" — declarar "N achados abertos" ou "nenhum
achado nas superficies auditadas" (o escopo auditado, nao o sistema inteiro).
