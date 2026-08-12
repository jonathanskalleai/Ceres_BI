# AIVOUX - Discussion & Consensus Protocol

Protocolo de deliberacao multi-agente que roda ANTES da implementacao em
demandas de complexidade MEDIUM/COMPLEX. Objetivo: reunir multiplas perspectivas,
identificar riscos cedo e chegar a um plano consolidado antes de codar.

---

## Quando Ativa

Quando TODAS estas condicoes sao verdadeiras:
1. `discussion_mode.enabled: true` em `.aivoux/config.yaml` (default: true)
2. Complexidade da demanda >= `discussion_mode.min_complexity` (default: MEDIUM)
3. Demanda NAO e BUG_FIX trivial (bug simples pula direto para @dev)

Em SIMPLE a fase NUNCA ativa — mantem execucao rapida.

---

## Participantes Padrao (Planning Agents)

| Agente | Foco da opiniao |
|--------|-----------------|
| **@analyst** | Valor de negocio, viabilidade, mercado, metricas |
| **@pm** | Requisitos, escopo, acceptance criteria, prioridade |
| **@architect** | Viabilidade tecnica, trade-offs, riscos, stack |
| **@ux** | Fluxo do usuario, padroes de interface, a11y |

### Participantes Condicionais

| Agente | Incluir quando |
|--------|----------------|
| **@data-engineer** | Demanda envolve schema, migration, query, RLS, performance de DB |
| **@security** | Demanda toca superficie sensivel: auth, autorizacao, pagamento, dados pessoais, upload, entrada externa, secrets, CORS |

O router detecta componente de banco via keywords: "schema", "migration",
"tabela", "RLS", "query", "index", "banco", "database", "supabase" + contexto.
Detecta componente de seguranca via: "auth", "login", "senha", "pagamento",
"upload", "webhook", "permissao", "role", "PII", "token", "secret" + contexto.
No design de feature sensivel, o @security opina cedo (threat model) — barato
comparado a descobrir a falha depois de construir.

---

## Budget de Tokens

Para manter o custo controlado:

- **Max por agente:** 500 tokens de output (~200-300 palavras)
- **Max total fase 1:** ~3.000 tokens (5 agentes × 500 + overhead)
- **Max fase 2 (consenso):** 800 tokens
- **Max fase 3 (debate, se houver):** 1.500 tokens
- **Ceiling total:** ~5.500 tokens adicionais por demanda

Se a demanda for muito grande e a fase de discussao ultrapassar o budget,
router aborta a discussao e prossegue com plano do @architect apenas.

---

## Protocolo de 3 Fases

### FASE 1 — Opiniao Paralela

Router spawna cada agente participante via **Agent tool em paralelo**
(nao sequencial). Sempre `subagent_type="aivoux-{nome}"` — o modelo e enforced
via frontmatter do subagent; NUNCA passar `model` e NUNCA usar
`general-purpose` (mesma regra absoluta do router.md):

```
Agent(subagent_type="aivoux-analyst", prompt="
  Demanda do usuario: {demanda}
  Contexto: {config relevante do projeto}

  Sua tarefa: dar sua opiniao em ate 200 palavras sobre esta demanda
  do SEU ponto de vista (valor de negocio, viabilidade, metricas).
  Formato obrigatorio:

  ## Opiniao @analyst
  **Recomendacao:** {PROCEED | CAUTION | REJECT}
  **Pontos positivos:** [max 3 bullets]
  **Preocupacoes:** [max 3 bullets]
  **Proposta:** {1-2 frases com a direcao sugerida}
")
```

Mesma estrutura para `aivoux-pm`, `aivoux-architect`, `aivoux-ux`,
`aivoux-data-engineer` e `aivoux-security` quando aplicaveis (todos Opus,
enforced via frontmatter).

**Paralelismo:** todas as opinioes sao colhidas simultaneamente em UMA
unica mensagem do router com multiplos tool calls. Isso reduz latencia de
4× sequencial para 1× paralelo.

### FASE 2 — Sintese de Consenso

Router analisa as opinioes coletadas e gera um consolidated plan:

```
## Plano Consolidado

**Demanda:** {resumo}

**Consenso:**
- Pontos onde todos concordam
- Recomendacao unanime: {PROCEED | CAUTION | REJECT}

**Divergencias:**
- {agente A} sugere X, {agente B} sugere Y
- Rationale de cada lado

**Plano proposto:**
1. {passo com atribuicao de agente}
2. ...

**Riscos:** [top 3]

**Decisao do router:** {APROVADO | REQUER DEBATE | ESCALAR USUARIO}
```

**Regras de decisao:**
- **APROVADO** — Todas as opinioes alinhadas OU divergencias sao menores
- **REQUER DEBATE** — Existe pelo menos 1 divergencia SIGNIFICATIVA
  (ex: @architect sugere tech A, @pm sugere tech B com razoes validas)
- **ESCALAR USUARIO** — Divergencia critica nao resolvivel entre agentes OU
  recomendacao REJECT de 2+ agentes

### FASE 3 — Debate (apenas se REQUER DEBATE)

Um unico round de replica para resolver divergencia especifica:

```
Agent(subagent_type="aivoux-architect", prompt="
  Outro agente (@pm) discordou do seu ponto X
  por razao Y. Leia a posicao deles abaixo.

  Sua posicao anterior: {...}
  Posicao do @pm: {...}

  Responda em ate 150 palavras:
  - Voce mantem sua posicao? Por que?
  - Existe compromisso viavel?
  - Se nao ha compromisso, qual opcao voce recomenda e por que?
")
```

Rodar em paralelo para cada agente envolvido na divergencia. Depois:

- Se uma posicao vence por novos argumentos: router atualiza plano e APROVA
- Se ainda empata: **ESCALAR USUARIO** com as duas opcoes lado a lado

**Limite:** 1 round apenas. Nao existe debate infinito.

---

## Output Final da Discussao

Apos FASE 2 (ou FASE 3 se houve debate), router produz um **handoff de consenso**
que alimenta a fase de execucao:

```yaml
consensus:
  demand: "{resumo}"
  verdict: "APPROVED"
  complexity: "MEDIUM"
  debate_rounds: 0   # ou 1 se houve fase 3
  consensus_plan:
    - step: "..."
      agent: "@architect"
    - step: "..."
      agent: "@dev"
  risks: [...]
  key_decisions: [...]
  participants_aligned: ["@analyst", "@pm", "@architect", "@ux"]
  token_cost: ~3200   # estimativa
```

Este handoff e passado para os agentes de execucao (@dev, @qa) como
contexto inicial, para que eles trabalhem com o plano consolidado ao
inves de interpretar a demanda raw do zero.

---

## Escalation Automatica

Discussao e abortada e escalada ao usuario quando:
- 2+ agentes recomendam REJECT
- Debate termina em empate apos 1 round
- Budget de tokens estourado
- Qualquer agente reporta dependencia externa bloqueante (ex: API keys faltando)

O router apresenta o problema ao usuario com as opcoes e aguarda decisao.
NAO bloqueia — apenas pede input humano para resolver.

---

## Exemplo Pratico

**Demanda:** "Adicionar sistema de notificacoes em tempo real"
**Complexidade:** COMPLEX
**Discussion Mode:** ATIVO

### Fase 1 (paralelo, 4 agentes)

- **@analyst** (PROCEED): valor alto para engajamento, metrica clara
- **@pm** (PROCEED): escopo bem definido, AC testaveis
- **@architect** (CAUTION): WebSockets vs Polling vs SSE — trade-off
- **@ux** (PROCEED): padroes ja existem, facil integrar

### Fase 2 (consenso)

**Divergencia identificada:** @architect quer SSE por simplicidade,
mas se for volume alto precisa WebSocket.

**Decisao:** REQUER DEBATE

### Fase 3 (debate)

- @architect: mantem SSE, "volume atual < 1000 users, SSE aguenta"
- @pm: concorda, "podemos migrar para WebSocket se crescer"
- **Consenso:** SSE primeiro, plano de migracao documentado

### Handoff final

Plano aprovado vai para execucao:
@architect (design completo) → @data-engineer (tabela notifications)
→ @dev (impl) → @qa (review)

**Custo total fase de discussao:** ~3.800 tokens
**Tempo:** ~30s (paralelismo)
