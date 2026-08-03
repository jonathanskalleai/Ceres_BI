# Handoff — 2026-07-24 · /bi/acoes v4 (valor por status + tabela completa)

**Status da sessao:** INCOMPLETA — pipeline parado no loop @dev→@reviewer.
**Nada foi pushado.** Nada foi deployado. `origin/main` continua em `71133a5`.

---

## 1. O que a demanda era

Tres pedidos do usuario na tela `/bi/acoes`:

1. Tabela "Acoes do Periodo" mostrava so as **ultimas 50** — tem que mostrar todas do
   filtro de data (mes atual ≈ 664).
2. Falta a coluna **observacao** nessa tabela.
3. O grafico de pizza "Distribuicao por Tipo de Acao" (17 fatias) e ilegivel —
   repensar UX da dashboard.

Discussao com 4 agentes (@ux, @bi-visualizer, @bi-strategist, @architect) revelou
**3 defeitos pre-existentes** que o usuario mandou corrigir na mesma entrega.

---

## 2. Descobertas de dado (validadas no banco vivo — NAO re-descobrir)

### 2.1 A coluna de observacao e `aco_atividadeexecutada`

**NAO existe `aco_observacao`.** O texto livre do consultor esta em
`mirror.crm_acoes.aco_atividadeexecutada` (100% preenchida, media 208 chars, max 878).
Nao confundir com `aco_atividadeaserexecutada`, que e o PLANEJADO.

### 2.2 A cadeia do valor (validada com o usuario, caso real)

```
mirror.crm_acoes         ← NAO TEM NENHUMA COLUNA DE VALOR
   │  ngo_nronegocio  (preenchido em so 260 de 662 acoes do mes = 39%)
   ├──► mirror.crm_negocios  (ngo_numero)  → ngo_vlrtotalnegociado
   ├──► mirror.crm_pedidos   (ngo_numero)  → pdo_vlrpedido (NAO usado ainda)
   └──► mirror.crm_funil_etapa (ngo_numero) → historico de etapa (sem valor)
```

**`ngo_vlrtotalnegociado` e a UNICA fonte confiavel.** Motivos medidos:
- `crm_negocios` esta no grao **negocio x produto** — o valor do cabecalho se repete
  em cada linha de produto. Obrigatorio `DISTINCT ON (ngo_numero)`.
- **NUNCA somar `prd_vlrunitario * prd_qtde`:** so 3.139 de 4.525 negocios (69%)
  reconciliam. Casos reais: negocio `…418972` total 250.000 vs produtos 227.000;
  negocio `…058972` total 76.000 com as DUAS linhas trazendo 76.000 cada (somar daria
  o dobro).
- Outras colunas de valor e seu preenchimento: `orc_valor` 44% (orcamento),
  `usa_valor` 8% (maquina usada na troca), `mpr_produtovlrconcorrencia` 2% (texto).

### 2.3 Caso de validacao (o usuario conferiu contra a tela do CRM — bateu)

**MARCELO FERNANDES** · `cli_idcliente = 5518438` · cod 8850 · Monte Castelo ·
consultor CARLOS AUGUSTO AUGUSTIN · 32 acoes.

Negocio perdido **`25062710152718485`**:
- `ngo_conclusao` = Perdido · `ngo_etapa` = 3-PROPOSTA AO CLIENTE · `ngo_funil` = VENDAS
- **`ngo_vlrtotalnegociado` = R$ 66.000,00** (= `orc_valor`)
- `ngo_motivoperda` = PRECO · `mpr_produtovlrconcorrencia` = R$ 46.000,00
- obs: *"O mesmo informou ter fechado com Toni cerealista distribuidor tatu 7.000
  litros a R$46.000,00"*
- Funil: OPORTUNIDADE 27/06/2025→22/05/2026 (328,8 dias) → PROPOSTA 22/05→**15/06/2026**
- **`prd_vlrunitario` = 0,00 e produto em branco** — prova viva de que o valor por
  produto nao serve: esse negocio apareceria como R$ 0.
- 12 acoes vinculadas. Junção ingenua nesse cliente devolve R$ 1.629.900 quando o real
  e R$ 240.300 (**6,8x**) — por isso o `DISTINCT ON`.

### 2.4 Dois fan-outs que o `LIMIT 50` mascarava

- **Carteira:** `LEFT JOIN mirror.crm_carteira_clientes ON cli_idcliente` multiplica
  **2,22x** (662 acoes de julho → 1.470 linhas), porque a PK e
  `(cli_idcliente, usr_idusuario)` e o mesmo cliente esta na carteira de varios
  vendedores. **Afetava tambem `porCidade` e o heatmap:** "Faxinal dos Guedes" liderava
  com 114 acoes falsas; corrigido, sai do top 5 e Mafra assume com 61.
- **Produto:** ja tratado pela CTE `negocios_dedup` da v3.

### 2.5 O funil MARKETING inflava o "Ganho" — decisao do usuario

Sem filtro de funil, "Ganho" do mes = R$ 4,74 M, mas inclui:
- MARKETING / **4-REALIZAR NPS**: 16 neg, R$ 1,56 M (pesquisa respondida, nao venda)
- BANCOS / 2-ESTEIRA: 8 neg, R$ 1,42 M (financiamento aprovado)
- OFICINA: R$ 589 k (ordem de servico)

**Pior: e o mesmo dinheiro contado 2-3x.** A mesma venda vira negocios separados com
`ngo_numero` diferente e MESMO valor em funis paralelos. Confirmado:
DIEGO LUIZ BADIA R$ 2.000.000 em MARKETING **e** VENDAS; ANTON HERING R$ 250.000 em
**3** negocios; JACSON GRANDO GANDOLFI R$ 510.000 em BANCOS **e** VENDAS.

**Decisao do usuario:** restringir a `ngo_funil IN ('VENDAS','Vendas AP','REPASSE DE MAQUINA')`.

### 2.6 Cidade: KPI mentia

`emp_cidade` = FILIAL (4 valores distintos no mes) vs `cli_cidade` = CLIENTE (88-90).
O KPI e o filtro usavam filial; os graficos ja usavam cliente (commit `e25af7a`).
**Decisao do usuario:** padronizar tudo em `cli_cidade`.

---

## 3. Decisoes do usuario (todas confirmadas explicitamente)

| Tema | Decisao |
|---|---|
| Chart tipo de acao | Barra horizontal **Top 8 + "Outros (N)"**, cor unica, sem legenda |
| Escopo | **So `/bi/acoes`** — as outras 5 secoes com donut ficam pra outra demanda |
| 3 defeitos pre-existentes | **Corrigir os 3** nesta entrega |
| Valor | **3 cards**: Em Aberto / Ganho / Perdido |
| Funis | **So comerciais** (VENDAS, Vendas AP, REPASSE DE MAQUINA) |
| Contagem | **Negocio TOCADO no periodo** (ancora `aco_dthconclusao`) |

---

## 4. BASELINE — os numeros que a tela TEM que mostrar

Mes atual (2026-07), funis comerciais, validado por psql no banco vivo:

| Card | Negocios | Valor |
|---|---:|---:|
| **Em Aberto** | 111 | **R$ 16.835.875,30** |
| **Ganho** | 6 | **R$ 754.500,00** |
| **Perdido** | 2 | **R$ 135.000,00** |

Controles: `valorTocado` = 17.725.375,30 (= soma exata) · `negociosTocados` = 119 ·
`negociosOutrosStatus` = **0** · `totalAcoes` = **664** · `cidades` = **90** (era 4).
`rpc_acoes_detalhe` mes: `rows` = `total` = **664** (NAO 1.472 — prova do anti-fan-out).
Ano inteiro: **5.538 linhas** > `p_limit` 2000 → o rodape de truncamento e obrigatorio.
Latencia v4: `rpc_acoes_bi` 237ms (ano inteiro, 9,5 KB) · `rpc_acoes_detalhe` 112ms.

---

## 5. ESTADO EXATO DO CODIGO

### Commitado (local, SEM PUSH)

| SHA | Conteudo | Estado |
|---|---|---|
| `6c3a7fe` | `20260724_rpc_acoes_bi_v4.sql` + `20260724_rpc_acoes_detalhe.sql` | **APLICADAS no banco vivo** |
| `161b38c` | Frontend v1 (7 arquivos + 2 suites de teste) | **@reviewer deu FAIL** |

`origin/main` = `71133a5`. Nada pushado.

### NAO commitado (working tree) — as 6 correcoes do @reviewer, TODAS FEITAS

O @dev completou as 6 correcoes mas **foi interrompido antes de commitar**:

| # | Correcao | Arquivo | Feito? |
|---|---|---|---|
| 1 | `biRpc.ts` 419 linhas (hard gate 400) | `src/types/bi/*.ts` (10 novos) + `biRpc.ts` virou barril de 22 linhas | SIM |
| 2 | LATERAL duplicado 4x → funcao | `20260724_fn_cli_cidade_v5.sql` | SIM (**NAO APLICADA**) |
| 3 | `LIMIT 1` sem `ORDER BY` | idem, `ORDER BY c.usr_idusuario` | SIM (**NAO APLICADA**) |
| 4 | detector que ninguem lia | badge em `AcoesKpiGrid.tsx` | SIM |
| 5 | **erro da RPC virava "sem acoes"** | `error` propagado em `AcoesSection.tsx` | SIM |
| 6 | card+skeleton 3x, `bg-foreground/5` | `BiTableCard.tsx` novo | SIM |

### Gates rodados por mim (router) apos as correcoes

```
npx tsc --noEmit   → limpo (zero erros)
npx vitest run     → 9 arquivos, 135/135 testes passando
npm run build      → OK, built in 6.40s
```

---

## 6. O QUE FALTA — ordem exata

1. **@data-engineer:** revisar `20260724_fn_cli_cidade_v5.sql` (escrita pelo @dev, nao
   por ele), **aplicar no banco vivo**, re-validar o baseline da secao 4 e **medir
   latencia** — trocar LATERAL inline por funcao escalar pode virar N chamadas por
   linha; se regredir, propor alternativa.
2. **Commitar** codigo + migration (o working tree tem tudo pronto).
3. **@reviewer:** re-review OBRIGATORIO — o verdict e por-SHA e caduca a cada commit.
   `reviewer-verdict.json` atual = **FAIL** em `161b38c`.
4. **@qa:** so destrava com reviewer PASS (`review-gate.sh`). Validar tudo da secao 8.
5. **@scribe:** atualizar `docs/features/acoes-bi.md`.
6. **@devops:** push + deploy na VPS (boot check + smoke + SHA do remoto).

**Como aplicar SQL no banco vivo** (self-hosted, **NAO** o Cloud do `config.toml`):
```bash
ssh -o BatchMode=yes -i ~/.ssh/id_ed25519 root@178.238.235.203 \
  "docker exec \$(docker ps -q -f name=supabase_db | head -1) psql -U postgres -d postgres -c \"...\""
```

---

## 7. PENDENCIA CRITICA — validacao visual NUNCA foi feita

O Playwright abre sessao propria e cai no `/login`; a sessao logada do usuario no
browser dele nao passa pro MCP. **Ninguem viu a tela renderizada.** O que existe:
dados validados por psql (forte) + 13 testes de runtime em jsdom.

**Nao emitir QA PASS sem resolver isso.** Opcoes: o usuario abre e confere; ou
Playwright com credencial em `.env.local` gitignored (o agente nunca le o valor).

> **REGRA ABSOLUTA:** o usuario colou email + senha de producao no chat nesta sessao.
> A credencial NAO foi usada e o valor nao foi registrado em lugar nenhum. Foi pedido
> que ele **trocasse a senha** — confirmar se trocou. Nunca aceitar credencial no chat.

---

## 8. Checklist de validacao do @qa

1. Baseline dos 3 cards da secao 4 bate **exato** na tela.
2. `rows`/`total` = 664, nao 1.472 (anti-fan-out).
3. Soma fechada: `valorAberto+valorGanho+valorPerdido == valorTocado`; `negociosOutrosStatus == 0`.
4. **Regressao MARCELO FERNANDES:** filtro 01/06–30/06/2026 → negocio `25062710152718485`
   entra em Perdido com R$ 66.000; a tabela traz as 6 acoes dele com observacao visivel.
5. Funil orfao: nenhum funil de VENDA fora da lista comercial.
6. Tabela: contador "100 de 664", "Carregar mais" funciona, busca casa na observacao.
7. Ano inteiro: rodape "Mostrando 2.000 de 5.538 — refine o filtro".
8. Observacao expande no **clique E no teclado** (`aria-expanded`).
9. Chart: 9 barras (Top 8 + Outros), sem legenda, soma bate com o total.
10. **Smoke do vizinho:** `/bi/painel` OK (`usePainelKPIsRpc` chama `useAcoesBIRpc` 2x).
11. Os 6 passos de `## Smoke` de `docs/features/acoes-bi.md`.

---

## 9. AVISAR O USUARIO — numeros que MUDAM na tela

Nao e regressao, e correcao de defeito. Mas sem aviso vira "o BI quebrou":

- **Heatmap e grafico de cidades caem ~2,2x e mudam de ordem.** "Faxinal dos Guedes"
  sai do topo (era 114 acoes infladas), Mafra assume com 61.
- **"Cidades Atendidas": 4 → 90** (passou a contar cidade do cliente, nao da filial).
- **O valor unico de R$ 22,2 M vira 3 cards** somando R$ 17,7 M (Perdido saiu da soma
  e os funis nao-comerciais foram excluidos).
- **Filtro de cidade** agora filtra por cidade do CLIENTE — links/bookmarks antigos
  com cidade de filial nao casam mais.

---

## 10. Debitos registrados (fora do escopo, NAO corrigidos)

- **`npm run lint` tem 123 erros / 13 avisos pre-existentes** em `supabase/functions/*`,
  `src/components/ui/*` (shadcn) e `tailwind.config.ts`. Zero nos arquivos desta entrega
  (contagem identica antes/depois). Enquanto ficar assim, "lint passou" nao significa
  nada neste projeto — o quality gate #1 esta cego.
- `PieChartWithLabels` com o mesmo defeito de paleta (`palette[i % 7]`, 7 cores) em
  **5 outras secoes**: Operacional, Admin, Pedidos, Produtos, Servicos. Regra proposta
  pelo @ux: donut so com ≤5 categorias.
- KPIs de vaidade sugeridos para corte pelo @bi-strategist (nao aprovados pelo usuario):
  "Tipos de Acao", chart "Acoes por Dia da Semana".
- Metricas de maior valor sugeridas e nao implementadas: acoes/consultor/**dia util**,
  **cobertura de carteira** (% de clientes com ≥1 acao), taxa de acao valida,
  % reagendamento, conversao acao→negocio.
- **`crm_pedidos` nunca foi usada na tela de acoes.** Tem `ngo_numero` (1.646 pedidos,
  zero orfaos), `pdo_vlrpedido` R$ 181,7 M, `pdo_dthaprovacao`, `pdo_dthassinaturacliente`.
  E venda com documento — mais forte que o "Ganho" do CRM. **Cuidado: 1 negocio pode ter
  varios pedidos** (achei um com 6) — junção 1:N, somar por pedido, nao por negocio.
- **VENDAS teve ZERO "Ganho" no mes.** Os 6 sao todos de REPASSE DE MAQUINA. Pode ser
  mes fraco, pode ser que a equipe nao move o negocio pra "Ganho" no CRM. **Vale o
  usuario investigar** — se for o segundo caso, o card vai parecer sempre baixo.

## 11. Riscos herdados

- `crm_negocios` tem erro de ETL pendente (text DISTINCT) e `crm_carteira_clientes`
  tem PK duplicada. **Os 3 cards de valor dependem das duas.** Se o ETL regredir,
  os cards zeram silenciosamente.
- **Suposicao mais fraca do plano:** `ngo_conclusao` e o status **ATUAL** do negocio,
  nao o status na data da acao. Um negocio trabalhado em maio e perdido em junho
  aparece como "Perdido" no card de maio. Declarado no `dataSource` — decisao
  consciente do usuario.
- A lista de funis comerciais foi derivada dos dados de HOJE. **Se o ERP criar um funil
  comercial novo, ele fica invisivel nos 3 cards silenciosamente.** A constante esta
  nomeada e comentada no SQL, com query de auditoria embutida.

---

## 12. Arquivos-chave

- Plano: `.aivoux/gates/plan.md` (ancorado a `71133a5`)
- Verdict: `.aivoux/gates/reviewer-verdict.json` (**FAIL** em `161b38c`)
- Feature doc: `docs/features/acoes-bi.md` (desatualizada — @scribe pendente)
- Migrations: `supabase/migrations/20260724_rpc_acoes_bi_v4.sql`,
  `_rpc_acoes_detalhe.sql` (aplicadas), `_fn_cli_cidade_v5.sql` (**pendente**)
