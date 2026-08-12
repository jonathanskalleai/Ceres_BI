# AIVOUX — Plan-First (F7): nenhuma implementacao sem plano da solucao

Resposta ao padrao de falha F7 — **fix na naba**: bug ou feature e analisado e
corrigido direto, sem planejar a solucao. O diff sobe, funciona no caso testado,
e gera OUTRO erro porque ninguem pensou no que mais dependia daquele codigo, em
quais arquivos a mudanca ia tocar, ou em como provar que nao regrediu. Uma tarefa
de 1 fix vira 5 fixes nao validados.

A causa: o framework ja investigava o PROBLEMA (PASSO 1 — Diagnostico Inline
reproduz o bug) mas pulava direto para o @dev sem desenhar a SOLUCAO. Diagnostico
e plano sao coisas diferentes:

- **Diagnostico (PASSO 1):** o que esta quebrado, por que, onde — reproduz o sintoma.
- **Plano (PASSO 2.5):** como vou consertar — abordagem, arquivos, blast radius, validacao.

Esta rule torna o plano **obrigatorio e mecanico** para TODA demanda que vai
mutar codigo ou schema. Nao depende de a IA lembrar.

Owner: **router/orquestrador** (escreve o plano) + **@architect** (em MEDIUM+, o
design vira o plano). Validator: hook `plan-gate.sh` (deterministico).

---

## Regra de Ouro

> Diagnosticar o problema nao e planejar a solucao.
> Nenhum @dev / @data-engineer comeca sem um plano da SOLUCAO escrito ANTES —
> abordagem, arquivos, o que pode QUEBRAR, e como PROVAR que funcionou.

---

## Peso escalavel (nao burocratizar o trivial)

O plano e obrigatorio SEMPRE, mas o TAMANHO escala com a complexidade — planejar
um typo nao pode custar mais que o typo:

| Complexidade | Como planejar |
|--------------|---------------|
| **SIMPLE** (1 arquivo, cirurgico) | Router escreve o `plan.md` inline: 1 linha por secao. ~1 min. |
| **MEDIUM** (2-5 arquivos) | Discussion Mode OU @architect desenha; router consolida o resultado no `plan.md`. |
| **COMPLEX** (multiplas areas) | @pm + Discussion Mode + @architect; plano consolidado no `plan.md`. |

O `plan.md` e sempre o mesmo artefato — o que muda e quanto trabalho de
planejamento o alimenta. MEDIUM+ NAO cria uma etapa nova: reaproveita o
Discussion Mode / @architect que ja existem, so exige que o resultado seja
ancorado no arquivo que o gate le.

---

## O artefato: `.aivoux/gates/plan.md`

Escrito pelo router (Write em `.aivoux/gates/` e permitido ao router) ANTES de
spawnar `aivoux-dev` / `aivoux-data-engineer`. Session-local, gitignored.

```markdown
# AIVOUX Plan
sha: <git rev-parse HEAD no momento do plano>
timestamp: <ISO-8601 UTC>
demanda: <resumo em 1 linha>
complexidade: SIMPLE|MEDIUM|COMPLEX

## Abordagem
<como vou resolver — a SOLUCAO, nao o sintoma. Em BUG_FIX: a root cause + o fix.>

## Arquivos
<arquivos/areas que vou tocar — a lista concreta, nao "varios">

## Risco / Blast
<o que MAIS depende disso; o que pode quebrar. ATERRAR em evidencia (alavanca 1):
rodar `blast-radius.sh --files <arquivos planejados>` e resumir os importadores
reversos + features afetadas. E aqui que se mata o "fix gerou outro erro".>

## Suposicao mais fraca
<AUTO-CRITICA de 1 rodada (alavanca 2): qual a suposicao que, se errada, quebra o
plano? o que pode quebrar que voce NAO listou? Existe pra pegar o plano medIocre
ANTES do @dev, nao pra passar o gate.>

## Validar
<como PROVO que funcionou E que nao regrediu — comando, teste, smoke observavel>
```

As **cinco** secoes (`## Abordagem`, `## Arquivos`, `## Risco / Blast`,
`## Suposicao mais fraca`, `## Validar`) sao **obrigatorias** — o gate bloqueia
sem qualquer uma.

---

## Qualidade do plano — as 2 alavancas (o gate garante que existe, nao que presta)

O `plan-gate.sh` e bash: checa presenca, ancoragem e substancia — NUNCA julga se
o plano e bom (isso exige raciocinio sobre o codigo). Duas alavancas sobem a
qualidade sem fingir que um hook resolve tudo:

### Alavanca 1 — Aterrar o Risco/Blast em evidencia (nao em chute)

O `## Risco / Blast` e a secao que ataca o F7 diretamente, mas era um chute do
modelo. O `blast-radius.sh` ja calcula importadores reversos + features afetadas
de forma deterministica. No momento do plano o diff ainda esta vazio (o @dev nao
codou), entao usa-se o modo **`--files`** (arquivos do `## Arquivos`), nao o modo
diff. O router roda isso no PASSO 2.5 e resume a saida real no plano. Importador
reverso que ninguem viu vira regressao — aterrar e o que reduz esse risco.

### Alavanca 2 — Auto-critica mecanizada (o campo `## Suposicao mais fraca`)

O buraco do "plano medIocre" e pior em SIMPLE/BUG_FIX, onde nenhum agente de
planejamento revisa (em MEDIUM+ o @architect/Discussion ja da o olhar
independente). A correcao NAO e um @planner pesado em toda demanda (custo,
contra o lean) — e um campo obrigatorio que **forca a critica a virar artefato**:
"qual a suposicao mais fraca? o que pode me pegar aqui?". Bash nao mede a
qualidade da resposta, mas garante que a pergunta foi respondida — e responder
honesto ja pega a maioria dos planos rasos, de graca, sem spawn.

### O teto honesto

Nenhuma alavanca faz um plano ficar bom se o modelo nao consegue raciocinar sobre
o codebase. O que elas dao e **contexto melhor** (grounding) e **um segundo
olhar** (critica). Alem disso e retorno decrescente. A rede que pega o que o
plano errar continua sendo @reviewer + @qa + regression gate (F4) la na frente —
o plano bom reduz a FREQUENCIA com que essa rede precisa pegar, nao a substitui.

---

## Enforcement mecanico — `plan-gate.sh` (PreToolUse Task|Agent)

Bloqueia o spawn de `aivoux-dev` e `aivoux-data-engineer` (os agentes que MUTAM)
enquanto `.aivoux/gates/plan.md` nao for valido:

1. **Existe** — sem arquivo = BLOQUEADO.
2. **Fresco** (< 90 min) — plano velho e de outra demanda; envelhece e nao vale.
3. **Ancorado** — `sha:` == HEAD, ou ancestral de HEAD (tolera o loop
   `@dev <-> @reviewer` onde o @dev commita entre rodadas). SHA de outro
   branch/ciclo = BLOQUEADO. Commit de codigo novo invalida plano de outra
   demanda — cada demanda, plano novo (mesma logica do qa-verdict).
4. **Preenchido** — as 5 secoes obrigatorias (Abordagem, Arquivos, Risco/Blast,
   Suposicao mais fraca, Validar) presentes E conteudo nao-trivial (>= 60 chars
   fora dos headers). Header vazio nao e plano (anti-teatro).

Agentes de planejamento (@architect, @pm, @analyst, @ux), review (@reviewer,
@security), @qa e @scribe NAO sao gateados — eles nao implementam.

**Limite honesto:** o gate garante que UM plano existe e tem substancia; nao
garante que o plano e BOM — bash nao raciocina sobre o codigo. O gate e o piso
(nao implementar as cegas), nao o teto. A qualidade vem das 2 alavancas abaixo
(aterramento + auto-critica), do @architect/Discussion em MEDIUM+, e da
honestidade brutal do agente.

**Override:** so o USUARIO, com autorizacao explicita nesta conversa, criando
`.aivoux/gates/skip-plan-authorized` com a citacao literal (uso unico, logado em
`overrides.log`). Criar sem autorizacao = fraude de gate, mesma gravidade que
contornar o delete-guard.

---

## Anti-padroes

- ❌ Ir do diagnostico do bug direto pro @dev sem escrever o plano
- ❌ Plano que so repete o sintoma ("corrigir o login que nao funciona") sem
  abordagem, arquivos nem validacao
- ❌ `plan.md` com headers vazios so pra passar o gate (teatro — o gate pega)
- ❌ Reaproveitar o plano de uma demanda anterior (SHA nao-ancestral / >90 min)
- ❌ Tratar SIMPLE como isento — SIMPLE tambem planeja, so que em 4 linhas

---

## Integracao

- `router.md` PASSO 2.5 — router escreve o `plan.md` e emite o marcador `◆ Plano`
- `discussion-protocol.md` — em MEDIUM+, o consenso alimenta a secao `## Abordagem`
- `regression-gate.md` (F4) — `blast-radius.sh` alimenta a secao `## Risco / Blast`
- `change-safety.md` (F2/F3) — Mental-Model e blast radius entram no plano
- `pipeline-integrity.md` (F6) — plan-gate e o 8o hook mecanico do pipeline
- `shared-config.md` — quality gate #23
