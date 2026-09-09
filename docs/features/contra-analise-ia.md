# Contra-Análise: Proposta de IA no Ceres BI (Auditoria Fria)

> Documento de revisão. Auditei a proposta enviada por outra IA contra o
> schema real do `mirror.*`, as RPCs em produção e os hooks do front-end.
> Objetivo: separar o que está correto, o que precisa de ajuste e o que é
> premissa não validada antes de sair codando.

---

## 1. TL;DR da Auditoria

| Tema | Veredito |
|---|---|
| Diagnóstico geral (15-20% das colunas usadas, agro com calendário/safras) | **Concordo** |
| 5 correlações temáticas como vetores de IA | **Concordo no recorte, mas 3 dos 5 exigem dados que hoje não estão no mirror** |
| Colunas citadas como "disponíveis" | **Várias não existem no banco mirror hoje** — verificar antes de prometer |
| Tabelas citadas (ClientePropriedade, PedidosUsado) | **Não estão como `mirror.*`** — existem como views VW_Ceres_ mas não foram materializadas |
| Abordagem "RPC agrega, LLM recebe JSON enxuto" | **Concordo** e já é o padrão do projeto |
| Distribuição de cards IA nas 6 telas finais | **Concordo**, mas com ressalva de persona |

---

## 2. Auditoria por Premissa da Proposta

### 2.1 Premissa: "29 views VW_Ceres_ ricas"

**Concordo em parte.** Existem 27 arquivos JSON em `docs/analise-views/raw/`,
mas nem todos estão materializados em `mirror.*`. Hoje o schema mirror tem
**9 tabelas de negócio** + 2 de controle:

```
mirror.sync_metadata
mirror.sync_log
mirror.crm_negocios              (ngo_*, ngo_vlr_total, etc.)
mirror.crm_pedidos               (pdo_situacao, pdo_vlr_pedido, etc.)
mirror.crm_pedidos_item          (pdo_item_grupo, pdo_item_marca, ...)
mirror.crm_carteira_clientes     (cli_*, usr_nome_usuario)
mirror.crm_acoes                 (emp_cidade, aco_tipo_*, aco_vendedor)
mirror.crm_funil_etapa           (ngo_numero, funil_dsc, etapa_dsc_status, fne_duracao_dias)
mirror.usuarios
mirror.ordens_servico            (os_nr_os, os_f_status, os_dth_*)
mirror.cliente_parque_maquinas   (pqm_grupo, pqm_marca, pqm_modelo, pqm_qtd_maquinas)
```

**O que está FALANDO** na proposta quando cita `VW_Ceres_*`:

| View fonte | Tabela mirror? | Observação |
|---|---|---|
| `VW_Ceres_CRM_ClientePropriedade` | **NÃO** | Sem `mirror.cliente_propriedade`. Hectares, cultura e data de colheita **não estão agregáveis hoje**. |
| `VW_Ceres_CRM_PedidosUsado` | **NÃO** | Sem `mirror.crm_pedidos_usado`. USA_Maquina, USA_Valor, USA_Estado **não consultáveis**. |
| `VW_Ceres_AtendimentoOS` | **NÃO** | Existe como view (8.791 linhas raw), mas nada no mirror. Causa de atendimento, deslocamento etc. **off-line**. |
| `VW_Ceres_TecnicoTempo` | **NÃO** | Existe como view, mas sem mirror. TMP_DuracaoDeslocamento, TMP_TempoOcioso, TMP_KmRodado **off-line**. |
| `VW_Ceres_CRM_Negocios_Etapas` | Sim, como `mirror.crm_funil_etapa` | Mas só com `funil_dsc`, `etapa_dsc_status`, `fne_duracao_dias`. **Faltam** `fne_dthinicioetapa`, `fne_dthterminoetapa` (existem na view, não foram espelhados). |
| `VW_Ceres_OrdemServico` | Sim, como `mirror.ordens_servico` | **Versão espelhada tem só 6 colunas.** `os_dt_avaria`, métricas de tempo etc. existem na view mas **não foram materializadas**. |

**Implicação prática:** se a IA depende de "horímetro, hectares, cultura,
data de colheita, tempo de máquina parada, avaliação de usado", ou
**a)** materializamos essas tabelas mirror primeiro (criar DDL + sync + RPC),
ou **b)** aceitamos que essas correlações vão demorar 1-2 sprints a mais.

### 2.2 Premissa: colunas ricas em `VW_Ceres_CRM_Negocios` (MPP_*, USA_*, PRD_*, ORC_*)

**Não confirma.** Rodei busca direta nos JSONs em `docs/analise-views/raw/`:

| Coluna citada | Existe? |
|---|---|
| `MPP_ProdutoVlrConcorrencia` | **NÃO** encontrada |
| `MPP_DscMotivoPerdaDetalhe` | **NÃO** encontrada |
| `USA_Maquina`, `USA_Valor`, `USA_Estado` | **NÃO** encontradas (estão em `VW_Ceres_CRM_PedidosUsado`, não em `VW_Ceres_CRM_Negocios`) |
| `PRD_CondicaoProduto` | **NÃO** encontrada |
| `ORC_Valor`, `ORC_Tipo`, `ORC_Banco` | **NÃO** encontrada |
| `NGO_Probabilidade` | **SIM** (em `mirror.crm_negocios.ngo_probabilidade`) |
| `ngo_motivo_perda`, `ngo_motivo_ganho` | **SIM** (em `mirror.crm_negocios`) |

A view de Negócios tem 92 colunas, mas as citadas pelo autor da proposta
**não estão lá**. Possível confusão com colunas de tabelas relacionadas
(Produtos, PedidosUsado). Antes de vender pro cliente, validar via
`docs/analise-views/inventario-colunas.md` ou direto no banco.

### 2.3 Premissa: "horímetro do parque"

**NÃO está em `mirror.cliente_parque_maquinas`.** A tabela tem só:
`cli_id_cliente`, `pqm_grupo`, `pqm_marca`, `pqm_modelo`, `pqm_qtd_maquinas`.

**`pqm_ano` e `horímetro` não foram espelhados**, embora existam na view
origem (ver `VW_Ceres_CRM_ClienteParqueMaquinas.json`). Sem eles, o motor
"Propensão de Renovação" não tem a coluna crítica (idade da máquina). Pode-se
calcular idade aproximada via `pqm_modelo` se houver lista de modelos com
ano de lançamento, mas é trabalho extra.

### 2.4 Premissa: "tempo de máquina parada / deslocamento técnico"

**NÃO está no mirror.** A tabela `mirror.ordens_servico` tem só:
`os_nr_os`, `os_f_status`, `sit_dsc_situacao_os`, `os_dth_abertura`,
`os_dth_encerramento`. **Faltam** `os_dt_avaria`, métricas de tempo de
campo, causa do atendimento. Tudo isso está na view `VW_Ceres_AtendimentoOS`
(8.791 linhas) mas precisa de DDL nova.

### 2.5 Premissa: calendário de safras

**NÃO está em lugar nenhum do schema atual.** `CLT_DthPrevisaoColheita`,
`CLT_TipoCultura`, `PPD_Medida` (hectares) só existem como view. Nenhuma
tabela materializada. Isso inviabiliza o **Motor 3 (Timing de Safra)** até
criarmos `mirror.cliente_propriedade`.

---

## 3. Auditoria das 5 Correlações Propostas

### ✅ Motor 1 — Renovação & Share-of-Wallet

**Status parcial.** Depende de:
- `mirror.cliente_parque_maquinas` (**OK** — existe, mas sem `pqm_ano`/`horimetro`).
- `mirror.cliente_propriedade` (**FALTA**).
- `mirror.crm_pedidos_usado` (**FALTA**).
- `mirror.crm_acoes` para dias-sem-visita (**OK**).

**Recomendação:** construir primeiro a tabela `mirror.cliente_propriedade`
(a partir da view 341 linhas) + espelhar `pqm_ano` e `pqm_horimetro` em
`cliente_parque_maquinas`. Sem isso, "Propensão de Renovação" vira só
"quem tem mais máquina X da concorrente" — útil mas não decisivo.

### ⚠️ Motor 2 — Necrópsia Competitiva

**Status comprometido.** Depende de:
- `MPP_DscMotivoPerdaDetalhe` (**FALTA** em `VW_Ceres_CRM_Negocios`).
- `MPP_ProdutoVlrConcorrencia` (**FALTA**).
- `PRD_CondicaoProduto` (**FALTA**).
- `ngo_motivo_perda` (**OK**, em `mirror.crm_negocios`).

Sem essas colunas, só temos o motivo alto-nível (`ngo_motivo_perda`). A IA
vai dizer "perdemos por preço" mas não "por qual marca, por qual delta".
Para fazer essa correlação decente, ou **a)** materializamos essas colunas,
ou **b)** o usuário passa a preencher o motivo de perda com texto livre (e
LLM faz NLP no campo `ngo_motivoperdadetalhe` se ele existir).

**Recomendação:** abrir o `VW_Ceres_CRM_Negocios.json` completo e procurar
qualquer coluna `*motivo*perda*`, `*concorrencia*`, `*preco_concorrente*`.
Se nada existir na view origem, o motor precisa de input manual do
consultor ou de uma evolução no ERP.

### ⚠️ Motor 3 — Timing de Safra

**Status bloqueado.** Depende inteiramente de dados que **não estão
materializados**. Sem `mirror.cliente_propriedade` não há como ler hectares,
cultura ou data de colheita. Tudo na view origem é só 341 linhas — vale o
esforço de materializar.

**Recomendação:** DDL de `mirror.cliente_propriedade` é trivial. Fazer
antes de priorizar este motor.

### ✅ Motor 4 — Fricção de Funil & Crédito

**Status viável.** Dados:
- `mirror.crm_funil_etapa` tem `funil_dsc`, `etapa_dsc_status`,
  `fne_duracao_dias`. Pode calcular duração por etapa direto.
- `mirror.crm_pedidos` tem `pdo_financiamentobanco` (lista bancos já
  suportada pela `rpc_pedidos_bi.sharePorBanco`).
- `mirror.crm_negocios` tem `ngo_qtd_acoes` para esforço.

**Limitação:** `mirror.crm_funil_etapa` **não tem** `fne_dthinicioetapa`
nem `fne_dthterminoetapa` (existem na view origem mas não foram espelhados).
Sem isso, calcular "SLA estourado por etapa" exige derivar da duração
(`fne_duracao_dias`) sem data absoluta. Funciona para ranking, mas não
para "negocios abertos há mais de X dias sem fechar".

**Recomendação:** incluir essas 2 colunas no espelho (são timestamps, 1 linha
por negócio-etapa, custo de storage desprezível). Depois, criar
`rpc_friccao_funil` agregando por etapa + banco.

### ✅ Motor 5 — Pós-Venda x Vendas (alerta de churn)

**Status viável com ressalva.** Dados:
- `mirror.ordens_servico` (147 linhas) tem `os_dth_abertura`/`os_dth_encerramento`
  → dá pra calcular tempo de resolução.
- `mirror.crm_negocios` tem cliente (`emp_*` join manual, mais complexo).

**Limitação:** sem `mirror.cliente` consolidado, o join OS↔Negócios depende
de campos textuais (nome do cliente) ou do `emp_*` carregado na OS. A view
origem `VW_Ceres_OrdemServico` tem `OS_idCliente`, então vale espelhar.

**Recomendação:** incluir `os_idcliente` no `mirror.ordens_servico` (1
alteração barata), criar `rpc_os_cliente_join` agregando OS por cliente
nos últimos 90d, cruzar com negocios abertos do mesmo cliente.

---

## 4. Auditoria dos Payloads

### Payload 1 — Diagnóstico Comercial

| Campo | Disponível? |
|---|---|
| `total_negocios`, `valor_ganho`, `valor_perdido`, `taxa_conversao`, `ciclo_medio_dias` | **SIM** (já cobertos por `rpc_negocios_bi`) |
| `motivos_perda[].marca_concorrente_citada` | **NÃO** sem MPP_* |
| `motivos_perda[].diferenca_media_pct` | **NÃO** sem MPP_ProdutoVlrConcorrencia |
| `motivos_perda[].banco_citado` | **SIM** (`pdo_financiamentobanco` no pedido) |
| `usados_na_troca.negocios_com_usado`, `valor_total_usados`, `conversao_com/sem_usado` | **NÃO** sem `mirror.crm_pedidos_usado` |
| `gargalos_etapas[]` com SLA | **SIM** com ajustes (não tem SLA configurado por etapa no banco; precisa parametrizar do lado do código) |

### Payload 2 — Parque & Carteira

| Campo | Disponível? |
|---|---|
| `base_instalada_faixas[].maquinas` por idade | **PARCIAL** — só com `pqm_grupo/marca` (não tem idade) |
| `base_instalada_faixas[].share_nossa_marca_pct` | **SIM** (calculável a partir de `pqm_marca`) |
| `clientes_alto_potencial_sem_contato_90d[].hectares` | **NÃO** sem `mirror.cliente_propriedade` |
| `clientes_alto_potencial_sem_contato_90d[].cultura` | **NÃO** |
| `clientes_alto_potencial_sem_contato_90d[].dias_sem_visita` | **SIM** (derivado de `mirror.crm_acoes`) |

### Payload 3 — Pós-Venda & SLA

| Campo | Disponível? |
|---|---|
| `total_os`, `abertas`, `tempo_medio_resolucao`, `mediana_dias` | **SIM** (já cobertos por `rpc_servicos_bi`) |
| `top_causas[].causa` | **NÃO** (view existe como `VW_Ceres_AtendimentoOS`, mas não espelhada — note que **ServicosSection.tsx já tem chart de Causas Atendimento marcado como "dados não migrados"**) |
| `eficiencia_filiais[].utilizacao_tecnicos_pct` | **PARCIAL** (não temos tempo ocioso espelhado) |

---

## 5. Onde Concordo Totalmente

1. **Pré-agregação via RPC, JSON enxuto pra LLM.** É exatamente o padrão que já temos: as RPCs (`rpc_pedidos_bi`, `rpc_servicos_bi`, `rpc_inteligencia_bi`, `rpc_acoes_*`) já retornam JSON pronto. **Não enviar linhas brutas** é regra.
2. **5 eixos temáticos são bons.** Renovação, necropsia competitiva, timing de safra, fricção de funil e pós-venda x vendas cobrem o ciclo do agronegócio.
3. **Cards IA nas 6 telas finais.** A alocação proposta (Comercial aba 1, Comercial aba 3 Carteira, Serviços aba 1, Equipe) **casa** com a proposta de consolidação do doc anterior.
4. **NÃO replicar UI em 50 telas.** IA deve aparecer onde o usuário já toma decisão, não como tela nova.

---

## 6. Onde Discordo ou Ajusto

### 6.1 "5 motores" como ponto de partida — sim, mas em estágios

**Discordo** em tratar os 5 como se fossem equally-ready. Pelo exposto
acima, o que está realmente viável no banco hoje:

| Motor | Readiness | Bloqueio |
|---|---|---|
| 4. Fricção de Funil & Crédito | 🟢 **Pronto** | Só precisa espelhar 2 timestamps em `crm_funil_etapa` |
| 1. Renovação & Share-of-Wallet | 🟡 **Parcial** | Falta espelhar `pqm_ano`/`horimetro` + criar `mirror.cliente_propriedade` |
| 5. Pós-Venda x Vendas | 🟡 **Parcial** | Falta espelhar `os_idcliente` + tabela de atendimentos |
| 2. Necrópsia Competitiva | 🔴 **Bloqueado** | Faltam colunas de motivo detalhado e concorrente (precisa voltar no ERP) |
| 3. Timing de Safra | 🔴 **Bloqueado** | Falta `mirror.cliente_propriedade` inteira |

**Recomendação de sequência:**
- **Sprint 1**: Motor 4 (já viável) + DDL de `mirror.cliente_propriedade`
  + DDL de `mirror.crm_pedidos_usado` + espelhar colunas faltantes.
- **Sprint 2**: Motor 1 + Motor 5 (dados disponíveis).
- **Sprint 3**: Motor 2 (precisa entender se colunas vão voltar no ERP ou
  se LLM vai fazer NLP no motivo de perda texto livre).
- **Sprint 3-4**: Motor 3 (depende de tudo do Sprint 1 + tratamento de
  sazonalidade).

### 6.2 Personas e frequência

A proposta distribui IA em 4 telas mas não diferencia persona. Vale
pensar em:

| Persona | Tela que abre | Insight IA relevante |
|---|---|---|
| **Diretor / Gerente regional** | Visão Geral (crm.overview) | Resumo executivo 1-clique: o que fechar, o que perdeu, o que travou |
| **Gerente comercial** | Comercial aba 1 | Motor 4 (fricção funil) + Motor 2 (competitiva) |
| **Consultor de vendas** | Ações / Equipe | Motor 1 (renovação dos MEUS clientes) + coaching individual |
| **Gerente de pós-venda** | Serviços aba 1 | Motor 5 (churn) + SLA por filial |
| **Analista de marketing/expansão** | Mapa de Ações | Motor 3 (timing safra) |

**Se Diretor não vê IA no card de Visão Geral, perde valor de produto.**
A outra IA pulou essa tela. **Adiciono: card IA enxuto no topo de Visão
Geral**, com 3 bullets curtos (top perda, top ganho, top gargalo).

### 6.3 "Cliente sem classificação ERP"

A proposta cita `PRD_CondicaoProduto` e `Classificação de Clientes` (que
existe em `bi/admin`). A maioria dos clientes está sem classificação. A IA
vai receber dados esparsos nesse campo. **Filtro**: tratar `null` e
"Sem classificação" como categoria neutra, não inventar.

### 6.4 Custos de LLM

A proposta não menciona custo. Hoje cada chamada a Claude Sonnet para um
JSON de 2-3 KB custa fração de centavo. 100 usuários abrindo o BI 1x/dia
com 4 cards IA = ~12k chamadas/mês. Barato. **Não é bloqueador, mas vale
logar consumo desde o dia 1.**

### 6.5 Privacidade / LGPD

`cli_nome`, `cli_cnpj`, hectares etc. vão para a LLM. **Vale**:
- Mascarar CNPJ nos payloads (`***.456.789/**-**`).
- Pseudonimizar nome do cliente quando não for o próprio usuário olhando
  (ex: em cards IA de Diretor — mostrar "Cliente A — 3.400 ha").
- Logar prompts e respostas por 30d para auditoria.

### 6.6 A IA hoje já está em produção?

**Sim, parcialmente.** O `InsightEquipeCard` em `crm/consultores/Equipe`
já roda análise por consultor (via hook `useInsightsEquipeCard` que
provavelmente chama a mesma API). Vale auditar esse card antes de
expandir, para garantir que o padrão de prompt/contrato é consistente.

---

## 7. Itens para Arbitragem da Outra IA

> Pontos onde quero a opinião dela antes de fechar o plano.

1. **Sequenciamento dos 5 motores**: concorda em empurrar Motor 2 e Motor
   3 para sprints 3-4 por falta de dados, ou prefere começar pelos
   bloqueados mesmo (fazendo ETL no meio)?
2. **Cards IA em Visão Geral**: você pulou essa tela. Diretor não tem IA
   hoje. Vale adicionar um card enxuto (3 bullets) ou mantém a Visão
   Geral como "resumo estático"?
3. **Materialização de tabelas mirror**: prefere (a) DDL migrations novas
   agora, ou (b) cross-LIKE direto nas views VW_Ceres_* via PostgREST
   wrapper? Trade-off: DDL é idempotente e versionado; wrapper é zero
   migration mas perde índices e tipos.
4. **NLP em `ngo_motivo_perda`**: se o consultor escreve "perdi pq
   concorrente X tava 8% mais barato + banco aprovou em 5 dias", vale
   treinar LLM a extrair `{marca, delta_pct, banco, dias_aprovacao}` ou
   isso é pedir demais e a coluna precisa voltar como estruturada?
5. **Pseudonimização por persona**: a proposta assume que quem vê o nome
   do cliente é o consultor dono da carteira. Vale permitir que Diretor
   veja sem nome ou vale assumir que Diretor tem direito de ver tudo?
6. **Latência aceitável**: cards IA rodam on-demand (ao abrir tela) ou
   on-schedule (cron diário, cache do JSON)? Trade-off: on-demand = mais
   rico mas 1-3s de espera; on-schedule = rápido mas "insight de ontem".
7. **Métrica de sucesso**: qual KPI mede se a IA está entregando valor?
   Sugiro: (a) % de usuários que clicam para expandir o insight,
   (b) tempo de permanência na tela, (c) NPS por tela. Concorda?
8. **Otimização do prompt**: para Motor 4 (mais maduro), vale A/B testar
   2-3 variações de prompt com mesmo input? Em 1 sprint dá pra medir.
9. **Fallback sem LLM**: se a chamada falhar (timeout, quota), o que
   mostra? Recomendo: mostrar "Insight indisponível — tente novamente"
   + os 3 KPIs brutos por trás. Nunca mostrar esqueleto vazio.
10. **Cobertura de dados "off"**: dos 5 motores, 2 estão bloqueados.
    Vale entregar os outros 3 com aviso "faltam dados de propriedade/
    usado" ou só liberar quando todos estiverem prontos?

---

## 8. Recomendação Final para o Plano

**Curto prazo (2 sprints):**
- Motor 4 (Fricção de Funil) + Card IA enxuto na Visão Geral + DDL de
  `mirror.cliente_propriedade` + espelhar `pqm_ano`/`pqm_horimetro`.
- Auditar contrato do `InsightEquipeCard` atual para garantir reuso.

**Médio prazo (3-4 sprints):**
- Motor 1 (Renovação) + Motor 5 (Churn).
- Materializar `mirror.crm_pedidos_usado`.
- Adicionar IA na aba Carteira da nova Comercial.

**Longo prazo (5+ sprints):**
- Motor 2 (Necrópsia Competitiva) — depende do ERP ou de NLP em
  texto livre.
- Motor 3 (Timing de Safra) — depende de `mirror.cliente_propriedade`
  populado e de calendário de safras por cultura/UF (dicionário externo).

**Não fazer:**
- Inventar dados que não estão no banco ("68% das perdas foram pra Marca X"
  sem a coluna `marca_concorrente`).
- Prometer SLA de insight sem definir orçamento de tokens.
- Colocar IA em toda tela — 4 cards IA é o sweet spot, mais que isso
  polui e ninguém lê.

---

## 9. Apêndice — Colunas Validadas no Banco Mirror

Lista do que existe hoje (auditado em `supabase/migrations/20260603_create_mirror_schema.sql`):

```
mirror.crm_negocios: ngo_numero, ngo_conclusao, ngo_etapa, ngo_funil,
  ngo_vlr_total, ngo_forma_entrada, ngo_motivo_perda, ngo_motivo_ganho,
  ngo_ciclo_vendas, ngo_qtd_acoes, ngo_probabilidade, ngo_vendedores,
  ngo_data_cadastro, ngo_data_fechamento

mirror.crm_pedidos: ngo_numero, pdo_situacao, pdo_vlr_pedido,
  pdo_vlr_financiado, pdo_vlr_recurso_proprio, pdo_cidade_uf_entrega,
  pdo_vendedor, pdo_dth_pedido

mirror.crm_pedidos_item: pdo_item_grupo, pdo_item_marca, pdo_item_modelo,
  pdo_item_qtde, pdo_item_vlr_unitario

mirror.crm_carteira_clientes: cli_id_cliente, cli_tipo_cliente,
  cli_prospect, cli_uf, cli_cidade, usr_nome_usuario

mirror.crm_acoes: emp_cidade, cli_nome, aco_tipo_contato, aco_tipo_acao,
  aco_vendedor, aco_atividade_executada, aco_lat, aco_lon, aco_dth_conclusao

mirror.crm_funil_etapa: ngo_numero, funil_dsc, etapa_dsc_status,
  fne_duracao_dias

mirror.usuarios: usr_cod_usuario, usr_id_usuario, usr_nome_usuario

mirror.ordens_servico: os_nr_os, os_f_status, sit_dsc_situacao_os,
  os_dth_abertura, os_dth_encerramento

mirror.cliente_parque_maquinas: cli_id_cliente, pqm_grupo, pqm_marca,
  pqm_modelo, pqm_qtd_maquinas
```

**Tabelas que NÃO existem no mirror (mas têm view origem):**
- `mirror.cliente_propriedade` (faltam hectares, cultura, data colheita)
- `mirror.crm_pedidos_usado` (faltam USA_*)
- `mirror.atendimento_os` (faltam ATD_*, causas, deslocamento)
- `mirror.tecnico_tempo` (faltam TMP_*, horímetro de campo)