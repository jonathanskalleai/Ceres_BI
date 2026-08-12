# Ceres BI — Documentação de Mapeamento de Dados

## Arquitetura de Dados

```
SQL Server (wfrsistemas.net.br:1433 / CamposDealer_BI)
    │
    ▼
Edge Function: query-sqlserver (VPS Supabase - ceressupabasebi.vouxconsultoria.com.br)
    │
    ▼
Frontend Services (React Query, cache 60s, paginação 3000/batch)
    │
    ├── registrosService.ts  → VW_Ceres_CRM_Acoes
    └── negociosService.ts   → VW_Ceres_CRM_Negocios + Pedidos + Usuario
    │
    ▼
Dashboard (10 páginas)
```

## Views SQL Server Utilizadas

| # | View | Registros | Usado por |
|---|------|-----------|-----------|
| 1 | **VW_Ceres_CRM_Acoes** | 28.176 | 9 de 10 páginas |
| 2 | **VW_Ceres_CRM_Negocios** | 4.589 | Negócios Mensais |
| 3 | **VW_Ceres_CRM_Pedidos** | 2.011 | Negócios Mensais |
| 4 | **VW_Ceres_Usuario** | 100 | Negócios Mensais (resolve nomes) |

## Views Disponíveis (não utilizadas ainda)

- `VW_Ceres_Empresas` (4 registros) — dados das filiais
- `VW_Ceres_UsuarioXEmpresa` — vínculo usuário × empresa
- `VW_Ceres_CRM_CarteiraClientes` (14.785) — carteira completa com cidade do cliente
- `VW_Ceres_CRM_ClienteContatos` — contatos dos clientes
- `VW_Ceres_CRM_ClienteParqueMaquinas` — parque de máquinas
- `VW_Ceres_CRM_ClientePropriedade` — propriedades dos clientes
- `VW_Ceres_CRM_Negocios_Etapas` — histórico de etapas dos negócios
- `VW_Ceres_CRM_FunilEtapa` — configuração do funil
- `VW_Ceres_CRM_PedidosItem` — itens dos pedidos
- `VW_Ceres_CRM_PedidosUsado` — pedidos de usados
- `VW_Ceres_CRM_EstoqueVirtual` — estoque virtual
- `VW_Ceres_CRM_TAGXACAO` — tags × ações
- `VW_Ceres_CRM_TAGXCLIENTE` — tags × clientes
- `VW_Ceres_CRM_TAGXNEGOCIO` — tags × negócios
- `VW_Ceres_CRM_TAGXPEDIDO` — tags × pedidos
- `VW_Ceres_Produtos` — catálogo de produtos
- `VW_Ceres_ProdutosGrupo` — grupos de produtos
- `VW_Ceres_ProdutosMarca` — marcas
- `VW_Ceres_ProdutosModelo` — modelos
- `VW_Ceres_Agenda` — agenda
- `VW_Ceres_OrdemServico` — ordens de serviço (pós-venda)
- `VW_Ceres_Ocorrencias` — ocorrências
- `VW_Ceres_AtendimentoOS` — atendimentos de OS
- `VW_Ceres_AtividadeExtra` — atividades extras
- `VW_Ceres_TecnicoTempo` — tempo dos técnicos

---

## Mapeamento por Menu do Dashboard

### 1. Overview

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** KPIs (total registros, clientes, consultores, pipeline, visitas, cidades), evolução mensal, top 10 consultores, distribuição por tipo de contato
- **Colunas usadas:** Todas as 9

### 2. Consultores

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Ranking de vendedores por pipeline, ações, visitas, clientes, negócios, conversão, qualidade CRM (A/B/C/D baseado em preenchimento de obs)
- **Colunas-chave:** `ACO_Vendedor`, `CLI_Nome`, `ACO_TipoContato`, `ACO_AtividadeExecutada`

### 3. Detalhe do Consultor

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data.vendedores[x]`
- **Mostra:** Evolução mensal individual, top 10 clientes, regiões, tipos de ação, últimas 5 ações por cliente
- **Colunas usadas:** Todas as 9

### 4. Regiões

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Ranking de cidades por pipeline, ações, clientes, visitas
- **Colunas-chave:** `EMP_Cidade`, `CLI_Nome`, `ACO_TipoContato`, `ACO_Lat`, `ACO_Lon`

### 5. Registros

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Tabela completa com busca (cliente, cidade, vendedor, tipo contato, tipo ação, data, obs)
- **Colunas usadas:** Todas as 9

### 6. Clientes Críticos

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Clientes com muitos dias sem contato, sugestões de ação automáticas
- **Colunas-chave:** `CLI_Nome`, `ACO_DthConclusao`, `ACO_Vendedor`, `EMP_Cidade`

### 7. Insights (NLP)

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Análise de palavras-chave nas observações (positivas, negativas, produtos mencionados), sentimento
- **Coluna-chave:** `ACO_AtividadeExecutada` (obs)

### 8. Mapa

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `data`
- **Mostra:** Mapa Leaflet com marcadores por região, cor por nível de atividade
- **Colunas-chave:** `ACO_Lat`, `ACO_Lon`, `EMP_Cidade`

### 9. Negócios Mensais

- **Views:** `VW_Ceres_CRM_Negocios` + `VW_Ceres_CRM_Pedidos` + `VW_Ceres_Usuario`
- **Hook:** `useNegociosData`
- **Mostra:** KPIs (total negócios, valor, ticket médio, ganhos/perdidos/andamento, recebido, usado), evolução mensal, por consultor, por região, por tipo
- **Join:** Pedidos ligados a Negócios via `NGO_Numero`; Nome do vendedor via `NGO_Vendedores` → `USR_CodUsuario`/`USR_idUsuario`
- **Colunas usadas:** 14 de Negocios + 7 de Pedidos + 3 de Usuario

### 10. Administrativo

- **View:** `VW_Ceres_CRM_Acoes`
- **Hook:** `useComercialData` → `allData` (inclui admins)
- **Mostra:** Mesmo que Consultores, mas filtrado para usuários admin
- **Colunas-chave:** `ACO_Vendedor`, `CLI_Nome`, `ACO_TipoContato`, `ACO_TipoAcao`

---

## Mapeamento de Colunas Detalhado

### VW_Ceres_CRM_Acoes → Tipo `Registro`

| Coluna SQL | Campo Frontend | Uso no Dashboard |
|---|---|---|
| `EMP_Cidade` | `cidade` | Agrupamento por região, filtros |
| `CLI_Nome` | `cliente` | Identificação do cliente |
| `ACO_TipoContato` | `tipoContato` | Detecção de visita, gráficos de distribuição |
| `ACO_TipoAcao` | `tipoAcao` | Filtros, gráficos de tipo de ação |
| `ACO_Vendedor` | `vendedor` | Agrupamento por consultor |
| `ACO_AtividadeExecutada` | `obs` | Score CRM (A/B/C/D), análise NLP/insights |
| `ACO_Lat` | `lat` | Marcadores no mapa |
| `ACO_Lon` | `lng` | Marcadores no mapa |
| `ACO_DthConclusao` | `dtConclusao` | Filtros de período, cálculo de dias sem contato |

### VW_Ceres_CRM_Negocios + Pedidos → Tipo `NegocioRow`

| Coluna SQL | Campo Frontend | Uso no Dashboard |
|---|---|---|
| `EMP_Cidade` + `EMP_UF` | `unidade` | Região (formato "Cidade/UF") |
| `CLI_Nome` | `cliente` | Nome do cliente |
| `NGO_Vendedores` → `USR_nomeUsuario` | `consultor` | Nome do vendedor (resolvido via VW_Ceres_Usuario) |
| `PDO_VlrPedido` ou `NGO_VlrTotalNegociado` | `valor_pedido` | Valor do negócio (pedido tem prioridade) |
| `PDO_SituacaoPedido` | `pdo_situacao_pedido` | Status do pedido |
| `NGO_Etapa` | `ngo_etapa` | Etapa do funil de vendas |
| `NGO_Conclusao` | `ngo_conclusao` | Ganho / Perdido / Em andamento |
| `NGO_MotivoGanho` | `ngo_motivo_ganho` | Motivo do ganho |
| `NGO_DataCadastro` | `pdo_dth_abertura` | Data para evolução mensal |
| `PDO_CidadeUFEntrega` ou `CLI_Cidade` | `pdo_cidade_entrega` | Cidade de entrega |
| `PDO_ObsPedido` ou `NGO_ObsNegocio` | `pdo_obs_pedido` | Observações |
| `PRD_CondicaoProduto` | `tipo` | Novo / Usado |
| `PDO_VlrRecursoProprio` | `recebido` | Valor recebido (recurso próprio) |
| `USA_Valor` | `usado` | Valor do equipamento usado |

---

## Observações e Limitações Conhecidas

1. **`EMP_Cidade` ≠ cidade do cliente** — é a cidade da filial/empresa. Para cidade real do cliente, cruzar com `VW_Ceres_CRM_CarteiraClientes.CLI_Cidade` via `CLI_IdCliente`.

2. **`negocioValor` está zerado nas ações** — a view `VW_Ceres_CRM_Acoes` não tem valor de negócio. O pipeline real vem de `VW_Ceres_CRM_Negocios.NGO_VlrTotalNegociado`.

3. **`NGO_Vendedores` é código numérico** — não é o nome do vendedor. É resolvido via lookup em `VW_Ceres_Usuario` (campo `USR_CodUsuario` ou `USR_idUsuario`).

4. **Paginação:** Cada request retorna no máximo 3000 registros (limite do edge runtime). O frontend faz batches de 3 requests paralelas.

5. **Tempo de carregamento:** ~20-25s para carregar todos os 28k registros de Ações. Pode ser otimizado com filtro de data ou sync incremental para Postgres.

---

## Configuração da Infraestrutura

- **VPS:** 178.238.235.203
- **Supabase URL:** https://ceressupabasebi.vouxconsultoria.com.br
- **SQL Server:** wfrsistemas.net.br:1433
- **Database:** CamposDealer_BI
- **Edge Function:** `/root/supabase/docker/volumes/functions/query-sqlserver/index.ts`
- **Driver:** `tedious@19` (TDS puro, leve para edge runtime)

---

## Próximos Passos Sugeridos

1. **Validar dados** — comparar valores do dashboard com relatórios do sistema original
2. **Filtro de data padrão** — carregar apenas últimos 3 meses por padrão (reduz load de 28k → ~7k)
3. **Cidade do cliente** — integrar `VW_Ceres_CRM_CarteiraClientes` para ter a cidade real
4. **Sync incremental** — job periódico SQL Server → Postgres para eliminar latência
5. **Novas features** — usar views não consumidas (Agenda, OS, Funil, Produtos)
