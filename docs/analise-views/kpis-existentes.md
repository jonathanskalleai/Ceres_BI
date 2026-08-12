# Inventário de KPIs já implementados

Levantamento dos KPIs ativos hoje, agrupados por hook.

## `usePainelKPIs` (BiPainel)
- Total Negócios, Ganhos, Perdidos, Em Andamento
- Taxa de Conversão
- Valor Ganho, Valor Perdido, Pipeline Aberto, Ticket Médio
- Total Ações, Total Visitas
- Por tipo de ação (dinâmico)

## `usePedidosKPIs`
- Faturamento, Total Pedidos
- Taxa de Aprovação
- Mix Financiamento

## `useClientesKPIs`
- Clientes Ativos, Prospects
- Parque de Máquinas (count)
- Cobertura Comercial (% clientes com ação)

## `useServicosKPIs`
- OS Abertas, OS Fechadas
- Tempo Médio de Resolução (dias)

## `useCrossKPIs`
- Ciclo Médio de Vendas (dias)
- Esforço Médio (ações por ganho)
- Receita por Consultor
- Conversão Pedido (% ganhos com pedido emitido)

## Dashboards CRM
- Overview, Consultores (ranking), Regiões, Clientes Críticos, Insights NLP, Mapa, Registros, Administrativo, Negócios Mensais.

## Views consumidas hoje (5 de 29)

✅ VW_Ceres_CRM_Acoes  
✅ VW_Ceres_CRM_Negocios (parcial — ~14 de 92 colunas)  
✅ VW_Ceres_CRM_Pedidos (parcial)  
✅ VW_Ceres_OrdemServico (básico)  
✅ VW_Ceres_Usuario (lookup)

## Views NÃO consumidas (24 de 29) — oportunidade

❌ Empresas, UsuarioXEmpresa  
❌ CarteiraClientes (cidade real do cliente, prospect flag)  
❌ ClienteContatos, ClienteParqueMaquinas, ClientePropriedade  
❌ **Negocios_Etapas** (histórico do funil)  
❌ **FunilEtapa** (config + SLA por etapa)  
❌ **PedidosItem** (mix de produto)  
❌ PedidosUsado, EstoqueVirtual  
❌ **TAGXACAO/CLIENTE/NEGOCIO/PEDIDO** (4 views)  
❌ **Produtos / ProdutosGrupo / ProdutosMarca / ProdutosModelo** (4 views)  
❌ Agenda  
❌ **AtendimentoOS, Ocorrencias, AtividadeExtra, TecnicoTempo** (4 views de pós-venda)

## Colunas subutilizadas em `Negocios` (calculadas pelo CRM, ignoradas hoje)

| Coluna | Tipo | Uso atual | Oportunidade |
|---|---|---|---|
| `NGO_CicloVendas` | int | recalculamos no front | usar direto, mais barato |
| `NGO_QtdAcoes` | int | recalculamos no front | usar direto |
| `NGO_Probabilidade` | int | ignorado | **pipeline ponderado** |
| `NGO_DataPrimeiroContato` | datetime | ignorado | lead-to-cash real |
| `NGO_DataFechamento` | datetime | parcial | tempo de fechamento |
| `NGO_Campanha` | string | ignorado | atribuição de marketing |
| `NGO_FormaEntrada` | string | ignorado | mix por canal |
| `NGO_MotivoPerda` + detalhe | string | ignorado | **análise de derrota** |
| `NGO_MotivoGanho` + detalhe | string | ignorado | **análise de vitória** |
| `MPP_ProdutoVlrConcorrencia` | int | ignorado | **competitive intel** |
| `MPP_ProdutoPerdaMarca` | string | ignorado | concorrente que vence |
| `PRD_*` (Marca/Grupo/Modelo) | string | ignorado | mix sem join |
| `USA_Valor` | int | parcial | troca/usado dado |
| `ORC_Valor/Banco` | int/string | ignorado | banco preferido |
| `NGO_Prioridade` | int | ignorado | filtro de urgência |
