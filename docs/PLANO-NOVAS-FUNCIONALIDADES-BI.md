# Plano — Novas Funcionalidades BI

> Criado: 2026-08-18  
> Status: **Aguardando aprovação do Jonathan**  
> Contexto: O cliente (Andre/Controladoria) tem acesso a apenas 3 módulos: `bi.acoes`, `crm.consultores`, `crm.registros`

---

## Diretrizes do Jonathan

- As dashboards atuais estão **poluídas**, muita coisa falando a mesma coisa — precisa de um "pedumidão" (limpeza/consolidação)
- Aproveitar o que já existe nas dashboards não-liberadas (Pedidos, Pipeline)
- A lógica de **GANHO** e **PERDIDO** precisa ser respeitada:
  - **GANHO** = pedido aprovado (`mirror.crm_pedidos`, `pdo_situacaopedido='Aprovado'`, data=`pdo_dthaprovacao`, valor=`pdo_vlrpedido`)
  - **PERDIDO** = negócio perdido (`mirror.crm_negocios`, `ngo_conclusao='Perdido'`, data=`ngo_datafechamento`, valor=`ngo_vlrtotalnegociado`)
  - Excluir funil **REPASSE DE MAQUINA** em ambos
- Essa lógica já está correta na BI de Ações (`rpc_acoes_funil_gestao_periodo`)
- A RPC `rpc_evolucao_negocios_12m` existente está **INCORRETA** (pega ganho do valor do negócio, não do pedido)

---

## Funcionalidades Solicitadas

### 1. Evolução Mensal (Ganhos × Perdidos × Valor) — 12 meses rolling

- **Onde:** `bi.painel` (Visão Geral) — aba "Gráficos"
- **O que faz:** Gráfico barras/linhas por mês: qtd ganhos + valor ganho, qtd perdidos + valor perdido
- **Fonte:** Ganhos de `crm_pedidos` (aprovado), Perdidos de `crm_negocios` (perdido), excluir REPASSE
- **RPC:** Nova `rpc_evolucao_ganhos_perdidos_12m` (substituir a incorreta)
- **Filtros:** Vendedor (opcional)

### 2. Clientes Críticos (sem contato há muito tempo)

- **Onde:** `crm.criticos` (já existe) ou embutir em `bi.acoes`
- **O que faz:** Lista clientes ordenados pela data mais antiga de última ação
- **RPC:** `rpc_clientes_criticos` (já funciona)
- **Decisão pendente:** Liberar `crm.criticos` pro cliente OU embutir em `bi.acoes`?

### 3. Produtos com Maior Interesse (IA)

- **Onde:** `bi.acoes` (nova seção/card)
- **O que faz:** Extrai menções a produtos/máquinas das descrições de ações (`aco_atividadeexecutada`) e observações de negócios (`ngo_obsnegocio`)
- **Lógica:** RPC coleta descrições do período → AI service analisa → retorna ranking de produtos mencionados
- **Filtros:** Período, consultor, cidade
- **Requer:** AI service (já protegido com JWT)

### 4. Análise de Sentimento (IA)

- **Onde:** `bi.acoes` (nova seção/card)
- **O que faz:** Classifica tom/sentimento nas descrições de ações
- **Granularidade:** Por consultor e por cidade
- **Lógica:** Mesmo input (descrições) → AI classifica positivo/neutro/negativo → agrega
- **Visualização:** Heatmap ou barras empilhadas
- **Filtros:** Período, consultor, cidade
- **Requer:** AI service

### 5. Conversão Anual por Consultor

- **Onde:** `bi.acoes` ou `crm.consultores`
- **O que faz:** Para cada consultor no ano (12 meses rolling):
  - Oportunidades geradas (primeira entrada no funil VENDAS)
  - Ganhos (pedidos aprovados)
  - Perdidos (negócios perdidos)
  - Taxa de conversão
- **Mesma lógica de ganhos/perdidos:** pedidos × negócios, excluir REPASSE
- **Visualização:** Tabela comparativa ou funil visual
- **Decisão pendente:** Fica em `bi.acoes` ou na detalhe de `crm.consultores`?

### 6. Itens aproveitados da Dashboard de Pedidos

- **O que aproveitar:**
  - Mix de pagamento / financiamento próprio
  - Evolução mensal de faturamento
  - Cidades de entrega
  - Mais vendidos
- **Decisão pendente:** Liberar `bi.pedidos` pro cliente OU puxar cards para `bi.painel`?

---

## Decisões Pendentes

| # | Pergunta | Opções |
|---|----------|--------|
| 1 | Clientes Críticos | Liberar `crm.criticos` OU embutir em `bi.acoes`? |
| 2 | Conversão Anual | Em `bi.acoes` (tudo junto) OU em `crm.consultores` (detalhe)? |
| 3 | Pedidos | Liberar `bi.pedidos` OU puxar cards para `bi.painel`? |
| 4 | Ordem de implementação | Qual primeiro? |

---

## Mapeamento de Dados (referência)

| Tabela | Campos-chave | Registros |
|--------|-------------|-----------|
| `mirror.crm_acoes` | cli_nome, emp_cidade, aco_vendedor, aco_dthconclusao, aco_tipocontato, aco_atividadeexecutada, ngo_nronegocio | ~41k (28k com descrição) |
| `mirror.crm_negocios` | ngo_numero, ngo_vendedores, ngo_conclusao, ngo_funil, ngo_vlrtotalnegociado, ngo_datafechamento, ngo_datacadastro | 92 colunas |
| `mirror.crm_pedidos` | pdo_dthaprovacao, pdo_vlrpedido, pdo_situacaopedido, pdo_vendedor, ngo_numero | - |
| `mirror.crm_pedidos_item` | pdo_itemdescricao, pdo_itemmarca, pdo_itemgrupo, pdo_itemmodelo | - |
| `mirror.usuarios` | usr_codusuario (join com ngo_vendedores), usr_nomeusuario | - |

---

## RPCs Existentes Relevantes

| RPC | Status | Nota |
|-----|--------|------|
| `rpc_clientes_criticos` | ✅ Funcional | Já em uso no frontend |
| `rpc_evolucao_negocios_12m` | ❌ Lógica incorreta | Pega ganho do valor do negócio, deveria vir de pedidos |
| `rpc_acoes_funil_gestao_periodo` | ✅ Lógica correta | Referência para ganhos/perdidos |
| `rpc_consultores_resumo_acoes` | ✅ Funcional | Resumo por período |
| `rpc_produtos_bi` | ⚠️ Diferente | Parque de máquinas, não menções em ações |

---

## Infraestrutura Pronta

- AI service com JWT auth ✅ (commit ef6227a)
- Frontend já passa token nas chamadas ao AI ✅
- Lógica de ganhos/perdidos documentada e implementada na BI de ações ✅
