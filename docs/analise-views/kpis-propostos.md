# Backlog de KPIs Propostos — Priorizado

**Critério de prioridade:** impacto comercial × esforço × dependência de novas views.

Legenda:
- 🔴 **P0** = impacto alto, esforço baixo, usa view já consumida
- 🟠 **P1** = impacto alto, esforço médio, requer 1 view nova
- 🟡 **P2** = impacto médio ou esforço alto

Esforço: **S** (≤2h) · **M** (½ dia) · **L** (≥1 dia)

---

## 🔴 P0 — Quick wins (Negocios já consumido, colunas ignoradas)

### 1. Pipeline Ponderado · S
**Fórmula:** `SUM(NGO_VlrTotalNegociado × NGO_Probabilidade/100)` para negócios em andamento.
**Por quê:** mais realista que pipeline bruto — alinha gerente e vendedor sobre o que realmente vai entrar.
**Onde:** BiPainel, card ao lado de "Pipeline Aberto".

### 2. Tempo Médio até 1º Contato · S
**Fórmula:** `AVG(NGO_DataPrimeiroContato − NGO_DataCadastro)`.
**Por quê:** SLA de resposta a lead — métrica universal de comercial.
**Onde:** BiPainel, seção "Operacional".

### 3. Lead-to-Cash Real · S
**Fórmula:** `AVG(NGO_DataFechamento − NGO_DataPrimeiroContato)` dos ganhos.
**Por quê:** já temos "Ciclo Médio" baseado em cadastro; este é mais fiel.
**Onde:** BiPainel, substitui ou complementa ciclo atual.

### 4. Top 5 Motivos de Perda · S
**Fórmula:** `COUNT(*) GROUP BY NGO_MotivoPerda WHERE conclusao = perda`.
**Por quê:** hoje só sabemos quantos perdemos, não por quê.
**Onde:** novo card horizontal no BiPainel ou painel "Inteligência".

### 5. Top 5 Motivos de Ganho · S
**Fórmula:** análogo ao 4, com `NGO_MotivoGanho`.
**Onde:** mesmo painel.

### 6. Mix por Canal de Entrada · S
**Fórmula:** `COUNT/SUM valor GROUP BY NGO_FormaEntrada`.
**Por quê:** descobrir se indicação > campanha > site etc.
**Onde:** BiComercial, gráfico pizza/barra.

### 7. Performance por Campanha · S
**Fórmula:** `valor ganho / qtd negocios GROUP BY NGO_Campanha`.
**Onde:** BiInteligencia.

### 8. Ticket Médio por Categoria de Produto · S
**Fórmula:** `AVG(NGO_VlrTotalNegociado) GROUP BY PRD_GrupoProduto`.
**Por quê:** já vem no Negocios — não precisa join.
**Onde:** BiProdutos.

### 9. Share Novo vs Usado · S
**Fórmula:** `SUM(valor) GROUP BY PRD_CondicaoProduto` (Novo, Usado).
**Onde:** BiPainel ou BiProdutos.

### 10. Negócios Estagnados · S
**Fórmula:** count de negócios em andamento com `NGO_DataAtualizacao` > X dias.
**Por quê:** lista de "vamos cobrar".
**Onde:** BiPainel ou módulo Pipeline.

---

## 🟠 P1 — Alto impacto, 1 nova view

### 11. Funil Real com Conversão Etapa→Etapa · M
**View nova:** `VW_Ceres_CRM_Negocios_Etapas` + `VW_Ceres_CRM_FunilEtapa`.
**Fórmula:** para cada par (etapa_n, etapa_n+1): `count chegou em n+1 / count passou por n`.
**Visualização:** funil clássico no BiInteligencia.

### 12. Gargalo do Funil (etapa que mais retém) · M
**View nova:** `Negocios_Etapas`.
**Fórmula:** `AVG(FNE_DuracaoDias) GROUP BY Etapa_dscStatusNegocio`.
**Por quê:** mostra onde o vendedor "trava".

### 13. Etapas Fora do SLA · M
**View nova:** `Negocios_Etapas` + `FunilEtapa.Etapa_DiasEstagnado`.
**Fórmula:** count de negócios em andamento cuja etapa atual está há mais dias que `Etapa_DiasEstagnado`.
**Por quê:** alerta automático de SLA.

### 14. Mix de Produto Vendido · M
**View nova:** `VW_Ceres_CRM_PedidosItem` + `Produtos/Grupo/Marca/Modelo`.
**KPIs:** Top 10 modelos vendidos, share por marca, % de cada grupo no faturamento.
**Onde:** BiPedidos / BiProdutos.

### 15. Share-of-Wallet por Cliente · M
**View nova:** `ParqueMaquinas` + cruzar com `Negocios` ganhos.
**Fórmula:** `máquinas vendidas por nós / total parque do cliente`.
**Por quê:** identifica clientes onde a concorrência domina.

### 16. Potencial por Hectare · M
**View nova:** `ClientePropriedade`.
**Fórmula:** `SUM(PPD_Medida) por cluster vendedor/cidade`.
**Por quê:** "vendedor X cobre 12 mil hectares, fechou só Y".

### 17. KPIs Sazonais por Safra · M
**View nova:** `Propriedade.CLT_DthPrevisaoColheita` + `CLT_TipoCultura`.
**Por quê:** ajustar campanhas à janela de safra (soja, milho, café).

### 18. Performance por Tag (Cliente/Negócio) · M
**Views novas:** `TAGXCLIENTE`, `TAGXNEGOCIO`.
**KPIs:** ticket médio por tag, conversão por tag, valor por tag.
**Por quê:** tags são segmentação manual cuidadosa, totalmente ignorada hoje.

### 19. Atribuição de Vendas a Bancos · S
**Coluna já existe:** `ORC_Banco` em Negocios.
**KPI:** % de negócios financiados por cada banco, ticket médio.
**Onde:** BiInteligencia ou financeiro.

### 20. Concorrência por Modelo Perdido · S
**Colunas já existem:** `MPP_ProdutoPerdaMarca`, `MPP_ProdutoPerdaModelo`, `MPP_ProdutoVlrConcorrencia`.
**KPI:** top concorrentes que vencem, gap de preço médio.
**Por quê:** **competitive intelligence** real — quase ninguém mede.
**Onde:** BiInteligencia (novo card).

---

## 🟠 P1 — Pós-venda (revoluciona o módulo de Serviços)

### 21. MTTR Real por Tipo de OS · M
**Views:** `OrdemServico` + `AtendimentoOS`.
**Fórmula:** `AVG(ATD_DuracaoAtendimento) GROUP BY TOS_codTipoOS`.

### 22. Reincidência de Atendimento · M
**Views:** `AtendimentoOS` (usar `ATD_DthPrimeiroOcorrencia` × `ATD_DthUltimaOcorrencia`).
**KPI:** % de OS que voltaram com a mesma causa em < 30 dias.

### 23. Top Causas Raiz · S
**View:** `AtendimentoOS.ATD_dscCausa`.
**KPI:** Top 10 causas + part numbers (`ATD_partNumberCausadora`).

### 24. Utilização do Técnico · M
**View:** `TecnicoTempo`.
**Fórmula:** `(TMP_DuracaoAtendimento + TMP_DuracaoDeslocamento) / TMP_TempoDisponivel`.
**KPI gêmeo:** % tempo ocioso, km/dia, hora extra/dia.
**Onde:** BiOperacional (novo).

### 25. Cumprimento de Agenda · S
**View:** `Agenda`.
**Fórmula:** `count concluídas no prazo / total agendadas`.

### 26. Ocorrências por OS (índice de complicação) · S
**Views:** `Ocorrencias` agrupado por `OSE_idOS`.
**KPI:** OS com >N ocorrências = OS problemática.

---

## 🟡 P2 — Médio impacto / esforço maior

### 27. Cobertura por Vendedor × Hectares · L (depende de Propriedade + UsuarioXEmpresa).
### 28. Clientes Quentes (carteira × parque × sem ação) · L (cross 3 views).
### 29. Geo-heatmap de Propriedades · L (precisa lat/lon — propriedade tem int, parece truncado).
### 30. Estoque Virtual vs Pipeline · L (view EstoqueVirtual hoje tem 1 linha — provavelmente desabilitada no sistema fonte).

---

## Top 10 recomendados para implementação imediata

Se você quiser priorizar para a próxima rodada, esta é a minha sugestão (mais ROI/esforço):

1. **Pipeline Ponderado** (P0 #1) — S
2. **Top Motivos de Perda** (P0 #4) — S
3. **Top Motivos de Ganho** (P0 #5) — S
4. **Mix por Canal de Entrada** (P0 #6) — S
5. **Mix Novo vs Usado** (P0 #9) — S
6. **Negócios Estagnados** (P0 #10) — S
7. **Funil Real com Conversão Etapa→Etapa** (P1 #11) — M
8. **Mix de Produto Vendido** (P1 #14) — M
9. **Concorrência por Modelo Perdido** (P1 #20) — S
10. **Utilização do Técnico** (P1 #24) — M

Estimativa total: ~2 dias de implementação para os 10. Quer que eu siga? Posso fazer em ondas — começo pelos 6 P0 (todos S, mesma sessão) e depois os 4 P1.
