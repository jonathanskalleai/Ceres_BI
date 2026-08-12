# Inventário de Colunas — 29 Views SQL Server

Coleta automatizada via `scripts/sample-views.ts` (10 amostras por view + `count_only`). Sample bruto: `docs/analise-views/raw/<view>.json`.

## Visão geral (volume × colunas)

| # | View | Total | Cols | Categoria |
|--|--|--:|--:|--|
| 1 | VW_Ceres_Empresas | 4 | 12 | Dimensão |
| 2 | VW_Ceres_Usuario | 100 | 16 | Dimensão |
| 3 | VW_Ceres_UsuarioXEmpresa | 269 | 7 | Vínculo |
| 4 | VW_Ceres_CRM_Acoes | **28 999** | 32 | Fato |
| 5 | VW_Ceres_CRM_CarteiraClientes | **15 020** | 27 | Dimensão grande |
| 6 | VW_Ceres_CRM_ClienteContatos | 8 518 | 18 | Atributo |
| 7 | VW_Ceres_CRM_ClienteParqueMaquinas | 1 526 | 23 | Atributo |
| 8 | VW_Ceres_CRM_ClientePropriedade | 341 | 31 | Atributo |
| 9 | VW_Ceres_CRM_Negocios | 4 752 | 92 | Fato (largo) |
| 10 | VW_Ceres_CRM_Negocios_Etapas | **13 966** | 14 | Fato histórico |
| 11 | VW_Ceres_CRM_FunilEtapa | 62 | 14 | Dimensão |
| 12 | VW_Ceres_CRM_Pedidos | 2 086 | 39 | Fato |
| 13 | VW_Ceres_CRM_PedidosItem | 2 703 | 14 | Fato detalhe |
| 14 | VW_Ceres_CRM_PedidosUsado | 16 | 10 | Fato pequeno |
| 15 | VW_Ceres_CRM_EstoqueVirtual | 1 | 18 | (vazio/quase) |
| 16 | VW_Ceres_CRM_TAGXACAO | 6 712 | 6 | Tag |
| 17 | VW_Ceres_CRM_TAGXCLIENTE | 1 095 | 7 | Tag |
| 18 | VW_Ceres_CRM_TAGXNEGOCIO | 1 415 | 7 | Tag |
| 19 | VW_Ceres_CRM_TAGXPEDIDO | 577 | 7 | Tag |
| 20 | VW_Ceres_Produtos | 241 | 15 | Dimensão |
| 21 | VW_Ceres_ProdutosGrupo | 132 | 6 | Dimensão |
| 22 | VW_Ceres_ProdutosMarca | 37 | 6 | Dimensão |
| 23 | VW_Ceres_ProdutosModelo | 25 | 8 | Dimensão |
| 24 | VW_Ceres_Agenda | 152 | 22 | Fato |
| 25 | VW_Ceres_OrdemServico | 147 | 31 | Fato |
| 26 | VW_Ceres_Ocorrencias | 1 027 | 22 | Fato |
| 27 | VW_Ceres_AtendimentoOS | 152 | 30 | Fato |
| 28 | VW_Ceres_AtividadeExtra | 52 | 24 | Fato |
| 29 | VW_Ceres_TecnicoTempo | **8 791** | 18 | Fato |

## Descobertas importantes do sample

### `VW_Ceres_CRM_Negocios` (92 colunas — visão mais rica)
Já temos 4 752 negócios, mas estamos usando **apenas ~14 colunas** das 92. Achados:

- **`NGO_QtdAcoes`** (int) — número de ações por negócio **JÁ VEM CALCULADO** na view. Hoje recalculamos no front.
- **`NGO_CicloVendas`** (int) — dias até fechar **JÁ VEM CALCULADO**. Hoje recalculamos.
- **`NGO_Probabilidade`** (int) — % probabilidade do negócio.
- **`NGO_DataPrimeiroContato`** / **`NGO_DataFechamento`** — lead-to-cash real.
- **`NGO_Campanha`** — atribuição de marketing.
- **`NGO_FormaEntrada`** — fonte do lead (indicação, site, etc.).
- **`NGO_MotivoPerda` + `MPP_DscMotivoPerdaDetalhe` + `MPP_ProdutoVlrConcorrencia`** — análise de derrota (motivo, detalhe, valor do concorrente).
- **`NGO_MotivoGanho` + `NGO_ObsMotivoGanho`** — análise de vitória.
- **`PRD_*` (Marca/Grupo/Modelo/Qtde/VlrUnitario/CondicaoProduto)** — produto associado ao negócio **direto na view**, sem precisar de join.
- **`ORC_Valor/Tipo/Banco`** — orçamento/financiamento.
- **`USA_Maquina/Valor/Estado`** — usado dado em troca.
- **`NGO_Prioridade`** — semáforo de urgência.
- **`NGO_Vendedores`** (int) — código do vendedor (resolve via `Usuario`).

### `VW_Ceres_CRM_Negocios_Etapas` (13 966 linhas)
Histórico completo de transição de etapas:
- `FNE_dthInicioEtapa`, `FNE_dthTerminoEtapa`, **`FNE_DuracaoDias`** já calculada.
- Permite calcular **gargalo do funil** (qual etapa retém mais tempo), **conversão etapa → etapa**, etapa onde mais perde.

### `VW_Ceres_CRM_FunilEtapa` (62)
Configuração do funil com sinalizadores poderosos:
- **`Etapa_DiasEstagnado`** — SLA configurado para cada etapa.
- **`Etapa_PermitePedido`** — sinaliza etapa de fechamento.
- **`Etapa_BloqueioEtapa`**, **`Etapa_ConsideraFunil`**, **`Etapa_Transicao`**.

### `VW_Ceres_CRM_PedidosItem` (2 703)
Cada item de cada pedido — **nunca consumido hoje**. Permite mix de produto, ticket por categoria.

### `VW_Ceres_CRM_ClienteParqueMaquinas` (1 526)
Base instalada por cliente: marca, modelo, ano, horímetro, quantidade. Permite cálculo de **share-of-wallet** e cross-sell (parque de concorrente).

### `VW_Ceres_CRM_ClientePropriedade` (341)
Propriedades rurais por cliente com **medida (hectares)** + **tipo de cultura** + **previsão de colheita** (`CLT_DthPrevisaoColheita`). Permite KPI sazonal por safra.

### `VW_Ceres_TecnicoTempo` (8 791)
Diário de cada técnico:
- `TMP_TempoDisponivel`, `TMP_DuracaoAtendimento`, `TMP_DuracaoDeslocamento`, `TMP_TempoOcioso`, `TMP_TempoExtra`, `TMP_KmRodado`.
- Permite **% utilização do técnico**, **% deslocamento/atendimento**, **km/dia**, ociosidade.

### `VW_Ceres_Ocorrencias` (1 027) + `VW_Ceres_AtendimentoOS` (152)
- Ocorrências = eventos dentro de uma OS (pausas, observações).
- Atendimento = registro técnico (causa, solução, horímetro, primeira/última ocorrência).
- Permite **MTTR** real, **reincidência**, **top causas**.

### `VW_Ceres_CRM_EstoqueVirtual` (1 linha)
Praticamente vazia — não vale priorizar agora.

### Tags (4 views, ~9 800 vínculos)
TAGxACAO/CLIENTE/NEGOCIO/PEDIDO — segmentação livre que hoje é totalmente ignorada.

### `VW_Ceres_Agenda` (152)
Agenda de OS com status e datas previstas — pequena, mas dá métricas de **cumprimento de agenda**.
