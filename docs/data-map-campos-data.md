# Mapa de Campos de Data — Tabelas Mirror

**Data:** 2026-06-25  
**Objetivo:** Validar com o cliente qual campo de data o filtro global do BI deve usar em cada tela.

---

## Pergunta-chave para o cliente

> "Quando o usuário filtra por data no BI, ele quer ver registros que **concluíram** naquele período, ou que foram **criados/abertos** naquele período?"

---

## Tabelas e campos disponíveis

### crm_acoes (Ações CRM)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `aco_dthabertura` | Data de abertura da ação | — |
| `aco_dthconclusao` | **Data de conclusão** da ação | ✅ `rpc_negocios_crm` (taxaConversão) |
| `aco_dthagendainicio` | Início do agendamento | — |
| `aco_dthagendatermino` | Término do agendamento | — |
| `aco_dthatualizacao` | Última atualização | — |
| `aco_dthgeolocalizacao` | Data da geolocalização | — |

### crm_negocios (Negócios CRM)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `ngo_datacadastro` | Data de cadastro do negócio | ✅ `rpc_negocios_crm` (filtro principal) |
| `ngo_datafechamento` | **Data de conclusão/fechamento** | ✅ `rpc_negocios_bi` (filtro principal) |
| `ngo_dataatualizacao` | Última atualização | — |
| `ngo_dataprevisao` | Previsão de fechamento | — |
| `ngo_dataprimeirocontato` | Primeiro contato | — |
| `aco_dataagendaultimaacao` | Última ação agendada | — |

### crm_pedidos (Pedidos)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `pdo_dthpedido` | **Data do pedido** | ✅ `rpc_pedidos_bi` (filtro principal) |
| `pdo_dthaprovacao` | Data de aprovação | — |
| `pdo_dthassinaturacliente` | Assinatura do cliente | — |

### ordens_servico (Ordens de Serviço)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `os_dthabertura` | **Data de abertura** da OS | ✅ `rpc_servicos_bi` (filtro principal) |
| `os_dthencerramento` | Data de encerramento/conclusão | — (usado para calcular tempo resolução) |
| `os_dtavaria` | Data da avaria | — |
| `os_dthprevisaoatendimento` | Previsão de atendimento | — |

### atendimentos_os (Atendimentos técnicos)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `atd_dth_registro` | Data de registro do atendimento | — |
| `atd_dth_primeiro_ocorrencia` | Primeira ocorrência | — |
| `atd_dth_ultima_ocorrencia` | Última ocorrência | — |

### ocorrencias_os (Ocorrências de OS)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `ose_dth_ocorrencia` | Data da ocorrência | — |
| `ose_dth_original` | Data original | — |

### agenda_servico (Agenda técnica)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `age_dth_previsao_inicio` | Início previsto | — |
| `age_dth_previsao_fim` | Fim previsto | — |

### tecnico_tempo (Tempo de técnicos)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `tmp_dia` | Dia do registro | — |
| `tmp_dth_processamento` | Data de processamento | — |

### crm_funil_etapa (Etapas do funil)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `fne_dthinicioetapa` | Início da etapa | — |
| `fne_dthterminoetapa` | Término da etapa | — |

### crm_carteira_clientes (Carteira de clientes)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `cli_datacadastro` | Data de cadastro do cliente | — |
| `cli_dataatualizacao` | Última atualização | — |

### cliente_parque_maquinas (Frota/Parque de máquinas)

| Campo | Significado | Usado por RPC? |
|-------|-------------|----------------|
| `pqm_dthregistro` | Data de registro da máquina | — |

---

## Resumo: filtro global vs campo por tela

| Tela BI | RPC | Campo filtrado HOJE | Campo "conclusão" equivalente | Status |
|---------|-----|--------------------|-----------------------------|--------|
| Comercial (Negócios BI) | `rpc_negocios_bi` | `ngo_datafechamento` | `ngo_datafechamento` | ✅ OK |
| CRM Negócios | `rpc_negocios_crm` | `ngo_datacadastro` | `ngo_datafechamento` | ⚠️ Usa cadastro |
| Pedidos | `rpc_pedidos_bi` | `pdo_dthpedido` | `pdo_dthaprovacao` | ⚠️ Usa data pedido |
| Serviços | `rpc_servicos_bi` | `os_dthabertura` | `os_dthencerramento` | ⚠️ Usa abertura |
| Ações | `rpc_acoes_bi` | (verificar) | `aco_dthconclusao` | ⚠️ Verificar |

---

## Decisão necessária

Para cada tela, definir:

1. **Qual campo de data o filtro global deve usar?**
2. **O filtro deve persistir entre abas ou resetar ao trocar de tela?**
3. **Serviços: filtrar por abertura (`os_dthabertura`) ou encerramento (`os_dthencerramento`)?**
   - Se encerramento: OS abertas (sem encerramento) ficarão fora do filtro
4. **CRM Negócios: manter cadastro (`ngo_datacadastro`) ou mudar para fechamento (`ngo_datafechamento`)?**
   - Cadastro mostra "quando entrou no pipeline"
   - Fechamento mostra "quando concluiu" (mas negócios em andamento somem)

---

## Observação sobre Serviços

A tabela `ordens_servico` tem apenas **147 registros** (última abertura: 2026-04-13).  
Verificar no Campo Dealer se a view `VW_Ceres_OrdemServico` está com filtro restritivo ou se realmente não há OS novas.
