# AIVOUX — Change Safety: Preflight antes de mutar

Resposta a dois padroes de falha reais que geraram reverts caros e perda de tempo:

- **F2 — Requisito mal interpretado** (modelo de dados errado: cross-department vs
  1-conversa-por-canal; guard descartando trafego interno legitimo) → revert.
- **F3 — Ambiente errado** (DB descomissionado consultado, push no repo errado,
  deploy na VPS errada, SHA do local stale reportado como remoto).

A causa comum: **mutar antes de confirmar.** Esta rule torna a confirmacao
obrigatoria em dois eixos — ALVO (onde) e MODELO (o que).

---

## A) Environment Preflight (F3) — verificar o ALVO antes de mutacao remota

Antes de QUALQUER operacao que muda estado remoto/compartilhado
(`git push`, `gh pr/merge`, SSH em servidor, SQL em DB nao-local, deploy):

1. **Repo:** `git remote -v` → e o repositorio esperado? (multiplos remotes = confirmar)
2. **Branch:** `git rev-parse --abbrev-ref HEAD` + `git status` → branch e estado certos?
3. **DB:** confirmar a identidade do banco ALVO — host + nome + que esta **ativo**
   (nao um instance descomissionado). Para Supabase: project ref / URL conferem?
4. **Host:** o IP/host da VPS e o canonico? (ver `## Infrastructure` no CLAUDE.md do projeto)
5. **Citar evidencia** no handoff/output: "push → origin git@...:org/repo (confirmado)".

> Regra: **declaracao sobre estado remoto exige evidencia runtime.** Nunca
> reportar SHA/estado lendo `main` local stale — checar o remoto
> (`git ls-remote`, `gh`, `psql \dt`, curl ao endpoint). Alinhado com
> `agent-conduct.md` ("verificar runtime antes de declarar pendencia/conclusao").

Owners: **@devops** (push/deploy/SSH), **@data-engineer** (SQL/migration).

---

## B) Mental-Model Confirmation (F2) — confirmar o MODELO antes de editar

Dispara quando a mudanca **toca modelo de dados ou semantica de negocio** E o
requisito tem ambiguidade (termos como "conversa", "canal", "usuario", "filial",
"finalizado", regras de visibilidade/permissao, dedup, agregacao).

Antes de editar codigo:

1. **Investigacao read-only** — ler schema/codigo real, NAO assumir estrutura
2. **Enunciar o modelo entendido** em 2-4 linhas: entidades, cardinalidade, regra
   ("1 conversa por canal por contato; trafego interno entre canais e legitimo")
3. **Blast radius** — o que mais depende disso? (queries, dashboards, migrations, RLS)
4. **Esperar OK** quando a interpretacao muda comportamento existente ou e irreversivel
   (consolidacao/merge de dados, delete, mudanca de unique/dedup)

Nao dispara para: mudanca cirurgica sem ambiguidade, CSS/UI puro, bug de digitacao.
(Greenfield/feature MEDIUM+ ja passa pelo Discussion Mode — esta secao cobre
BUG_FIX e REFACTOR que tocam dados, que o Discussion Mode nao pegava.)

---

## Por que isso e barato

Um preflight read-only custa ~1 turno. Um revert de consolidacao de dados errada,
ou um push no repo errado, custa a sessao inteira + risco em producao. O relatorio
real mostrou ambos repetidamente. Confirmar o alvo e o modelo **antes** e o trade
mais barato do framework.
