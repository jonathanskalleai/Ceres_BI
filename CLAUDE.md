# Ceres BI — mapa do sistema (LEIA PRIMEIRO)

> Este arquivo e a porta de entrada do projeto. Uma pessoa ou IA que leia apenas
> este resumo deve entender o produto, o fluxo de dados, onde uma tela busca seus
> numeros e como aprofundar uma area sem adivinhar. Detalhes ficam nos documentos
> apontados abaixo; eles nao substituem este mapa.

## O que e este produto

O Ceres BI e uma aplicacao interna autenticada para acompanhar o CRM e a
operacao da Ceres: comercial, negocios, pedidos, acoes de campo, clientes,
produtos/parque, servicos e equipe. O frontend apresenta indicadores, tabelas,
mapas e listas de gestao; ele **nao e a origem dos dados nem deve calcular KPIs
grandes no navegador**.

O coracao do sistema e o ETL Python. Ele extrai as views do CRM Campos Dealer
(SQL Server), aplica os mapeamentos/normalizacao necessarios e carrega um mirror
Postgres. As RPCs do Postgres agregam esse mirror; os hooks e services React
chamam as RPCs; as telas exibem o resultado.

```text
CRM Campos Dealer / SQL Server
        ↓  (a cada 15 min)
ETL Python em /opt/etl-stack
        ↓
Postgres mirror.* no Supabase self-hosted (VPS)
        ↓
RPCs public.* com agregacao server-side
        ↓
services + hooks React Query → telas React
```

## Verdades que evitam os erros mais caros

1. **Supabase de producao e self-hosted na VPS; nao e Supabase Cloud.** O
   `supabase/config.toml` e o MCP do Supabase apontam para outro alvo/nao
   autenticam nesse banco. Para verificar producao, use SSH read-only na VPS e
   `docker exec` no Postgres; nao comece tentando o MCP.
2. **Python e o ETL em uso.** O cron ativo chama
   `/opt/etl-stack/run_etl_parallel.sh` a cada 15 minutos e cria cinco containers
   efemeros `etl-ceres:v15`. O antigo stack Swarm `etl_etl-*` (v14) ainda aparece,
   mas nao e o agendador ativo; replicas `0/0` nele nao provam dessincronizacao.
3. **A RPC e o contrato de uma tela.** Antes de validar um numero ou escrever SQL,
   encontre o hook/service da tela, leia a RPC instalada e a migration mais
   recente. Nunca deduza a regra por nomes de coluna ou por uma consulta ad hoc.
4. **Granularidade e data importam.** Negocio, pedido, item de pedido e acao sao
   entidades diferentes. Uma mesma tela pode combinar fontes e usar datas
   diferentes; nao cruze contagens sem reproduzir a regra da RPC.
5. **O Git pode estar atrasado da VPS.** Existem migrations aplicadas em producao
   que ainda estavam fora do controle de versao nesta auditoria. Em duvida, a
   funcao instalada no banco e a evidencia do comportamento atual; depois, o
   historico precisa ser versionado antes da proxima mudanca.

## Arquitetura e responsabilidades

| Camada | Responsabilidade | Onde comecar |
|---|---|---|
| Origem | CRM Campos Dealer / SQL Server e suas views | `docs/analise-views/` e ETL na VPS |
| Integracao | Extrair, transformar e carregar o mirror | `/opt/etl-stack/` na VPS; runbook abaixo |
| Dados BI | Tabelas `mirror.*`, funcoes auxiliares e estado de sync | `supabase/migrations/`, `docs/bi-schema-reference.md` |
| Regra de negocio | Agregacoes e filtros server-side | `public.rpc_*` e migrations correspondentes |
| Aplicacao | React 18 + TypeScript + Vite + Tailwind, React Query e Supabase JS | `src/pages/`, `src/services/`, `src/hooks/` |
| Acesso | Sessao Supabase, `ProtectedRoute` e `ModuleGuard` | `src/App.tsx`, `src/components/auth/` |
| Entrega | Imagem estatica `ceresbi:latest` por Swarm/Traefik | `Dockerfile`, `docker-stack.yml`, `deploy.sh` |

### Entidades que uma pessoa deve reconhecer

- `mirror.crm_negocios`: oportunidades/negocios do CRM; e denormalizada em
  alguns contextos, portanto costuma exigir deduplicacao por `ngo_numero`.
- `mirror.crm_pedidos` e `mirror.crm_pedidos_item`: pedido comercial e seus
  itens; a chave de deduplicacao de pedido e `pdo_codigointerno`.
- `mirror.crm_acoes`: atividades/visitas; sua data operacional e em geral
  `aco_dthconclusao`.
- `mirror.usuarios` e `mirror.crm_carteira_clientes`: dimensoes de vendedor e
  cliente/cidade; nao assuma que o nome de um vendedor tem a mesma semantica nas
  duas fontes.
- `mirror.ordens_servico`, atendimentos, agenda, ocorrencias, tecnico e parque:
  dados de pos-venda/operacao e base instalada.

Use o mapa de origem, campos e particularidades em `docs/data-map.md` e
`docs/bi-schema-reference.md`. Documentos e handoffs antigos sao contexto
historico; a migration/RPC vigente e o codigo que a consome vencem em caso de
divergencia.

## Mapa da aplicacao

- **BI:** `/bi/painel` (visao executiva), `/bi/comercial` (negocios),
  `/bi/pedidos`, `/bi/produtos`, `/bi/servicos`, `/bi/operacional`, `/bi/admin`,
  `/bi/acoes`, `/bi/inteligencia` e `/bi/etl-monitor`.
- **CRM:** `/crm/overview`, consultores, registros, criticos, mapa, insights,
  negocios e administrativo.
- Rotas, protecao e modulos autorizados estao em `src/App.tsx`. As paginas sao
  entradas finas; siga pagina → hook → `src/services/` → `rpc_*` antes de alterar
  um indicador.
- Entradas BI atuais seguem o padrao `src/pages/bi/Bi<Nome>.tsx`: por exemplo,
  `/bi/pedidos` → `src/pages/bi/BiPedidos.tsx`; `/bi/acoes` →
  `src/pages/bi/BiAcoes.tsx`; `/bi/painel` → `src/pages/bi/BiPainel.tsx`.
  Nao invente uma pasta `src/pages/bi/pedidos/` sem antes confirmar a estrutura.
- `docs/features/index.md` e o indice de contexto por feature. Ao trabalhar numa
  tela existente, abra primeiro a feature correspondente; ela lista entry points,
  contratos, riscos e smoke tests.

### Caso especial: tela `/bi/acoes`

Ela mescla **acoes** e **pedidos**, entao e a tela com maior risco de numero
plausivel porem errado.

- Visitas e outras metricas operacionais: `crm_acoes`, filtradas por data de
  conclusao.
- Ganhos/fechamentos: `crm_pedidos`, filtrados por data de aprovacao e
  deduplicados por `pdo_codigointerno`.
- A deduplicacao e estrutural: primeiro, cada `pdo_codigointerno` vira no maximo
  um pedido. Sobre cada pedido unico, aplique **os quatro filtros obrigatorios**:
  1) `pdo_situacaopedido = 'Aprovado'`; 2) `pdo_dthaprovacao` dentro da janela;
  3) negocio vinculado com `ngo_conclusao = 'Ganho'`; 4) `ngo_funil != 'REPASSE
  DE MAQUINA'`. Nao troque a exclusao por um `IN (...)` e nao omita nenhum filtro.
  Ao resumir ou validar esta regra, mencione a janela de aprovacao: ela e tao
  obrigatoria quanto o status e o funil.
- `rpc_acoes_bi` e `rpc_acoes_funil_gestao` sao a referencia; leia
  `docs/features/acoes-bi.md` antes de qualquer SQL ou ajuste nessa tela.
- Nao compare diretamente `/bi/pedidos` e `/bi/acoes`: os produtos podem ter
  janelas, fontes e filtros distintos.

## Como iniciar qualquer demanda

1. Identifique a rota/tela ou a entidade de negocio que a demanda toca.
2. Leia `docs/features/index.md` e a feature relacionada. Se ela nao existir,
   mapeie primeiro pagina, hook, service e RPC antes de propor a implementacao.
3. Leia a migration/função que produz o dado e confirme a granularidade, data e
   filtros. Para dados vivos, valide read-only no banco self-hosted.
4. Declare o modelo entendido e o raio de impacto se a mudanca altera regra de
   negocio, tabela, RPC, autenticacao ou deploy.
5. Implemente na camada correta: UI para apresentacao; RPC/migration para regra e
   agregacao; ETL para origem/mapeamento. Nao corrija um dado ruim mascarando-o
   no componente.
6. Rode os smokes da feature e os vizinhos afetados. Para mudancas de producao,
   siga os gates e o fluxo de deploy deste arquivo.

## Onde aprofundar sem se perder

| Pergunta | Documento/codigo a ler |
|---|---|
| Como a producao e o ETL realmente rodam? | `docs/architecture/production-runtime.md` |
| Qual tela, regra, risco e smoke de uma feature? | `docs/features/index.md` → `docs/features/<feature>.md` |
| Qual view/coluna do CRM corresponde ao mirror? | `docs/data-map.md`, `docs/bi-schema-reference.md`, `docs/analise-views/` |
| Qual SQL cria a regra atual? | `supabase/migrations/` e definicao da `public.rpc_*` instalada |
| Como a UI chega ao dado? | pagina em `src/pages/` → hook em `src/hooks/` → service em `src/services/` |
| O que ocorreu em uma sessao anterior? | `docs/sessions/` e `docs/handoff/` — confirmar contra o estado atual |

Segredos, senhas e chaves nao pertencem a esta documentacao nem aos runbooks.
Se um acesso exigir um deles, use o mecanismo seguro ja configurado; nunca os
procure, copie ou registre em arquivos do repositorio.

<!-- AIVOUX-START v2.21.0 -->
# AIVOUX v2.22 - Lean AI Development Framework (Squad Mode)

Este projeto usa o **AIVOUX** — framework AI-Orchestrated para Claude Code
com YOLO mode (auto-orquestracao), Plan Mode (todos os agentes em Opus via
Task tool; scribe em Haiku), e Discussion Mode (deliberacao multi-agente).

> ⚠ **Precedencia:** este bloco e um RESUMO de orientacao. A fonte CANONICA do
> fluxo de orquestracao e `.claude/commands/aivoux/router.md` + `.claude/rules/*`.
> Em QUALQUER divergencia (passo faltando aqui, formato diferente, versao antiga
> deste bloco), **o router.md e as rules VENCEM**. Um resumo desatualizado nunca
> autoriza pular um passo do router.

## Quick Start

Use o Smart Router para qualquer demanda:

```
/aivoux/router Corrigir bug de login
/aivoux/router Criar sistema de notificacoes em tempo real
/aivoux/router Auditar tech debt do projeto
```

O router analisa, delibera entre agentes quando apropriado, e executa o
squad inteiro automaticamente ate a entrega.

## Squad de Agentes (12)

> Todos os agentes rodam **Opus** (scribe em Haiku). Sem tiers, sem modo economy.

### Planning Agents (Opus)
- `/aivoux/agents/analyst` — Analise de negocio, pesquisa, PRD
- `/aivoux/agents/pm` — Product management, stories, priorizacao
- `/aivoux/agents/architect` — Arquitetura, design, brownfield discovery
- `/aivoux/agents/ux` — UX/UI design, fluxos, a11y

### Development Agents (Opus)
- `/aivoux/agents/dev` — Implementacao + 12 best practices
- `/aivoux/agents/data-engineer` — Schemas, RLS, migrations
- `/aivoux/agents/reviewer` — Code-quality gate: DRY, monolitos (aviso 300 / gate 400), dead code, estrutura. **SEMPRE no pipeline** (inclusive SIMPLE — enforcement mecanico via `review-gate.sh`)
- `/aivoux/agents/security` — Security gate CONDICIONAL: 10 security standards + threat model (auth/API/dados sensiveis/upload/secrets/deploy); verdict VULNERABLE volta ao @dev
- `/aivoux/agents/qa` — Quality assurance + audit das 12 praticas + runtime + seguranca (check raso)
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

### Regression Gate (F4) — smoke dos vizinhos antes de fechar
A mudanca funcionar ≠ o resto continuar funcionando. Todo pipeline que toca
codigo: router roda `.claude/hooks/blast-radius.sh` (arquivos tocados →
importadores reversos → features afetadas via docs/features/) e o @qa EXECUTA
a secao `## Smoke` de cada afetada + `regression_gate.critical_paths`. Smoke de
afetada falhou = FAIL (regressao introduzida pelo diff). Afetada sem smoke =
reportada explicitamente, nunca omitida. Detalhes em `.claude/rules/regression-gate.md`.

### Observability (F5) — o sistema avisa VOCE, nao o usuario
Gates F1-F4 provam que a entrega funciona HOJE; observabilidade e o que avisa
quando quebrar amanha. Em codigo novo: **NENHUM `catch` sem log/report do erro**
(catch com toast generico e supressor de erro = FAIL no @qa); log estruturado
nas fronteiras (entrada de API/webhook, falha de chamada externa, job). Em
deploy com usuarios reais: error tracking (Sentry/GlitchTip/webhook) com
**evento de teste recebido** + `/health`. BUG_FIX inclui 1 teste que reproduz
o bug. @qa testa HOSTIL (vazio, gigante, unicode, duplo submit), nao so happy
path. Detalhes em `.claude/rules/observability-standards.md`.

### Pipeline Integrity (F6) — o pipeline e INQUEBRAVEL
O pipeline (dev → reviewer → qa → scribe → devops) so pode ser pulado pelo
USUARIO, com autorizacao explicita nesta conversa. Falha de API (529), contexto
longo, "e continuacao da fase anterior", yolo_mode — nada disso autoriza pular.
**Subagente falhou:** retry 1x → PARAR e perguntar; inline so com autorizacao
= `INLINE_DEGRADED` (nunca PASS). **Enforcement mecanico** (funciona mesmo sem
router na sessao): `deploy-gate.sh` BLOQUEIA push/PR/deploy sem QA PASS ancorado
ao SHA atual + spawn real de `aivoux-qa` (`agents-run.log` via `agent-trace.sh`)
+ reviewer PASS ancorado + `## Smoke` nos critical_paths; `review-gate.sh`
BLOQUEIA spawn do @qa sem @reviewer antes (@reviewer e SEMPRE obrigatorio,
inclusive SIMPLE — complexidade nao remove gate); `scribe-gate.sh` bloqueia o
fechamento se @qa PASS sem @scribe depois; `docs-gate.sh` bloqueia spawn de
aivoux-* sem o Feature-Docs Lookup quando o projeto tem `docs/features/index.md`. Cada deploy =
pipeline nova (commit de codigo pos-verdict invalida o PASS). Detalhes em
`.claude/rules/pipeline-integrity.md`.

### Plan-First (F7) — nenhuma implementacao sem plano da solucao
Diagnosticar o problema NAO e planejar a solucao. O diagnostico (PASSO 1) entende
o que quebrou; o plano (PASSO 2.5) desenha COMO consertar — abordagem, arquivos,
o que pode QUEBRAR (blast) e como validar. Antes de spawnar `@dev`/`@data-engineer`,
o router escreve `.aivoux/gates/plan.md` ancorado ao HEAD; o hook `plan-gate.sh`
BLOQUEIA a implementacao sem ele. **Peso escalavel:** SIMPLE = 4 linhas (~1 min),
MEDIUM+ CONSOLIDA o Discussion Mode/@architect (nao e etapa nova). Complexidade
muda o TAMANHO do plano, NUNCA o remove. Detalhes em `.claude/rules/plan-first.md`.

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

## Infrastructure (runtime verificado em 2026-08-02)

> Esta secao evita acertar o codigo e consultar/deployar no lugar errado. Antes de
> qualquer mutacao remota, confirme o alvo. O runbook completo e a evidencia desta
> fotografia estao em `docs/architecture/production-runtime.md`.

### Ponto de partida obrigatorio para agentes
- O banco do BI **nao e o Supabase Cloud**: e Supabase self-hosted na VPS. O
  `project_id` de `supabase/config.toml` aponta para outro ambiente e nao deve ser
  usado para consultar ou alterar o BI.
- Nao tente o MCP do Supabase para validar dados de producao: ele nao autentica no
  Supabase self-hosted. Para diagnostico read-only, use SSH na VPS e `docker exec`
  no container `supabase_supabase_db`; para qualquer mutacao, faca o preflight e
  siga o fluxo de deploy/migration aprovado.
- Para a tela `/bi/acoes`, leia **antes de formular SQL**
  `docs/features/acoes-bi.md` e a RPC/migration vigente. A tela combina o lado de
  `crm_acoes` com o lado de `crm_pedidos`; "ganhos" nao significa simplesmente
  negocios com status Ganho.

### Repo canonico
- **URL:** `https://github.com/jonathanskalleai/Ceres_BI.git` (alias `origin`)
- **Branch de producao:** `main`
- **NAO CONFUNDIR:** existe tambem `happy-ola-builder` como remote apontando pra OUTRO repo. NUNCA push nele.
- Confirmar com `git remote -v` antes de qualquer push.

### Banco de dados (DW mirror)
- **Tipo:** PostgreSQL self-hosted via Supabase na VPS.
- **Host publico do Studio:** `https://ceressupabasebi.vouxconsultoria.com.br`
- **Stack Docker:** `supabase` no Swarm (rede overlay `redeinterna`).
- **Container do Postgres:** `supabase_supabase_db.1.*` (nome varia por replica).
- **Schema de dados do BI:** `mirror`; o estado operacional do ETL esta em
  `mirror.sync_control`. Verifique `last_sync_at` e `status`; `rows_synced` e o
  tamanho da ultima carga incremental, nao a contagem total da tabela.
- Nunca fixe IP de container: ele muda a cada restart. Dentro dos containers, use
  o DNS do service `supabase_db` quando o conector exigir um host.

### VPS de producao
- **IP:** `178.238.235.203` (user `root`, Ubuntu 24.04, sudo via senha).
- **SSH:** `ssh -i ~/.ssh/id_ed25519 root@178.238.235.203` (chave ~`aivoux-deploy`, public-key, sem senha).
- **Arquitetura:** Docker Swarm single-node + Traefik v3.5 + Portainer + Supabase self-hosted, tudo na mesma VPS.
- **Stack ceresbi:** service `web` (nginx:alpine servindo dist estatico, imagem `ceresbi:latest` local). URL publica: `https://ceresbi.vouxconsultoria.com.br`.
- **Rede overlay:** `redeinterna` (todos os services compartilham essa rede).
- **Artefatos deploy:** `Dockerfile` (multi-stage node:20→nginx), `nginx.conf`, `docker-stack.yml`, `deploy.sh`.
- **Checkout que faz deploy:** `/home/jonathan/ceresbi` (nao `/root/ceresbi`). Fluxo:
  commit/push `main` → nesse checkout `bash deploy.sh` → smoke HTTP e funcional.
  NAO hardcodar senha (repo publico = leak).

### ETL Python (caminho ATIVO)
- **Tipo:** Python 3, `psycopg2-binary pyyaml pyodbc`, codigo em `/opt/etl-stack/etl_campos_dealer.py`.
- **Agendador ativo:** `/etc/cron.d/ceres-etl-simple`, a cada 15 min, chama
  `/opt/etl-stack/run_etl_parallel.sh`.
- **Execucao ativa:** o launcher sobe cinco containers efemeros `docker run --rm`
  da imagem `etl-ceres:v15`, um por bloco, todos em paralelo, cada um com
  `etl_campos_dealer.py --block <A-E> --once`. Fluxo: SQL Server Campos Dealer →
  Python ETL → tabelas `mirror` no Postgres/Supabase.
- **Blocos:** A=crm_acoes/crm_negocios/crm_pedidos | B=crm_pedidos_item/crm_carteira_clientes/usuarios | C=ordens_servico/crm_funil_etapa/cliente_parque_maquinas | D=empresas/produtos | E=tecnico_tempo/agenda_servico/atendimentos_os/ocorrencias_os.
- **Nao confundir com o stack `etl`:** os services `etl_etl-{a..e}` (imagem v14)
  ainda existem no Swarm, mas o cron ativo NAO os escala. Estados `0/0` ou `0/1`
  desses services nao provam dessincronizacao. A fonte de verdade e o cron acima,
  `/var/log/etl/etl.log` e `mirror.sync_control`.
- **Legado:** os crons `ceres-etl-stack.disabled` e `ceres-etl.disabled`, assim
  como `/opt/etl/`, nao representam a execucao atual e nao devem ser reativados
  por tentativa de correcao.

### Comandos uteis (SSH na VPS como root via id_ed25519)
- Status do ETL ativo: `tail -n 100 /var/log/etl/etl.log` e `journalctl -u cron --since "20 minutes ago"`.
- Estado sync_control: `docker exec $(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c "SELECT table_name, last_sync_at, rows_synced, status FROM mirror.sync_control ORDER BY last_sync_at DESC;"`
- Dados reais: `SELECT MAX(coluna_data) FROM mirror.tabela`; use junto de
  `sync_control` quando a data de negocio for relevante.

### Comando de smoke test
- Frontend: `curl -I https://ceresbi.vouxconsultoria.com.br` → HTTP 200 + cert Let's Encrypt.
- ETL: nao use o stack Swarm para um smoke. Confirme no log que os blocos A-E
  encerraram `OK` e que `mirror.sync_control` foi atualizado no ciclo esperado.

## 12 Best Practices

DRY, no dead code, strict TypeScript, component size (meta <200 / aviso 300 /
HARD gate 400, FAIL acima), efficient state mgmt, proper React hooks, logic/UI
separation, proper error handling (catch SEMPRE loga — regra do catch),
performance optimizations, project structure, accessibility, adequate testing
(BUG_FIX inclui teste que reproduz o bug).

Detalhes em `.claude/rules/coding-standards.md`.

## 10 Security Standards

Secret mgmt, no frontend API exposure, input validation, auth/authz +
least privilege, common attacks (SQL/XSS/CSRF), secure logging,
password hashing, backup & recovery, dependency security, HTTPS + headers.

**Aplicacao situacional** — matrix por escopo (backend / frontend / infra / auth).
Detalhes em `.claude/rules/security-standards.md`.

**Enforcement em 2 niveis:** (1) raso e sempre — @qa check #4 nos standards
aplicaveis; (2) profundo e condicional — o **@security** entra no pipeline (apos
@reviewer, antes do @qa) quando a mudanca toca superficie sensivel (auth, authz,
entrada externa, dados pessoais, upload, secrets, deploy) e faz threat model +
auditoria, com verdict SECURE/CONCERNS/VULNERABLE. VULNERABLE volta ao @dev.

**Auditar um sistema existente:** `/aivoux/audit-security` — auditoria read-only
(espelha o `/aivoux/discover`), produz `docs/security/report.md` + backlog
priorizado por severidade. Zero fix automatico; cada correcao vira demanda via
`/aivoux/router`. Regra do segredo: relatorio registra PATH+tipo, NUNCA o valor.

## Observability Standards (F5)

Logging obrigatorio nas fronteiras + regra do catch (nenhum catch sem log),
error tracking com evento de teste recebido no deploy, health endpoint,
teste hostil no @qa. **Situacional por escopo**, como security. Log e forense;
error tracking e antecipacao — e o que faz o erro chegar em VOCE antes do usuario.
Detalhes em `.claude/rules/observability-standards.md`.

## Modos de Operacao

- **YOLO Mode** (default on) — Pipeline end-to-end automatico
- **Plan Mode** (default on) — Opus para TODOS os agentes (exceto scribe/Haiku). Sem tiers, sem modo economy.
- **Discussion Mode** (default on) — Agentes deliberam em paralelo antes de features MEDIUM/COMPLEX
- **Context Scan** (default on) — @scribe cacheia snapshot do projeto, re-scan so se stale
- **Documentation Mode** (default on) — memoria do projeto: router le `docs/features/index.md` no inicio de toda demanda e injeta docs relacionadas; @scribe atualiza/cria doc + indice apos @qa PASS (antes do @devops — doc vai no mesmo push)
- **Telemetry Mode** (default on) — Hooks coletam eventos em `.aivoux/telemetry/` (local, gitignored). Rode `/aivoux/insights` para relatorio
- **Context Watch** (default on) — Avisa quando sessao tem muitos turnos e sugere `/clear` para reduzir custo e melhorar foco. Threshold configuravel em `.aivoux/config.yaml`
- **Context Rehydration** (default on) — Salva estado cognitivo a cada N turnos e re-injeta automaticamente apos compactacao/clear. Status line mostra T:N e CTX:Xk/Yk. Config em `.aivoux/config.yaml`
- **Story Mode** (default off) — Cria story em docs/stories/ antes de implementar

Config: `.aivoux/config.yaml`

## Arquivos do Framework

- `.aivoux/config.yaml` — Modos e quality gates
- `.claude/rules/coding-standards.md` — 12 best practices detalhadas
- `.claude/rules/security-standards.md` — 10 security standards (situacional) + enforcement via @security
- `.claude/rules/deploy-safety.md` — gate de boot + smoke test pre-deploy (F1)
- `.claude/rules/change-safety.md` — preflight de alvo (F3) + confirmacao de modelo (F2)
- `.claude/rules/regression-gate.md` — blast radius + smoke das features vizinhas (F4)
- `.claude/rules/observability-standards.md` — logs + error tracking + health (F5)
- `.claude/rules/pipeline-integrity.md` — pipeline inquebravel: gates mecanicos de deploy/scribe/review/plan + protocolo de falha de subagente (F6)
- `.claude/rules/plan-first.md` — nenhuma implementacao sem plano da solucao; gate mecanico `plan-gate.sh` (F7)
- `.claude/rules/discussion-protocol.md` — Protocolo de deliberacao
- `.claude/rules/shared-config.md` — Config compartilhada
- `.claude/rules/agent-authority.md` — Matriz de autoridade
- `.claude/rules/agent-conduct.md` — NEVER/ALWAYS: honestidade brutal (§0) + nunca deletar sem confirmar
- `.claude/commands/aivoux/router.md` — Smart Router
- `.claude/commands/aivoux/discover.md` — Deep scan brownfield (semeia memoria + tech debt)
- `.claude/commands/aivoux/audit-security.md` — Auditoria de seguranca read-only (relatorio + backlog)
- `.claude/commands/aivoux/agents/*.md` — 12 agentes (inclui @reviewer e @security)
- `.claude/hooks/quality-guard.sh` — enforcement do gate de tamanho (aviso 300 / hard 400) + `any` + catch silencioso
- `.claude/hooks/blast-radius.sh` — raio de impacto deterministico do diff (regression gate F4)
- `.claude/hooks/agent-trace.sh` — registro deterministico de todo subagent spawnado (F6)
- `.claude/hooks/deploy-gate.sh` — BLOQUEIA push/PR/deploy sem QA PASS ancorado ao SHA + spawn real de @qa + reviewer PASS ancorado + smoke dos critical_paths (F6, PreToolUse)
- `.claude/hooks/review-gate.sh` — BLOQUEIA spawn do @qa sem spawn do @reviewer apos o ultimo agente de codigo (@reviewer SEMPRE obrigatorio, F6 Regra 9, PreToolUse)
- `.claude/hooks/plan-gate.sh` — BLOQUEIA spawn de @dev/@data-engineer sem plano da solucao (`.aivoux/gates/plan.md`) ancorado ao HEAD (Plan-First F7, PreToolUse)
- `.claude/hooks/security-gate.sh` — BLOQUEIA push/PR/deploy CONDICIONALMENTE (so se o diff toca superficie sensivel) sem verdict SECURE do @security ancorado ao SHA + spawn real de aivoux-security (PreToolUse)
- `.claude/hooks/scribe-gate.sh` — BLOQUEIA fechamento da sessao se @qa PASS sem @scribe depois (F6, Stop)
- `.claude/hooks/docs-gate.sh` — BLOQUEIA spawn de aivoux-* sem Feature-Docs Lookup quando ha docs/features/index.md (F6, PreToolUse)
- `.claude/hooks/docs-lookup-trace.sh` — registra a leitura do index e destrava o docs-gate (PostToolUse)
- `.claude/hooks/delete-guard.sh` — BLOQUEIA delecao/sobrescrita de .env, chaves, segredos, .git e rm -rf perigoso (PreToolUse)
- `.mcp.json` — MCP servers (supabase, playwright, context7, github, vercel, magic)

## Git Flow

`@dev` commita local → `@qa` revisa → `@devops` faz push + cria PR.
APENAS `@devops` pode fazer push/PR.

## Brownfield Discovery

Para projetos existentes, o router **automaticamente** faz context scan
antes de propor qualquer mudanca. Para o deep scan completo — mapear o projeto,
validar os fatos com voce, semear docs/features/* + infra.md e gerar backlog de
tech debt com evidencia de ferramenta (sem deletar nada):

```
/aivoux/discover
```

Manual, roda 1x por projeto (re-run quando o projeto mudou muito). Para audit
pontual de arquitetura: `/aivoux/agents/architect` + `*brownfield-discover`.

## Security Audit

Para auditar a postura de seguranca de um sistema existente — mapear a superficie
de ataque, rodar as ferramentas (secret scan, `npm audit`, SAST leve), fazer
threat model dos fluxos sensiveis, validar os achados com voce e gerar relatorio
+ backlog priorizado por severidade (sem corrigir nada automaticamente):

```
/aivoux/audit-security
```

Manual, read-only, espelha o `/aivoux/discover` mas focado em seguranca. Produz
`docs/security/report.md` + `docs/security/findings.md`. Cada correcao vira uma
demanda via `/aivoux/router` (que ativa o @security no pipeline). Defensivo:
protege a SUA aplicacao; nao faz exploracao de terceiros. Regra do segredo: o
relatorio registra PATH+tipo de credencial exposta, NUNCA o valor.
<!-- AIVOUX-END -->

## Nota historica (nao usar como instrucao operacional)

O resumo de 2026-06-30 que existia abaixo deste ponto foi substituido porque
predatava a arquitetura e trazia conclusoes que ja nao sao verdadeiras — em
especial, `mirror.sync_control` existe e e hoje uma das fontes primarias para
verificar o ciclo do ETL. Para historico, use `docs/sessions/` e
`docs/handoff/`; para o estado atual, este mapa, a RPC/migration vigente e o
runbook de producao vencem.
