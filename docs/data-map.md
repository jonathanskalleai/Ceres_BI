# Mapeamento de Dados — Dashboard BI (Ceres)

> Gerado por @scribe em 2026-06-08.  
> Fonte da verdade para KPIs, graficos e origem de dados de cada aba do dashboard.

---

## Feature Flag: USE_MIRROR

Todas as flags `USE_MIRROR` estao atualmente `true`. O comportamento:

- **true (ativo):** dados vem do Supabase PostgREST, schema `mirror.*`
- **false (fallback):** edge function `query-sqlserver` consulta views no SQL Server legado

Quando mirror nao possui a tabela equivalente (ex: TecnicoTempo, Agenda, AtendimentoOS, Ocorrencias), o service usa legado independentemente da flag.

---

## Observacoes Gerais de Dados

| Tema | Detalhe |
|------|---------|
| **Dedup Negocios** | View legada e denormalizada por produto — dedup por `NGO_Numero` obrigatoria. Mirror ja dedupa na ingestao (PK). |
| **Exclusao de leads web** | Comercial exclui `NGO_Numero` com prefixo alfabetico (W* = leads web, A* = app). |
| **Noise filtering** | Graficos de motivos/causas filtram strings vazias, "N/A", "Nenhum" antes de agrupar. |
| **Unidades Operacional** | `TMP_TempoDisponivel` e `TMP_TempoOcioso` sao em SEGUNDOS (div 60). `TMP_DuracaoAtendimento` e `TMP_DuracaoDeslocamento` sao em MINUTOS. |
| **Tabs em strings** | Campos texto podem conter tabs — trim aplicado nos services. |
| **Campos vazios** | Agrupamentos ignoram valores null/empty/whitespace-only. |
| **% Faturados** | KPI legado "% Faturados" foi removido — campo morto na view. |

---

## Mapa de Views/Tabelas

| # | View SQL Server (Legado) | Tabela Mirror (Supabase) | Secao |
|---|---|---|---|
| 1 | VW_Ceres_CRM_Negocios | mirror.crm_negocios | Comercial |
| 2 | VW_Ceres_Usuario | mirror.usuarios | Comercial (join vendedor) |
| 3 | VW_Ceres_CRM_Negocios_Etapas | mirror.crm_funil_etapa | Comercial (funil) |
| 4 | VW_Ceres_CRM_Pedidos | mirror.crm_pedidos | Pedidos |
| 5 | VW_Ceres_CRM_PedidosItem | mirror.crm_pedidos_item | Pedidos (itens) |
| 6 | VW_Ceres_OrdemServico | mirror.ordens_servico | Servicos |
| 7 | VW_Ceres_AtendimentoOS | — (sem mirror) | Servicos |
| 8 | VW_Ceres_Ocorrencias | — (sem mirror) | Servicos |
| 9 | VW_Ceres_TecnicoTempo | — (sem mirror) | Operacional |
| 10 | VW_Ceres_Agenda | — (sem mirror) | Operacional |
| 11 | VW_Ceres_CRM_ClienteParqueMaquinas | mirror.cliente_parque_maquinas | Produtos |
| 12 | VW_Ceres_CRM_CarteiraClientes | mirror.crm_carteira_clientes | Administrativo |
| 13 | VW_Ceres_Empresas | — (count only) | Administrativo |
| 14 | VW_Ceres_CRM_Acoes | mirror.crm_acoes | Acoes Comerciais |

---

## Tab: Comercial (ComercialSection)

**Hook:** `useNegociosBI` → `fetchNegociosBI` (negociosBIService)  
**Hook auxiliar:** `useFunilData` → `fetchFunilBI` (funilBIService)

### Fonte de dados — Negocios

- **Mirror:** `mirror.crm_negocios`
- **Legado:** `VW_Ceres_CRM_Negocios`
- **Colunas:** NGO_Numero, NGO_Conclusao, NGO_Etapa, NGO_Funil, NGO_VlrTotalNegociado, NGO_FormaEntrada, NGO_MotivoPerda, NGO_MotivoGanho, NGO_CicloVendas, NGO_QtdAcoes, NGO_Probabilidade, NGO_Vendedores, NGO_DataCadastro, NGO_DataFechamento
- **Join vendedor:** `mirror.usuarios` (usr_cod_usuario, usr_id_usuario, usr_nome_usuario) ou `VW_Ceres_Usuario` (USR_CodUsuario, USR_idUsuario, USR_nomeUsuario). Campo `NGO_Vendedores` mapeia codigo → nome.
- **Dedup:** por NGO_Numero (view denormalizada por produto)
- **Filtro:** exclui NGO_Numero com prefixo alfabetico

### Fonte de dados — Funil Etapas

- **Mirror:** `mirror.crm_funil_etapa`
- **Legado:** `VW_Ceres_CRM_Negocios_Etapas`
- **Colunas:** NGO_Numero, Funil_dsc, Etapa_dscStatusNegocio, FNE_DuracaoDias

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Negocios | COUNT(dedup NGO_Numero). Classificacao: NGO_Conclusao contem "ganho" → ganho, "perd" → perdido, else → andamento |
| 2 | Taxa de Conversao | ganhos / (ganhos + perdidos) * 100 |
| 3 | Pipeline Aberto | SUM(NGO_VlrTotalNegociado) WHERE status = andamento |
| 4 | Valor Ganho | SUM(NGO_VlrTotalNegociado) WHERE status = ganho |
| 5 | Ciclo de Vendas | AVG(NGO_CicloVendas) WHERE status != andamento AND valor > 0 |
| 6 | Esforco Medio | AVG(NGO_QtdAcoes) WHERE valor > 0 |

### Graficos (6)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Funil de Vendas — Pipeline por Etapa | HBar | Andamento: GROUP BY NGO_Etapa → SUM(valor), ord. numero etapa |
| 2 | Origem do Lead — Conversao | HBar stacked | GROUP BY NGO_FormaEntrada → COUNT por status, top 8 |
| 3 | Motivos de Perda — Valor Perdido | HBar | WHERE perdido, GROUP BY NGO_MotivoPerda → SUM(valor), top 8 |
| 4 | Velocidade do Funil — Gargalos | HBar | GROUP BY Etapa_dscStatusNegocio → AVG(FNE_DuracaoDias), top 12 |
| 5 | Evolucao Mensal de Negocios | VBar + Line | GROUP BY yearMonth(NGO_DataCadastro) → COUNT + SUM(valor), 12m |
| 6 | Ranking de Consultores — Valor Ganho | HBar | GROUP BY vendedorNome → SUM(valor ganho), top 10 |

---

## Tab: Pedidos (PedidosSection)

**Hook:** `usePedidosData` → `fetchPedidosBI` (pedidosBIService)  
**Hook auxiliar:** `usePedidosItensData` → `fetchPedidosItemBI` (pedidosItemBIService)

### Fonte de dados — Pedidos

- **Mirror:** `mirror.crm_pedidos`
- **Legado:** `VW_Ceres_CRM_Pedidos`
- **Colunas:** NGO_Numero, PDO_SituacaoPedido, PDO_VlrPedido, PDO_VlrFinanciado, PDO_VlrRecursoProprio, PDO_CidadeUFEntrega, PDO_Vendedor, PDO_DthPedido

### Fonte de dados — Itens

- **Mirror:** `mirror.crm_pedidos_item`
- **Legado:** `VW_Ceres_CRM_PedidosItem`
- **Colunas:** PDO_ItemGrupo, PDO_ItemMarca, PDO_ItemModelo, PDO_ItemQtde, PDO_ItemVlrUnitario

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Total Pedidos | COUNT(rows) |
| 2 | Faturamento (Aprovado) | SUM(PDO_VlrPedido) WHERE PDO_SituacaoPedido = "Aprovado" |
| 3 | Ticket Medio | faturamento / COUNT(aprovados) |
| 4 | Taxa de Aprovacao | COUNT(aprovados) / total * 100 |
| 5 | % Financiado | SUM(PDO_VlrFinanciado) / (SUM(financiado) + SUM(recurso_proprio)) * 100 |
| 6 | Valor Cancelado | SUM(PDO_VlrPedido) WHERE PDO_SituacaoPedido contem "cancel" |

### Graficos (6)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Evolucao Mensal do Faturamento | Bar + Line | WHERE aprovado, GROUP BY yearMonth(PDO_DthPedido) → SUM + COUNT, 12m |
| 2 | Mix de Pagamento | Pie | SUM(recurso_proprio) vs SUM(financiado) dos aprovados |
| 3 | Valor por Situacao do Pedido | HBar | GROUP BY PDO_SituacaoPedido → SUM(valor) + COUNT |
| 4 | Ranking Vendedores — Faturamento | HBar | WHERE aprovado, GROUP BY PDO_Vendedor → SUM(valor), top 10 |
| 5 | Top Cidades de Entrega | HBar | WHERE aprovado, GROUP BY PDO_CidadeUFEntrega → SUM(valor), top 10 |
| 6 | Itens Mais Vendidos — Grupo | HBar | GROUP BY PDO_ItemGrupo → SUM(qtde * vlr_unitario), top 10 |

---

## Tab: Servicos (ServicosSection)

**Hook:** `useServicosData` → `fetchOrdensServico`, `fetchAtendimentosOS`, `fetchOcorrencias` (servicosBIService)

### Fontes de dados

| Fonte | Mirror | Legado | Colunas-chave |
|-------|--------|--------|---------------|
| Ordens de Servico | mirror.ordens_servico | VW_Ceres_OrdemServico | OS_nrOS, OS_fStatus, SIT_dscSituacaoOS, OS_dthAbertura, OS_dthEncerramento |
| Atendimentos | — (sem mirror) | VW_Ceres_AtendimentoOS | ATD_dscCausa, ATD_DuracaoAtendimento |
| Ocorrencias | — (sem mirror) | VW_Ceres_Ocorrencias | OSE_dscMotivoPausa, OSE_dscSituacaoOcorrencia |

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Total OS | COUNT(ordens) |
| 2 | OS Abertas | COUNT WHERE OS_fStatus contem "abert" |
| 3 | Taxa de Fechamento | COUNT(fechadas) / total * 100 (OS_fStatus contem "fechad") |
| 4 | Tempo Medio Resolucao | AVG(daysBetween(OS_dthAbertura, OS_dthEncerramento)) em dias |
| 5 | Mediana Resolucao | MEDIAN dos mesmos dias |
| 6 | Total Ocorrencias | COUNT(ocorrencias) |

### Graficos (6)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | OS por Status | Pie | GROUP BY OS_fStatus → COUNT |
| 2 | Tempo de Resolucao por Faixa | VBar | Buckets: 0-3, 4-7, 8-15, 16-30, 30+ dias |
| 3 | Evolucao Mensal de Aberturas | VBar | GROUP BY yearMonth(OS_dthAbertura) → COUNT, 12m |
| 4 | Atividade de Campo — Ocorrencias | HBar | GROUP BY OSE_dscSituacaoOcorrencia → COUNT, top 8 |
| 5 | Motivos de Pausa | HBar | GROUP BY OSE_dscMotivoPausa → COUNT, top 8 |
| 6 | Causas de Atendimento | HBar | GROUP BY ATD_dscCausa → COUNT, top 8 |

---

## Tab: Operacional (OperacionalSection)

**Hook:** `useOperacionalData` → `fetchTecnicoTempo`, `fetchAgenda` (operacionalBIService)

### Fontes de dados

| Fonte | Mirror | Legado | Colunas-chave |
|-------|--------|--------|---------------|
| Tecnico Tempo | — (sem mirror*) | VW_Ceres_TecnicoTempo | USR_nomeUsuario, TMP_TempoDisponivel, TMP_DuracaoAtendimento, TMP_DuracaoDeslocamento, TMP_KmRodado, TMP_TempoOcioso, TMP_TempoExtra |
| Agenda | — (sem mirror) | VW_Ceres_Agenda | AGE_fStatus, TPS_dscTipoServicoAtendimento, USR_nomeUsuario |

> *Nota: codigo tem funcoes mirror mas sao ignoradas — mirror.crm_acoes NAO possui colunas tmp_*. Usa legacy only.

### Unidades de medida

| Campo | Unidade |
|-------|---------|
| TMP_TempoDisponivel | SEGUNDOS (dividir por 60 para minutos) |
| TMP_TempoOcioso | SEGUNDOS (dividir por 60 para minutos) |
| TMP_DuracaoAtendimento | MINUTOS |
| TMP_DuracaoDeslocamento | MINUTOS |
| TMP_KmRodado | KM (valor direto, sem conversao) |

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Tecnicos Ativos | COUNT DISTINCT(USR_nomeUsuario) |
| 2 | KM Rodado | SUM(TMP_KmRodado) |
| 3 | Utilizacao Media | (SUM(atendimento_min) + SUM(deslocamento_min)) / SUM(disponivel_min) * 100 |
| 4 | Tempo Ocioso | SUM(ocioso_min) / SUM(disponivel_min) * 100 |
| 5 | Eventos Agenda | COUNT(agenda rows) |
| 6 | Conclusao Agenda | COUNT WHERE AGE_fStatus match /conclu\|finaliz\|realizad\|fechad\|encerr/ / total * 100 |

### Graficos (4)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Utilizacao por Tecnico | HBar stacked | GROUP BY USR_nomeUsuario → % atendimento, % deslocamento, % ocioso |
| 2 | KM Rodado por Tecnico | HBar | GROUP BY USR_nomeUsuario → SUM(KM), top 12 |
| 3 | Agenda por Status | Pie | GROUP BY AGE_fStatus → COUNT, top 8 |
| 4 | Agenda por Tipo de Servico | HBar | GROUP BY TPS_dscTipoServicoAtendimento → COUNT, top 8 |

---

## Tab: Produtos (ProdutosSection)

**Hook:** `useProdutosData` → `fetchParqueBI` (produtosBIService)

### Fonte de dados

- **Mirror:** `mirror.cliente_parque_maquinas`
- **Legado:** `VW_Ceres_CRM_ClienteParqueMaquinas`
- **Colunas:** CLI_idCliente, PQM_Grupo, PQM_Marca, PQM_Modelo, PQM_QtdMaquinas
- **Obs:** se PQM_QtdMaquinas for null ou 0, assume 1

### KPIs (4 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Maquinas Instaladas | SUM(PQM_QtdMaquinas) — null/0 assume 1 |
| 2 | Clientes com Parque | COUNT DISTINCT(CLI_idCliente) |
| 3 | Grupos | COUNT DISTINCT(PQM_Grupo) |
| 4 | Marcas | COUNT DISTINCT(PQM_Marca) |

### Graficos (3)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Base Instalada por Grupo | Pie | GROUP BY PQM_Grupo → SUM(qtd), top 10 |
| 2 | Base Instalada por Marca | HBar | GROUP BY PQM_Marca → SUM(qtd), top 10 |
| 3 | Top Modelos no Parque | HBar | GROUP BY PQM_Modelo → SUM(qtd), top 10 |

---

## Tab: Administrativo (AdminSection)

**Hook:** `useAdminData` → `fetchCarteira`, `fetchOrgCounts` (adminBIService)

### Fonte de dados

- **Mirror:** `mirror.crm_carteira_clientes`
- **Legado:** `VW_Ceres_CRM_CarteiraClientes`
- **Colunas:** CLI_idCliente, CLI_TipoCliente, CLI_Prospect, CLI_UF, CLI_Cidade, USR_NomeUsuario
- **Empresas:** `VW_Ceres_Empresas` (count only, legado)
- **Usuarios:** `VW_Ceres_Usuario` (count only)
- **Dedup:** por CLI_idCliente
- **Prospect:** CLI_Prospect match /sim|s|prospect|true|1/

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Clientes na Carteira | COUNT(dedup rows) |
| 2 | Clientes Ativos | COUNT WHERE NOT isProspect |
| 3 | Prospects | COUNT WHERE isProspect |
| 4 | UFs Cobertas | COUNT DISTINCT(CLI_UF) |
| 5 | Consultores | COUNT DISTINCT(USR_NomeUsuario) |
| 6 | Empresas/Filiais | COUNT de VW_Ceres_Empresas |

### Graficos (4)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Prospects vs Clientes Ativos | Pie | ativos vs prospects |
| 2 | Cobertura Geografica | Brazil Heatmap | GROUP BY CLI_UF → COUNT, top 10 |
| 3 | Carteira por Consultor | HBar | GROUP BY USR_NomeUsuario → COUNT, top 10 |
| 4 | Classificacao de Clientes | HBar | GROUP BY CLI_TipoCliente → COUNT (exclui "Sem classificacao" e vazio) |

---

## Tab: Acoes Comerciais (AcoesSection)

**Hook:** `useAcoesBI` → `useComercialData` → `fetchRegistrosComerciais` (registrosService)

### Fonte de dados

- **Mirror:** `mirror.crm_acoes`
- **Legado:** `VW_Ceres_CRM_Acoes`
- **Colunas mirror:** emp_cidade, cli_nome, aco_tipo_contato, aco_tipo_acao, aco_vendedor, aco_atividade_executada, aco_lat, aco_lon, aco_dth_conclusao
- **Colunas legado:** EMP_Cidade, CLI_Nome, ACO_TipoContato, ACO_TipoAcao, ACO_Vendedor, ACO_AtividadeExecutada, ACO_Lat, ACO_Lon, ACO_DthConclusao
- **Filtros dinamicos na UI:** ano, mes, vendedor, tipoAcao, cidade

### KPIs (6 cards)

| # | KPI | Agregacao |
|---|-----|-----------|
| 1 | Total de Acoes | COUNT(registros filtrados) |
| 2 | Cidades Atendidas | COUNT DISTINCT(cidade) |
| 3 | Consultores Ativos | COUNT DISTINCT(vendedor) |
| 4 | Total de Visitas | COUNT WHERE tipoContato contem "visita" |
| 5 | Clientes Unicos | COUNT DISTINCT(cliente) |
| 6 | Tipos de Acao | COUNT DISTINCT(tipoAcao) |

### Graficos (6)

| # | Grafico | Tipo | Agregacao |
|---|---------|------|-----------|
| 1 | Acoes por Consultor | HBar | GROUP BY vendedor → COUNT, top 15 |
| 2 | Evolucao Mensal de Acoes | VBar | GROUP BY yearMonth(dtConclusao) → COUNT |
| 3 | Acoes por Cidade | HBar | GROUP BY cidade → COUNT, top 15 |
| 4 | Distribuicao por Tipo de Acao | Pie | GROUP BY tipoAcao → COUNT |
| 5 | Acoes por Dia da Semana | VBar | dayOfWeek(dtConclusao) → COUNT |
| 6 | Tipo de Contato | Pie | GROUP BY tipoContato → COUNT |
