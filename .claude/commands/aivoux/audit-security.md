# AIVOUX — Audit Security (Security Deep Scan)

Escopo opcional: $ARGUMENTS

Workflow de ativacao MANUAL. Objetivo: auditar a seguranca de um sistema
existente contra os **10 Security Standards** + OWASP Top 10, produzir um
**relatorio de postura de seguranca** (`docs/security/`) com achados priorizados
por severidade e evidencia de ferramenta, e um backlog de correcao. Espelha o
`/aivoux/discover`, mas focado 100% em seguranca.

Roda quando voce quer saber "quao seguro esta meu sistema HOJE e o que corrigir
primeiro". Re-run apos mudancas grandes ou periodicamente (trimestral).

---

## Regras Absolutas

1. **READ-ONLY no codigo.** Este workflow NUNCA edita, move ou deleta codigo.
   Unico output: arquivos de documentacao (`docs/security/`). Correcoes viram
   demandas separadas via `/aivoux/router` com pipeline e @security normais.
2. **Defensivo apenas.** Auditar a superficie do PROPRIO sistema do usuario.
   Sem exploracao ativa, sem scan de alvos de terceiros, sem gerar exploit para
   uso ofensivo. Encontrar o buraco e mostrar como fechar — nunca como abusar.
3. **Segredo achado = PATH + tipo, NUNCA o valor.** O relatorio registra
   "AWS key em src/config.ts:12 — ROTACIONAR", jamais a chave. Vazar o segredo
   no proprio relatorio de auditoria e o pior erro possivel aqui.
4. **Evidencia de ferramenta, nao opiniao.** Sem ferramenta, o achado entra como
   `nao verificado por ferramenta` — com confianca menor, nunca como afirmacao.
5. **Achado so vira "confirmado" apos validado (FASE 3).** O usuario conhece o
   contexto (ex: "esse endpoint e interno, roda so na VPS"). Falso positivo
   marcado como tal; o que o usuario confirma vira acionavel.
6. **Zero auto-fix.** Achados viram backlog em `docs/security/findings.md`; cada
   item vira demanda via `/aivoux/router` com @security no pipeline.

---

## FASE 0 — Preflight (baratissimo)

1. Ler `.aivoux/config.yaml` (bloco `security_gate` + `observability`), `package.json`.
2. Ler `docs/features/index.md` se existir (mapa do sistema — onde estao os
   fluxos sensiveis: auth, pagamento, upload).
3. Se `docs/security/report.md` JA existe: perguntar (AskUserQuestion) — re-scan
   completo ou so areas novas? Nao sobrescrever relatorio anterior sem confirmar.
4. Medir tamanho: `git ls-files | wc -l`. Acima de ~2000 arquivos, sugerir escopo
   por area (`$ARGUMENTS`) antes de prosseguir.

---

## FASE 1 — Scan Mecanico (deterministico, router faz direto)

Capturar, com timeout e degradacao graciosa (falhou → registrar "nao rodou" e
seguir; NUNCA travar por ferramenta ausente):

**Sempre:**
- `bash .claude/hooks/secret-scan.sh` (ou `git ls-files -z | xargs grep -nE`
  padroes de secret) → credenciais hardcoded. **Reportar so PATH+tipo.**
- Verificar `.gitignore`: `.env`, `*.key`, `*.pem`, `secrets/` cobertos?
- `git log --all -p -- '*.env' '*.pem' '*.key' 2>/dev/null | head` → segredo que
  ja passou pelo historico (mesmo se removido depois — precisa rotacionar).
- Grep de superficie: `dangerouslySetInnerHTML`, template literal em query SQL,
  `cors({origin: '*'})`, `service_role`/service key no client, `md5(`/`sha1(`.

**Ferramentas (projeto JS/TS; via `npx -y`, timeout 120s, sem instalar nada):**
- `npm audit --audit-level=high --json` → CVEs em dependencias
- `npx -y gitleaks detect --no-git -v` (se disponivel) → secret scan robusto
- `npx -y @microsoft/eslint-plugin-sdl` / semgrep quando disponivel → SAST leve

Projeto nao-JS ou ferramenta falhou: analise via Grep dirigido + leitura,
declarando o metodo (confianca menor).

---

## FASE 2 — Threat Model + Sintese (subagente @security)

Spawnar `aivoux-security` com TODO o output da FASE 1:

```
Agent(subagent_type="aivoux-security", prompt="
Output do scan mecanico de seguranca: {fase 1}
Mapa do sistema (feature docs, se houver): {index + fluxos sensiveis}

Sua tarefa: *audit — produzir o MODELO DE AMEACA do sistema e a lista de
achados priorizados. Para cada superficie sensivel (auth, autorizacao, entrada
externa, dados sensiveis, upload, infra/deploy):
- que ativo protege e quem e o atacante plausivel (STRIDE leve)
- achados concretos com PATH+linha, standard violado (#1-#10) e severidade
  (CRITICAL/HIGH/MEDIUM/LOW), com evidencia da ferramenta quando houver
- para cada achado: FIX concreto (o que mudar) — NAO implementar, so descrever
NUNCA inclua o VALOR de nenhum segredo — so PATH+tipo. Leia entry points e
handlers sensiveis, nao o projeto inteiro. Achado sem evidencia = marcar
'nao verificado por ferramenta', nunca afirmar.")
```

---

## FASE 3 — Validacao com o Usuario (coracao — NUNCA pular)

Apresentar os achados via AskUserQuestion, **CRITICAL/HIGH primeiro**. Para cada
achado ou grupo:

- **Confirmado / e real** → entra no backlog como acionavel
- **Falso positivo** (ex: "endpoint interno, so na VPS", "chave e publica de
  proposito") → o usuario explica; marcado `falso_positivo` com o motivo dele
- **Nao sei** → marcado `a_investigar`

O contexto do usuario SEMPRE vence a inferencia do modelo. Um endpoint que parece
exposto pode estar atras de um WAF/rede privada que o codigo nao mostra.

Aproveitar para perguntar: **quais fluxos sao os "coroa"** (o que, se vazar,
mata o negocio) → prioriza o backlog e alimenta `security_gate.sensitive_paths`.

---

## FASE 4 — Escrita (via aivoux-scribe, achados validados no prompt)

Spawnar `aivoux-scribe` para gravar:

1. **`docs/security/report.md`** — postura de seguranca: resumo executivo
   (quantos CRITICAL/HIGH/MEDIUM/LOW), superficie de ataque mapeada, o modelo de
   ameaca por fluxo sensivel. Linguagem natural, acionavel.
2. **`docs/security/findings.md`** — backlog priorizado: cada achado com
   severidade, PATH (NUNCA o valor do segredo), standard violado, evidencia da
   ferramenta e FIX sugerido. Header obrigatorio: "NAO corrigir daqui direto —
   abrir demanda via /aivoux/router (@security no pipeline)".
3. **`.aivoux/config.yaml`** — sugerir preencher `security_gate.sensitive_paths`
   com os fluxos coroa validados na FASE 3 (o usuario confirma).
4. Se houver segredo no historico do git: item DESTACADO "ROTACIONAR
   credencial X (exposta no historico) — remover do codigo NAO basta".

---

## Fechamento (obrigatorio, literal)

```
✓ AIVOUX audit-security concluido
Achados: {N} ({C} CRITICAL · {H} HIGH · {M} MEDIUM · {L} LOW) · {F} falso-positivo
Relatorio: docs/security/report.md + backlog: docs/security/findings.md
Secrets: {N rotacoes necessarias, ou "nenhum segredo exposto encontrado"}
Proximo: corrigir CRITICAL/HIGH primeiro via /aivoux/router (cada um = 1 demanda)
```

Se o usuario abortou a validacao no meio: gravar so o validado ate ali, fechar
com `Achados: {parcial}` e listar o que ficou pendente. NUNCA declarar o sistema
"seguro" — declarar "N achados abertos" ou "nenhum achado nas superficies
auditadas" (o escopo auditado, nao o sistema inteiro).
