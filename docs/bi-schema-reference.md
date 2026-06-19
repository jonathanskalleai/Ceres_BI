# BI Schema Reference — Colunas por Tabela

> Referencia rapida para desenvolvimento de KPIs, filtros e graficos.
> Fonte: `supabase/migrations/20260608_rebuild_all_mirrors.sql`
> Atualizado: 2026-06-15

---

## Regras Universais de Filtro

| Filtro | Comportamento |
|--------|---------------|
| **dateRange** | Sempre filtra pela coluna de data PRINCIPAL da entidade. Se nao tem dateRange, mostra tudo. |
| **periodo anterior** | Mesmo intervalo deslocado 1 ano pra tras (ex: jan-jun 2026 → jan-jun 2025) |
| **categoria** | Filtra por funil (VENDAS, ADM, BANCOS, etc.) agrupado em categorias (Vendas Maquinas, Vendas AP, Repasse) |
| **funil** | Filtro individual dentro de uma categoria |
| **vendedor** | Nome do vendedor/consultor |
| **cidade** | Cidade da acao/negocio/cliente |

---

## 1. mirror.crm_negocios (Negocios/Deals)

**Dedup obrigatoria:** por `ngo_numero` (view denormalizada por produto)

### Colunas de Data
| Coluna DB | Tipo | Uso |
|-----------|------|-----|
| `ngo_data_cadastro` | timestamptz | Data de criacao do negocio |
| `ngo_data_fechamento` | timestamptz | Data de conclusao (ganho/perda). **FILTRO PRINCIPAL para dateRange** |
| `ngo_data_atualizacao` | timestamptz | Ultima atualizacao |
| `ngo_data_primeiro_contato` | timestamptz | Primeiro contato com cliente |
| `ngo_data_previsao` | timestamptz | Previsao de fechamento |

### Colunas de Valor
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `ngo_vlr_total_negociado` | NGO_VlrTotalNegociado | Valor do negocio |
| `ngo_ciclo_vendas` | NGO_CicloVendas | Dias entre criacao e fechamento |
| `ngo_qtd_acoes` | NGO_QtdAcoes | Qtd de acoes no negocio |
| `ngo_probabilidade` | NGO_Probabilidade | % probabilidade |

### Dimensoes (agrupamento/filtro)
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `ngo_conclusao` | NGO_Conclusao | Status: contem "ganho" / "perd" / else=andamento |
| `ngo_funil` | NGO_Funil | Nome do funil (VENDAS, ADM, BANCOS...) |
| `ngo_etapa` | NGO_Etapa | Etapa do pipeline (prefixo numerico define ordem) |
| `ngo_vendedores` | NGO_Vendedores | Codigo do vendedor (join com usuarios) |
| `ngo_forma_entrada` | NGO_FormaEntrada | Origem do lead |
| `ngo_motivo_perda` | NGO_MotivoPerda | Razao da perda |
| `ngo_motivo_ganho` | NGO_MotivoGanho | Razao do ganho |
| `cli_cidade` | CLI_Cidade | Cidade do cliente |
| `emp_cod_filial` | EMP_CodFilial | Filial |

---

## 2. mirror.crm_acoes (Acoes Comerciais)

### Colunas de Data
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `aco_dth_conclusao` | dtConclusao | Data de conclusao da acao. **FILTRO PRINCIPAL para dateRange** |
| `aco_dth_abertura` | — | Data de abertura |
| `aco_dth_agenda_inicio` | — | Inicio agendado |
| `aco_dth_agenda_termino` | — | Fim agendado |
| `aco_dth_atualizacao` | — | Ultima atualizacao |
| `aco_dth_geolocalizacao` | — | Quando geolocalizado |

### Dimensoes (agrupamento/filtro)
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `aco_vendedor` | vendedor / NomeVendedor | Nome do vendedor |
| `aco_tipo_acao` | tipoAcao | Tipo de acao (Visita, Telefone, etc.) |
| `aco_tipo_contato` | tipoContato | Tipo de contato |
| `emp_cidade` | cidade | Cidade da filial |
| `aco_status` | status | Status da acao |
| `aco_acao_valida` | — | Se acao foi validada |
| `cli_nome` | cliente | Nome do cliente |

### Metricas derivadas
- **totalAcoes:** COUNT(registros filtrados)
- **visitas:** COUNT WHERE tipoContato contem "visita" (case insensitive)
- **porTipoAcao:** GROUP BY tipoAcao → COUNT

---

## 3. mirror.crm_pedidos (Pedidos)

### Colunas de Data
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `pdo_dth_pedido` | PDO_DthPedido | Data do pedido. **FILTRO PRINCIPAL para dateRange** |
| `pdo_dth_aprovacao` | — | Data de aprovacao |
| `pdo_dth_assinatura_cliente` | — | Data assinatura |

### Colunas de Valor
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `pdo_vlr_pedido` | PDO_VlrPedido | Valor total do pedido |
| `pdo_vlr_financiado` | PDO_VlrFinanciado | Parcela financiada |
| `pdo_vlr_recurso_proprio` | PDO_VlrRecursoProprio | Parcela recurso proprio |

### Dimensoes
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `pdo_situacao_pedido` | PDO_SituacaoPedido | Aprovado/Cancelado/Pendente |
| `pdo_vendedor` | PDO_Vendedor | Nome do vendedor |
| `pdo_cidade_uf_entrega` | PDO_CidadeUFEntrega | Destino |
| `pdo_financiamento_banco` | — | Banco financiador |

---

## 4. mirror.ordens_servico (Servicos/OS)

### Colunas de Data
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `os_dth_abertura` | — | Abertura da OS. **FILTRO PRINCIPAL para dateRange** |
| `os_dth_encerramento` | — | Encerramento |
| `os_dt_avaria` | — | Data da avaria |
| `os_dth_previsao_atendimento` | — | Previsao atendimento |

### Dimensoes
| Coluna DB | Frontend prop | Uso |
|-----------|---------------|-----|
| `sit_dsc_situacao_os` | — | Situacao (Aberta, Fechada, etc.) |
| `os_f_status` | — | Status flag |
| `tos_cod_tipo_os` | — | Tipo de OS |
| `cli_nome` | — | Cliente |
| `emp_cod_filial` | — | Filial |

---

## 5. mirror.crm_pedidos_item (Itens de Pedido)

### Colunas de Valor
| Coluna DB | Uso |
|-----------|-----|
| `pdo_item_qtde` | Quantidade |
| `pdo_item_vlr_unitario` | Valor unitario |

### Dimensoes
| Coluna DB | Uso |
|-----------|-----|
| `pdo_item_grupo` | Grupo de produto |
| `pdo_item_marca` | Marca |
| `pdo_item_modelo` | Modelo |
| `pdo_item_descricao` | Descricao |
| `pdo_codigo_interno` | FK para pedido |

---

## 6. mirror.crm_carteira_clientes (Clientes)

### Colunas de Data
| Coluna DB | Uso |
|-----------|-----|
| `cli_data_cadastro` | Data de cadastro do cliente |
| `cli_data_atualizacao` | Ultima atualizacao |

### Dimensoes
| Coluna DB | Uso |
|-----------|-----|
| `cli_nome` | Nome |
| `cli_cidade` | Cidade |
| `cli_uf` | UF |
| `cli_segmento` | Segmento |
| `cli_tipo_cliente` | Tipo |
| `cli_prospect` | Se e prospect |
| `usr_nome_usuario` | Vendedor responsavel |

### Geo
| Coluna DB | Uso |
|-----------|-----|
| `cli_lat` | Latitude |
| `cli_lon` | Longitude |

---

## 7. mirror.cliente_parque_maquinas (Parque de Maquinas)

### Dimensoes
| Coluna DB | Uso |
|-----------|-----|
| `pqm_grupo` | Grupo de produto |
| `pqm_marca` | Marca |
| `pqm_modelo` | Modelo |
| `pqm_qtd_maquinas` | Quantidade |
| `pqm_ano` | Ano da maquina |
| `cli_nome` | Cliente |

---

## 8. Views Legadas (sem mirror — via edge function)

| View | Coluna de Data | Dimensoes chave |
|------|----------------|-----------------|
| VW_Ceres_TecnicoTempo | (nenhuma — snapshot) | USR_nomeUsuario, TMP_TempoDisponivel, TMP_DuracaoAtendimento |
| VW_Ceres_Agenda | (AGE_fStatus para filtro) | TPS_dscTipoServicoAtendimento, USR_nomeUsuario |
| VW_Ceres_AtendimentoOS | (nenhuma explicita) | ATD_dscCausa, ATD_DuracaoAtendimento |
| VW_Ceres_Ocorrencias | (nenhuma explicita) | OSE_dscMotivoPausa, OSE_dscSituacaoOcorrencia |

**NOTA:** Estas views NAO suportam filtro de dateRange no momento. Para adicionar, seria necessario:
1. Criar mirror tables com as colunas de data
2. Ou adicionar parametro de data na edge function

---

## Mapeamento Frontend prop → Coluna DB

O frontend usa nomes camelCase (props do tipo `Registro`). Mapeamento no service layer:

| Frontend | DB (mirror) | Tabela |
|----------|-------------|--------|
| dtConclusao | aco_dth_conclusao | crm_acoes |
| vendedor | aco_vendedor | crm_acoes |
| tipoAcao | aco_tipo_acao | crm_acoes |
| tipoContato | aco_tipo_contato | crm_acoes |
| cidade | emp_cidade | crm_acoes |
| cliente | cli_nome | crm_acoes |
| NGO_Numero | ngo_numero | crm_negocios |
| NGO_Conclusao | ngo_conclusao | crm_negocios |
| NGO_VlrTotalNegociado | ngo_vlr_total_negociado | crm_negocios |
| NGO_DataFechamento | ngo_data_fechamento | crm_negocios |
| NGO_DataCadastro | ngo_data_cadastro | crm_negocios |
| NGO_Funil | ngo_funil | crm_negocios |
| NGO_Etapa | ngo_etapa | crm_negocios |
| NGO_Vendedores | ngo_vendedores | crm_negocios |
| NGO_CicloVendas | ngo_ciclo_vendas | crm_negocios |
| NGO_QtdAcoes | ngo_qtd_acoes | crm_negocios |

---

## Regras de Negocio para Filtro de Data

### Negocios
- **Coluna:** `ngo_data_fechamento`
- **Comportamento:** Se dateRange ativo, filtra por data de fechamento. Negocios sem data de fechamento (em andamento) sao EXCLUIDOS quando dateRange ativo.
- **Periodo anterior:** mesmo intervalo -1 ano

### Acoes
- **Coluna:** `aco_dth_conclusao` (mapeada como `dtConclusao`)
- **Comportamento:** Se dateRange ativo, filtra por data de conclusao. Acoes sem conclusao sao EXCLUIDAS quando dateRange ativo.
- **Periodo anterior:** mesmo intervalo -1 ano

### Pedidos
- **Coluna:** `pdo_dth_pedido`
- **Comportamento:** Filtra pela data do pedido.
- **Periodo anterior:** mesmo intervalo -1 ano

### Ordens de Servico
- **Coluna:** `os_dth_abertura`
- **Comportamento:** Filtra pela data de abertura da OS.
- **Periodo anterior:** mesmo intervalo -1 ano (quando implementado)

### Operacional (TecnicoTempo / Agenda)
- **Sem coluna de data disponivel no mirror atual**
- **Nao suporta filtro de dateRange** ate criar mirror com timestamps
