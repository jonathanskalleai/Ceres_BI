# AIVOUX — Observability Standards (F5): logs + error tracking + health

Resposta ao padrao de falha F5 — **erro descoberto pelo usuario**: o codigo
passou em todos os gates (F1-F4), subiu limpo, e dias depois quebra com um
input que ninguem testou. Sem logs estruturados e sem error tracking, o unico
"sistema de monitoramento" do projeto e o usuario reclamando — e muitos nem
reclamam, so desistem e somem.

Dois agravantes tipicos de projeto vibe-coded que este standard corrige:

- **try/catch sem log e um SUPRESSOR de erros.** A pratica #8 exige try/catch,
  mas `catch (e) { toast("erro ao salvar") }` engole o root cause para sempre.
  O usuario ve mensagem generica, o dono nao ve nada. Pior que quebrar alto.
- **O framework empurrava para ZERO logs.** "Diagnose Before Fix" adiciona log
  temporario; a pratica #2 (dead code) manda remover console.log no cleanup.
  Resultado: log rico em dev, sistema cego em producao.

Owner: **@dev** (logging no codigo) + **@architect** (design do logger/tracking)
+ **@devops** (error tracking e health no deploy). Validator: **@qa**.

---

## Regra de Ouro

> Os gates F1-F4 provam que a entrega funciona HOJE. Observabilidade e o que
> avisa VOCE quando ela quebrar amanha — antes do usuario reportar.
>
> **Log e forense** (o que quebrou, onde, com que input).
> **Error tracking e antecipacao** (voce fica sabendo em segundos, nao em dias).
> Um sem o outro e meio sistema: alerta sem contexto, ou contexto que ninguem le.

---

## 1. Logging Obrigatorio (o que DEVE ser logado)

Complemento do security-standards #6 (que diz o que NAO logar). Aplicar em
todo codigo NOVO de backend / API / worker / job. Nao exige refatorar legado.

### Fronteiras (sempre logar)

- **Entrada de API/webhook/handler:** request id, rota/evento, status, duracao
- **Chamada externa que FALHA** (API de terceiro, DB, fila): alvo, erro, contexto
- **Job/cron/worker:** inicio, fim, falha (com stack trace no log do servidor)
- **Auth:** login success/fail, mudanca de role, reset de senha (sem PII no log)

### Regra do Catch (HARD — FAIL no @qa)

- **NENHUM `catch` sem registrar o erro** (logger ou error tracking) antes de
  tratar/exibir mensagem amigavel.
- Catch vazio, ou catch que so mostra toast/mensagem generica, = supressor de
  erro = **FAIL automatico** no @qa.
- Excecoes legitimas: catch com `rethrow`, ou com comentario inline
  justificando (ex: `// fallback esperado: cache miss`).

### Formato

- **Logger util do projeto** (nivel + timestamp + contexto estruturado), nao
  `console.log` solto espalhado. Se o projeto nao tem: @dev cria um
  `lib/logger.ts` minimalista no primeiro pipeline que tocar backend — ate
  wrapper de console com prefixo estruturado serve; o PADRAO importa mais que
  a lib.
- **Correlation/request id** propagado quando ha cadeia de chamadas.
- Security #6 continua valendo: **nunca** logar senha, token, PII completo.

---

## 2. Error Tracking (a peca que ANTECIPA)

Log na VPS que exige SSH para ler nao e observabilidade — e arqueologia.
Todo projeto com usuarios reais DEVE ter um canal que EMPURRA erros ate o
dono no momento em que acontecem. Opcoes em ordem de preferencia:

1. **Sentry** — free tier generoso, setup ~10 min por projeto
2. **GlitchTip self-hosted** — API compativel com Sentry, roda na propria VPS,
   sem custo recorrente
3. **Minimo viavel** — handler global de erro nao tratado → webhook para canal
   do dono (Telegram/Slack/Discord) com mensagem + stack

Requisitos:

- **Handler global instalado:** backend (`uncaughtException`/`unhandledRejection`
  ou middleware de erro do framework) + frontend (ErrorBoundary raiz que
  reporta + `window.onerror`/`onunhandledrejection`)
- **Registrado no CLAUDE.md** do projeto, secao `## Infrastructure`:
  `Error tracking: {DSN/canal}` — e no `.aivoux/infra.md` quando existir
- **Gate do @devops no deploy:** error tracking configurado + **1 evento de
  teste RECEBIDO no canal** (evidencia runtime — "configurei" sem evento
  recebido nao conta, mesma regra do QA Runtime Verification)

O que isso muda na pratica: erro em producao → alerta chega em segundos com
stack + contexto → o log estruturado (#1) diz exatamente o request que quebrou
→ fix antes do segundo usuario passar pelo mesmo caminho. O raio de dano cai
de "30 usuarios em 3 dias" para "1 usuario, 1 vez".

---

## 3. Health Endpoint (boot check permanente)

O boot check do deploy-safety e one-shot. O `/health` e a versao permanente:

- `GET /health` → 200 + versao/SHA do deploy (+ checks basicos: DB alcancavel)
- **Uptime check externo** apontando para ele (UptimeRobot free, ou cron curl
  na propria VPS notificando o canal do item 2)
- Registrado em `## Infrastructure` / `.aivoux/infra.md`

---

## 4. Limite Honesto + Teste Hostil

Observabilidade NAO impede o primeiro erro — ela reduz o **raio** (1 usuario,
nao 30) e o **tempo de descoberta** (segundos, nao dias). O espaco de inputs e
infinito: "ninguem testou dessa forma" sempre vai existir. Mitigacao nas duas
pontas:

- **Antes (reduz a superficie):** o @qa testa HOSTIL de proposito, nao so o
  happy path — input vazio, gigante, unicode/emoji, tipo errado, duplo submit,
  acao repetida/concorrente. Vide check NFR do @qa.
- **Depois (rede de seguranca):** a cauda longa que escapar → error tracking
  pega → cada erro real de producao vira: fix + 1 teste de regressao
  (coding-standards #12) + linha de `## Smoke` na feature doc se for caminho
  critico. O sistema aprende por acrescimo, igual F1-F4.

---

## Matrix de Aplicacao (situacional, como security-standards)

| Escopo do change | Itens que aplicam |
|------------------|-------------------|
| Backend / API / worker novo | #1 fronteiras + regra do catch |
| QUALQUER codigo novo com try/catch | regra do catch |
| Frontend | ErrorBoundary raiz reportando + regra do catch |
| Deploy / release | #2 evento de teste recebido + #3 health |
| Projeto novo (greenfield) | tudo: logger util + tracking + health desde o inicio |

Enforcement:

- **Deterministico:** `quality-guard.sh` emite aviso para catch silencioso
  (heuristica, nao bloqueia — falso positivo possivel)
- **Bloqueante:** @qa — catch silencioso em codigo novo = FAIL; endpoint novo
  sem log de fronteira = CONCERNS; deploy sem error tracking testado = BLOCKED
  (via @devops)

---

## Anti-padroes

- ❌ `catch (e) { toast("Erro ao salvar") }` sem log — root cause evaporou
- ❌ "Configurei o Sentry" sem evento de teste recebido no canal
- ❌ Log rico durante o debug, removido no cleanup, zero em producao
- ❌ Logar payload inteiro com token/PII dentro (viola security #6)
- ❌ Job/cron que falha em silencio ha semanas e ninguem sabe
- ❌ Precisar SSHar na VPS e grepar stdout para descobrir o que quebrou ontem
