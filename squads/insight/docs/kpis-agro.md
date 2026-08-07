# KPIs Ceres Agro — Data Dictionary

> Gerado por: @bi-strategist (Nora)
> Data: 2026-06-22
> Squad: Insight

---

## Visão Geral

| Área | KPIs | Prioridade |
|------|------|------------|
| Máquinas | 3 | Alta |
| Peças | 3 | Alta |
| Visitas | 3 | Alta |
| Ações | 3 | Média |
| Cross | 5 | Alta |

---

## 1. Máquinas

### 1.1 Receita Máquinas

| Campo | Valor |
|-------|-------|
| **Nome** | Receita Máquinas |
| **Categoria** | Máquinas |
| **Definição** | Soma do valor de negócios ganhos do tipo máquina |
| **Fórmula SQL** | `SUM(n.valor) WHERE n.tipo = 'maquina' AND n.conclusao = 'ganho'` |
| **Fonte** | `negocios.valor`, `negocios.tipo`, `negocios.conclusao` |
| **Formato** | `currency_BRL` (R$ 1.234.567) |
| **Tendência** | ✅ Sim (vs período anterior) |
| **Threshold Verde** | > R$ 500.000 |
| **Threshold Amarelo** | R$ 200.000 - R$ 500.000 |
| **Threshold Vermelho** | < R$ 200.000 |
| **Stakeholder** | Gerente Comercial |

---

### 1.2 Margem Média

| Campo | Valor |
|-------|-------|
| **Nome** | Margem Média |
| **Categoria** | Máquinas |
| **Definição** | (Receita - Custo) / Receita, média ponderada |
| **Fórmula SQL** | `AVG((valor - custo) / valor) WHERE tipo = 'maquina'` |
| **Fonte** | `negocios.valor`, `negocios.custo` |
| **Formato** | `percentage` (ex: 23,5%) |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > 25% |
| **Threshold Amarelo** | 15% - 25% |
| **Threshold Vermelho** | < 15% |
| **Stakeholder** | Diretor Financeiro |

---

### 1.3 Ticket Médio Máquinas

| Campo | Valor |
|-------|-------|
| **Nome** | Ticket Médio Máquinas |
| **Categoria** | Máquinas |
| **Definição** | Receita média por venda de máquina |
| **Fórmula SQL** | `SUM(valor) / COUNT(DISTINCT numero) WHERE tipo = 'maquina'` |
| **Fonte** | `negocios.valor`, `negocios.numero` |
| **Formato** | `currency_BRL` (R$ 85.000) |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > R$ 100.000 |
| **Threshold Amarelo** | R$ 50.000 - R$ 100.000 |
| **Threshold Vermelho** | < R$ 50.000 |
| **Stakeholder** | Gerente Comercial |

---

## 2. Peças

### 2.1 Receita Peças

| Campo | Valor |
|-------|-------|
| **Nome** | Receita Peças |
| **Categoria** | Peças |
| **Definição** | Soma do valor de negócios ganhos do tipo peça |
| **Fórmula SQL** | `SUM(n.valor) WHERE n.tipo = 'peca' AND n.conclusao = 'ganho'` |
| **Fonte** | `negocios.valor`, `negocios.tipo`, `negocios.conclusao` |
| **Formato** | `currency_BRL` |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > R$ 100.000 |
| **Threshold Amarelo** | R$ 50.000 - R$ 100.000 |
| **Threshold Vermelho** | < R$ 50.000 |
| **Stakeholder** | Gerente Peças |

---

### 2.2 Giro de Estoque

| Campo | Valor |
|-------|-------|
| **Nome** | Giro de Estoque |
| **Categoria** | Peças |
| **Definição** | Quantas vezes o estoque foi renovado no período |
| **Fórmula SQL** | `SUM(qtd_vendida) / AVG(estoque_médio)` |
| **Fonte** | `estoque.qtd_vendida`, `estoque.qtd_atual` |
| **Formato** | `decimal_1` (ex: 4,2x) |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > 4x |
| **Threshold Amarelo** | 2x - 4x |
| **Threshold Vermelho** | < 2x |
| **Stakeholder** | Gerente Estoque |

---

### 2.3 Peças Críticas

| Campo | Valor |
|-------|-------|
| **Nome** | Peças Críticas |
| **Categoria** | Peças |
| **Definição** | Quantidade de peças com estoque abaixo do ponto de reposição |
| **Fórmula SQL** | `COUNT(*) WHERE qtd_atual < ponto_reposicao` |
| **Fonte** | `estoque.qtd_atual`, `estoque.ponto_reposicao` |
| **Formato** | `integer` |
| **Tendência** | ❌ Não (é um status) |
| **Threshold Verde** | 0-5 |
| **Threshold Amarelo** | 6-15 |
| **Threshold Vermelho** | > 15 |
| **Stakeholder** | Gerente Estoque |

---

## 3. Visitas

### 3.1 Total Visitas

| Campo | Valor |
|-------|-------|
| **Nome** | Total Visitas |
| **Categoria** | Visitas |
| **Definição** | Quantidade de visitas técnicas/comerciais registradas |
| **Fórmula SQL** | `COUNT(*) WHERE tipo IN ('tecnica', 'comercial')` |
| **Fonte** | `visitas.id` |
| **Formato** | `integer` |
| **Tendência** | ✅ Sim |
| **Threshold** | N/A (contexto-dependente) |
| **Stakeholder** | Gerente Comercial |

---

### 3.2 Taxa Conversão Visitas

| Campo | Valor |
|-------|-------|
| **Nome** | Taxa Conversão Visitas |
| **Categoria** | Visitas |
| **Definição** | Percentual de visitas que resultaram em negócio |
| **Fórmula SQL** | `COUNT(visitas_com_negocio) / COUNT(visitas) * 100` |
| **Fonte** | `visitas.id`, `negocios.visita_id` |
| **Formato** | `percentage` |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > 50% |
| **Threshold Amarelo** | 30% - 50% |
| **Threshold Vermelho** | < 30% |
| **Stakeholder** | Gerente Comercial |
| **Nota** | Negócio contado se criado até 30 dias após visita |

---

### 3.3 Visitantes Únicos

| Campo | Valor |
|-------|-------|
| **Nome** | Visitantes Únicos |
| **Categoria** | Visitas |
| **Definição** | Quantidade de clientes únicos visitados |
| **Fórmula SQL** | `COUNT(DISTINCT cliente_id)` |
| **Fonte** | `visitas.cliente_id` |
| **Formato** | `integer` |
| **Tendência** | ✅ Sim |
| **Threshold** | N/A |
| **Stakeholder** | Gerente Comercial |

---

## 4. Ações

### 4.1 Ações Realizadas

| Campo | Valor |
|-------|-------|
| **Nome** | Ações Realizadas |
| **Categoria** | Ações |
| **Definição** | Quantidade de ações comerciais executadas |
| **Fórmula SQL** | `COUNT(*) WHERE status = 'realizada'` |
| **Fonte** | `acoes.id`, `acoes.status` |
| **Formato** | `integer` |
| **Tendência** | ✅ Sim |
| **Threshold** | N/A |
| **Stakeholder** | Gerente Comercial |

---

### 4.2 ROI Ações

| Campo | Valor |
|-------|-------|
| **Nome** | ROI Ações |
| **Categoria** | Ações |
| **Definição** | Retorno sobre investimento das ações comerciais |
| **Fórmula SQL** | `(SUM(receita_atribuida) - SUM(custo)) / SUM(custo) * 100` |
| **Fonte** | `acoes.receita_atribuida`, `acoes.custo` |
| **Formato** | `percentage` |
| **Tendência** | ✅ Sim |
| **Threshold Verde** | > 200% |
| **Threshold Amarelo** | 100% - 200% |
| **Threshold Vermelho** | < 100% |
| **Stakeholder** | Diretor Comercial |

---

### 4.3 Ações por Vendedor

| Campo | Valor |
|-------|-------|
| **Nome** | Ações por Vendedor |
| **Categoria** | Ações |
| **Definição** | Média de ações por vendedor no período |
| **Fórmula SQL** | `COUNT(*) / COUNT(DISTINCT vendedor_id)` |
| **Fonte** | `acoes.id`, `acoes.vendedor_id` |
| **Formato** | `decimal_1` (ex: 4,3) |
| **Tendência** | ✅ Sim |
| **Threshold** | N/A (benchmark interno) |
| **Stakeholder** | Gerente Comercial |

---

## 5. KPIs Cross (Comparativos)

### 5.1 Receita Total

| Campo | Valor |
|-------|-------|
| **Nome** | Receita Total |
| **Categoria** | Cross |
| **Definição** | Soma de todas as receitas |
| **Fórmula** | `Receita Máquinas + Receita Peças` |
| **Formato** | `currency_BRL` |
| **Relacionado** | 1.1, 2.1 |

---

### 5.2 Mix Receita (%)

| Campo | Valor |
|-------|-------|
| **Nome** | Mix de Receita |
| **Categoria** | Cross |
| **Definição** | Distribuição % entre Máquinas e Peças |
| **Fórmula** | `Receita Máquina / Receita Total * 100` |
| **Formato** | `percentage` |
| **Nota** | Mostrar como DonutChart |

---

## Histórico de Versões

| Versão | Data | Alteração |
|---------|------|-----------|
| 0.1.0 | 2026-06-22 | Criação inicial |
