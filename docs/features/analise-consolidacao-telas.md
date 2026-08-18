# Análise de Consolidação das Telas BI — Ceres BI

> Documento de discussão multi-agente. Contém a análise inicial (Cloud) e a
> contra-análise (Kiro). Objetivo: uma terceira LLM vai arbitrar e propor
> o plano final de consolidação.

---

# ANÁLISE CLOUD

> Documento gerado para discussão com outra IA. Objetivo: revisar as 18 telas
> atualmente expostas ao cliente, identificar o que é redundante, o que não
> entrega valor e propor a consolidação em 2-3 novas telas que condensem o
> conteúdo relevante sem perder a leitura operacional do cliente.

---

## 1. Contexto da Operação

- O BI foi construído em waves com o próprio cliente. Resultado: 18 módulos
  na sidebar, grande sobreposição entre painéis, vários visuais que repetem a
  mesma RPC ou o mesmo agregado sob um rótulo diferente.
- Hoje **estão liberadas e aprovadas** 4 telas:
  - **bi.acoes** → "Ações" — visão comercial operacional (consolidada)
  - **crm.consultores** → "Equipe" — performance por consultor + IA
  - **crm.registros** → "Atividades" — lista de ações recentes com busca
  - **crm.overview** → "Visão Geral" — cards agregados (Previsão, Visitas, etc.)
- O cliente comprou a plataforma para ter **BI + IA**. Insight assistido por
  LLM é parte do produto, e a tela Equipe já entrega IA hoje. As novas telas
  precisam ampliar esse vetor (insights automáticos + narrativa do dado).
- O cliente já sinalizou que quer **menos telas, mais densidade**. Pediu
  consolidação das 18 atuais para ~5-6 pensando também em manutenção do
  nosso lado (cada tela = 1 seção lazy + 1 hook + 1 RPC).

---

## 2. Inventário das Telas Atuais

### 2.1 Telas já liberadas (manter como estão)

| Rota | Label | O que mostra | Fontes |
|---|---|---|---|
| /bi/acoes | Ações | KPIs (total ações, visitas, ganho, perda, valor), funil de vendas, termômetro de fechamento, ranking de consultores, esforço x retorno, evolução mensal, distribuição por tipo/cidade/canal, clientes em risco, gestão de carteira, mapa de oportunidades, tabela de detalhe paginada | 6 RPCs (acoes_bi, funil_gestao, detalhe, clientes_risco, evolucao_mensal, termometro) |
| /crm/consultores | Equipe | Performance por consultor (carteira, taxa, pipeline, ranking), insight IA por consultor, gráfico de evolução por consultor | rpc_consultores_resumo_acoes + InsightEquipeCard |
| /crm/registros | Atividades | Tabela de ações recentes com busca por cliente (3+ chars), debounce 400ms, expansão automática para o ano quando há busca | rpc_registros_recentes |
| /crm/overview | Visão Geral | 6 cards (Registros, Clientes, Pipeline, Visitas, Consultores, Cidades) + 5 gráficos (evolução mensal, top consultores, tipos contato, tipos ação, top regiões) | rpc_kpis_comercial, rpc_ranking_vendedores, rpc_evolucao_mensal, rpc_ranking_regioes |

### 2.2 Telas BI não liberadas (auditar)

| Rota | Label | Conteúdo | Veredito |
|---|---|---|---|
| /bi/painel | Painel | 6 sections: Negócios, Valores, Cross, Pedidos, Clientes, Serviços, Ações. Cada um agrega 4-6 KPI cards + gráfico de evolução. 7 RPCs somadas. | **Redundante com Ações + Visão Geral**. Sobrepõe quase tudo que já está liberado. |
| /bi/comercial | Comercial | KPI cards (Negócios, Taxa Conversão, Pipeline Aberto/Perdido, Valor Ganho, Ciclo, Esforço) + 6 gráficos (Funil por etapa, Origem lead, Motivos perda, Velocidade funil, Evolução mensal, Ranking consultores). | **Concentra dados do funil VENDAS.** Bastante útil, mas em duplicidade com cards da Ações. |
| /bi/pedidos | Pedidos | Card (Total, Faturamento, Ticket, Taxa Aprovação, % Financiado, Valor Cancelado) + 7 gráficos (Evolução faturamento, Mix pagamento, Valor por situação, Ranking vendedores, Top cidades, Itens por grupo, Itens por marca). | **Tela própria e densa.** Agregado único (pedidos faturados), sem chancela de uso diário. |
| /bi/servicos | Serviços | KPI de OS (Total, Abertas, Taxa Fechamento, Tempo Médio, Mediana, Ocorrências) + 6 gráficos (OS por status, Tempo por faixa, Evolução mensal, Atividade campo, Motivos pausa, Causas atendimento). | **3 dos 6 gráficos estão com a RPC vazia** ("dados não migrados — sempre []"). Card Total Ocorrências também é sempre 0. |
| /bi/produtos | Produtos | KPI (Máquinas Instaladas, Clientes com Parque, Grupos, Marcas) + 3 gráficos (Base por grupo, Base por marca, Top modelos). | **Equivale a "Base Instalada"** — referência a parque de máquinas. Pouco volátil. |
| /bi/operacional | Operacional | KPI (Técnicos Ativos, KM Rodado, Utilização, Tempo Ocioso, Eventos Agenda, Conclusão Agenda) + 4 gráficos (Utilização por técnico, KM por técnico, Agenda por status, Agenda por tipo). | **Foco "frota técnica / pós-venda"**. Cobertura muito específica, audiência reduzida. |
| /bi/admin | Admin | KPI (Clientes Carteira, Ativos, Prospects, UFs Cobertas, Consultores, Empresas) + 4 gráficos (Prospects vs Ativos, Heatmap BR, Carteira por consultor, Classificação clientes). | **Geografia + classificação ERP**. Útil mas sem recorrência. |
| /bi/inteligencia | Inteligência | 4 blocos: Eficiência do Funil (Win Rate, Motivos perda, Visitas/Ganho), Performance Financeira (Mix pagamento, Share banco, Receita cidade), Inteligência de Mercado (Frota+5), Pós-Venda/SLA (Tempo OS filial, Tempo OS tipo). | **Amplo mas disperso.** Cada gráfico de uma RPC especializada. |
| /bi/etl-monitor | Monitor ETL | Saúde das tabelas mirror: status, última sync, freshness, erros. | **Operacional interno.** Não deve ficar exposto ao cliente final. |

### 2.3 Telas CRM não liberadas (auditar)

| Rota | Label | Conteúdo | Veredito |
|---|---|---|---|
| /crm/mapa | Mapa de Ações | Mapa do Brasil com regiões + clientes plotados + KPIs por região. | **Único visual geográfico.** Valor alto para gestor regional. |
| /crm/negocios | Negócios | Dashboard cruzando ações com vínculo a negócios. | **Visualização complementar a Ações.** Sobrepõe funil. |
| /crm/criticos | Clientes Críticos | Lista de clientes sem contato >90d, com última ação, dias parados, vendedor. | **Subset do gráfico "Clientes em Risco"** que já existe em Ações. |
| /crm/insights | Observações | Lista de observações registradas em campo pelos consultores. | **Tabelão de comentários textuais.** Auditável mas raramente usado. |
| /crm/administrativo | Administrativo | Visão admin: registros agrupados por usuários administradores. | **Lista de auditoria.** Uso interno. |

### 2.4 Telas Tools / Admin

| Rota | Label | Conteúdo | Veredito |
|---|---|---|---|
| /tools/explorer | Explorador de Views | Client SQL bruto sobre as views mirror. | **Pro power-user.** Manter, restringir acesso. |
| /tools/performance | Performance 2026 | Stub "em desenvolvimento". | **Não entregar agora.** |
| /admin/users | Gerenciar Usuários | CRUD de usuários + permissões. | **Já ok, manter.** |
| /admin/profile | Meu Perfil | Perfil do usuário logado. | **Já ok, manter.** |

---

## 3. Sobreposições Identificadas

### 3.1 Já existem em 2+ telas

| Agregado | Onde aparece |
|---|---|
| Total de ações / visitas | Painel, Ações, Visão Geral, Comercial (via funil) |
| Pipeline aberto / perdido | Painel, Comercial (KPI), Ações (funil) |
| Valor ganho / Taxa conversão | Painel, Comercial, Ações (ranking/funil) |
| Ranking de consultores | Ações, Comercial, Visão Geral, Equipe |
| Motivos de perda | Ações (sub-rota), Comercial, Inteligência |
| Win rate por vendedor | Inteligência, Comercial (Ranking c/ tooltip) |
| Clientes sem contato / risco | Ações (gráfico + Gestão Carteira), Críticos (lista) |
| Mapa geográfico | Ações (Mapa de Oportunidades), Mapa de Ações (cidades) |
| Mix de pagamento | Inteligência, Pedidos |
| Receita por cidade | Inteligência, Pedidos (Top Cidades) |
| Tempo médio OS | Serviços, Inteligência (SLA filial/tipo) |
| Share por banco | Inteligência (só existe aqui) |

### 3.2 Telas inteiras sem dado

- **bi/servicos**: 3 gráficos (Atividade de Campo, Motivos de Pausa, Causas de Atendimento) e 1 KPI (Total Ocorrências) estão com a fonte marcada como "dados não migrados — sempre [] / sempre 0". São 4 widgets zumbis.
- **tools/performance**: tela em branco.

### 3.3 Telas com baixa rotatividade

| Tela | Frequência de uso provável |
|---|---|
| bi/admin | Trimestral (governança) |
| bi/produtos | Trimestral (parque) |
| bi/operacional | Mensal (gestores de serviço) |
| bi/etl-monitor | Nunca para usuário final |
| crm/insights | Quinzenal (auditoria) |
| crm/administrativo | Mensal (admin) |
| crm/negocios | Semanal (comercial) |
| crm/criticos | Diário (gestor) **se for ligado a fluxo de reativação** |

---

## 4. Recomendação Cloud: Consolidar em 2 Telas Novas

Proposta de naming alinhada ao que o cliente já chama de "caramanar":
**Comercial** (matinal) + **Serviços** (tarde). Mantém-se as 4 já liberadas.
Total final: 6 telas + 4 admin/tools = 10 entradas na sidebar.

### 4.1 Tela nova 1 — "Comercial" (renomeia e amplia bi.comercial)

**Substitui:** bi/comercial, bi/pedidos, bi/produtos, bi/admin, bi/inteligencia (parte financeira), bi/painel (sub-aba de gráficos).

**Rota:** /bi/comercial — mesmo path, novo conteúdo.

**Estrutura (em abas para evitar scroll infinito):**

1. **Aba "Vendas"** (a bi.comercial de hoje)
   - KPIs: Negócios, Taxa Conversão, Pipeline Aberto, Pipeline Perdido, Valor Ganho, Ciclo Vendas, Esforço Médio
   - Funil por Etapa, Origem Lead, Motivos Perda, Velocidade Funil
   - Evolução Mensal, Ranking Consultores (Valor Ganho)

2. **Aba "Pedidos"** (a bi.pedidos de hoje)
   - KPIs: Total, Faturamento, Ticket, Taxa Aprovação, % Financiado, Valor Cancelado
   - Evolução Faturamento, Mix Pagamento, Valor por Situação
   - Ranking Vendedores, Top Cidades, Itens por Grupo, Itens por Marca

3. **Aba "Mercado"** (recorta de bi.inteligencia)
   - Mix Pagamento (pie), Share por Banco, Receita por Cidade (Top 10)
   - Frota +5 Anos por Marca (oportunidade de renovação)
   - Win Rate por Vendedor (subset relevante)

4. **Aba "Carteira"** (recorta de bi.admin)
   - KPIs: Clientes Carteira, Ativos, Prospects, UFs Cobertas
   - Heatmap BR, Prospects vs Ativos, Carteira por Consultor
   - Classificação Cliente

**Por que essas 4 juntas:** todas respondem a "quanto vendemos, de onde vem,
quem comprou, o que deixou de comprar". Audiência: gestor comercial +
diretoria. Cobre o escopo de **financeiro + carteira** em um só lugar.

**Onde entra IA:** aba "Vendas" ganha um card "Insights de IA" no topo,
alimentado por LLM que recebe (a) snapshot das 6 KPIs, (b) motivos de perda,
(c) ranking e (d) evolução mensal — devolve 3-5 frases: o que melhorar, o
que está verde, o que merece atenção. Mesmo padrão de chamada IA que já
existe em Equipe/InsightsEquipeCard.

### 4.2 Tela nova 2 — "Serviços" (renomeia e amplia bi.operacional)

**Substitui:** bi/operacional, bi/servicos (parte útil), bi/inteligencia (Pós-Venda/SLA), crm/criticos, crm/mapa.

**Rota:** /bi/servicos — mesmo path.

**Estrutura:**

1. **Aba "Operação"** (a bi.operacional de hoje)
   - KPIs: Técnicos Ativos, KM Rodado, Utilização Média, Tempo Ocioso, Eventos Agenda, Conclusão Agenda
   - Utilização por Técnico, KM por Técnico, Agenda por Status, Agenda por Tipo

2. **Aba "Ordens de Serviço"** (recorta de bi.servicos, **REMOVE** os 4 widgets zumbis)
   - KPIs: Total OS, Abertas, Taxa Fechamento, Tempo Médio Resolução, Mediana Resolução
   - OS por Status, Tempo por Faixa, Evolução Mensal de Aberturas
   - **Removidos** (sem dado): Atividade Campo, Motivos Pausa, Causas Atendimento, Total Ocorrências

3. **Aba "SLA"** (recorta de bi.inteligencia, parte Pós-Venda)
   - Tempo Médio OS por Filial, Tempo Médio OS por Tipo
   - Sparkline de evolução de OS por filial

4. **Aba "Clientes Críticos"** (recorta de crm.criticos)
   - Lista de clientes sem contato >90d, com última ação, vendedor, dias parados
   - **CTA**: "Abrir no Ações" para reativação (drill-through)

5. **Aba "Mapa"** (recorta de crm.mapa)
   - Mapa de bolhas por região com intensidade de ações
   - Lista lateral de top regiões com KPIs

**Por que essas 5 juntas:** todas respondem a "como está o campo, o que
está parado, onde está o gargalo". Audiência: gestor de pós-venda +
supervisão técnica. Cobre o escopo de **operação + SLA + risco + geografia**.

**Onde entra IA:** aba "Operação" recebe card "Insights IA" que analisa
utilização dos técnicos versus conclusão de agenda — aponta quem está
subutilizado, quem está sobrecarregado, quem tem alta taxa de ociosidade.

### 4.3 Telas que permanecem sem alteração

- **Ações** (/bi/acoes) — mantida. É o coração do BI.
- **Equipe** (/crm/consultores) — mantida. É a tela de IA + ranking.
- **Atividades** (/crm/registros) — mantida. É o detalhe operacional.
- **Visão Geral** (/crm/overview) — mantida. É o "what happened today".
- **Monitor ETL** — mover de bi/* para admin/* e restringir a `admin`. Não
  deve aparecer para o usuário final. Mantém a dependência interna viva.
- **Explorador de Views** — manter como está (tools/*).
- **Gerenciar Usuários / Meu Perfil** — manter.

---

## 5. Telas / Módulos a Descontinuar ou Rebaixar

| Módulo | Ação | Justificativa |
|---|---|---|
| `bi.painel` | **Descontinuar** (após GA do rename em bi.comercial) | Conteúdo integralmente redundante com Ações + Nova Comercial. |
| `bi.comercial` | **Renomear/manter** path, virar "Comercial" com 4 abas | Tela central nova. |
| `bi.pedidos` | **Fundir** em aba da Comercial | Conteúdo cabe inteiro dentro de Comercial. |
| `bi.produtos` | **Fundir** em aba "Carteira" da Comercial | Recorte de Base Instalada & Parque. |
| `bi.operacional` | **Renomear/manter** path, virar "Serviços" com 5 abas | Tela central nova. |
| `bi.servicos` | **Fundir** em aba da Serviços (limpar zumbis) | Conteúdo cabe dentro de Serviços. |
| `bi.admin` | **Fundir** em aba "Carteira" da Comercial | Conteúdo cabe dentro de Comercial. |
| `bi.inteligencia` | **Descontinuar** após mover 2 gráficos para Comercial e 2 para Serviços | Disperso, melhor inline. |
| `bi.etl-monitor` | **Mover** para admin (admin.etl-monitor) | Operacional interno, não pertence ao BI do cliente. |
| `crm.mapa` | **Fundir** em aba "Mapa" da Serviços | Visão geográfica faz sentido no agregado "Serviços". |
| `crm.negocios` | **Descontinuar** após validação | Foi construído como dashboard paralelo a Ações. Substituído pela nova Comercial. |
| `crm.criticos` | **Fundir** em aba "Clientes Críticos" da Serviços | Conteúdo cabe na face "Serviços". |
| `crm.insights` | **Descontinuar** após validação | Lista de observações textuais com baixa rotatividade. |
| `crm.administrativo` | **Mover** para admin (admin.auditoria) | Auditoria, não BI. |
| `tools.performance` | **Não entregar** | Stub em branco. |

---

## 6. Resultado Sugerido (Cloud)

**Sidebar final (10 entradas):**

```
Ações                   — /bi/acoes       (mantida)
Equipe                  — /crm/consultores (mantida)
Atividades              — /crm/registros  (mantida)
Visão Geral             — /crm/overview    (mantida)
Comercial               — /bi/comercial   (nova, 4 abas)
Serviços                — /bi/servicos    (nova, 5 abas)
                                                   --- admin ---
Gerenciar Usuários      — /admin/users
Meu Perfil              — /admin/profile
Monitor ETL             — /admin/etl-monitor (rebaixado)
Auditoria               — /admin/auditoria (rebaixado de crm.administrativo)
                                                   --- tools ---
Explorador de Views     — /tools/explorer
```

**12 → 10 entradas (redução de ~17%).** Concentração do conteúdo relevante
ficou em 6 telas de negócio, com IA assistiva em Ações, Equipe, Comercial e
Serviços.

---

## 7. Itens para Discussão (Cloud)

1. **Renomeação de "Comercial" e "Serviços":** o cliente já chama de
   "comercial" o que nós chamamos de "Ações". Vale alinhar o label para evitar
   ambiguidade, ou o duplo sentido é OK?
2. **Tab dentro de Tab:** a Visão Geral já usa Tabs. A nova Comercial e
   Serviços também usarão. UX consistente ou pesa demais?
3. **Drill-through entre telas:** "Clientes Críticos" (aba em Serviços) deve
   ter CTA "Abrir no Ações" para o contexto completo do cliente. Implementar
   filtro compartilhado via query string ou via `NegociosFilterContext`?
4. **IA nas novas telas:** a quantidade de insights por aba é agressiva
   (4 telas com IA). Vale entrar com 1 card IA por tela e medir engajamento
   antes de expandir?
5. **Move de labels e módulos:** a descontinuação de `bi.inteligencia` exige
   apagar de `app_modules`? Ou só retirar do role default? Confirmar impacto
   em `user_permissions`.
6. **Quem usa `crm.negocios` / `crm.insights` hoje?** Antes de desligar, ver
   se algum consultor realmente abre. Se sim, transformar em "salvo" favorito
   depois.
7. **Heatmap BR na aba Carteira:** componente reuso ou já está pronto em
   `BrazilHeatmap` (vi em `bi/sections/AdminSection.tsx`)? Levantar para
   `components/bi/charts/`.
8. **Mapa geográfico:** "Mapa de Ações" (crm/mapa) e "Mapa de Oportunidades"
   (dentro de bi.acoes) compartilham a mesma base geográfica? Ou são bases
   diferentes? Vale auditar RPCs.
9. **Tela "Performance 2026":** manter como placeholder em tools/* ou
   remover até ter requisito?
10. **i18n:** labels de UI hardcoded em português. Vale considerar i18n se
    roadmap abordar multi-idioma?

---

## 8. Notas sobre Dados (Cloud)

- Views estão em `mirror.*` e as RPCs em `rpc_*`. Para novo relatório de
  auditoria sobre qualidade dos dados, ver `docs/analise-views/kpis-propostos.md`.
- `bi.servicos` tem 4 widgets zumbis — fontes não migradas. Remover antes de
  GA para não exibir gráfico vazio e gerar dúvida no usuário.
- `dashboardBI` ainda importa `BiPainel` como default path. Validar se o
  redirect para a Visão Geral após rename.
- Heatmap por estado só funciona para regiões com clientes cadastrados. Cidades
  sem cadastro não pintam — isso é correto, mas evita expectativa de cobertura
  total.

---

## 9. Próximos Passos Sugeridos (Cloud)

1. **Aprovar o recorte** (este doc) com PO e Stakeholder.
2. **Mapear dependências técnicas** (SQL/RPCs, componentes compartilhados, IA).
3. **Branching:** criar story no Jira/Linear cobrindo:
   - Renome + remoção de módulos em `app_modules` e `role_modules`.
   - Refactor de `BiComercial.tsx`/`BiServicos.tsx` para Tabs.
   - Limpeza dos widgets zumbis.
   - Hook `useInsightsComercial` + componente `InsightComercialCard`.
   - Hook `useInsightsServicos` + componente `InsightServicosCard`.
   - Migração de `crm.mapa` para dentro de `BiServicos` (Mapa).
   - Drill-through Clientes Críticos → Ações.
4. **QA Visual:** Playwright cobrindo navegação entre as 6 telas + filtros.
5. **GA em waves:** habilitar nova sidebar por percentual de usuários,
   manter antiga como fallback por 2 sprints.

---
---

# ANÁLISE KIRO

> Contra-análise feita pelo Kiro com base na auditoria direta do código-fonte.
> Li cada page, section, hook e service para validar as conclusões da Cloud e
> apresentar pontos de divergência.

---

## 1. Validação do Inventário Cloud

Fiz auditoria direta no código. Confirmações:

- **22 rotas** em `MODULE_ROUTES` (navItems.ts). A Cloud disse 18 módulos —
  a diferença são as 4 rotas admin/tools que ela não conta como "BI do cliente".
  Números batem.
- **Sidebar é 100% dinâmica** — montada por `buildNavItems()` que recebe
  `visibleModules` do Supabase (`app_modules` + `user_permissions`). Não há
  nada hardcoded de "liberado" no front. O controle é via banco.
- **bi.servicos tem 4 widgets zumbis** — confirmado. O `ServicosSection.tsx`
  tem 3 ChartCards com `dataSource: "⚠ dados não migrados — sempre []"` e 1
  KPI (Total Ocorrências) que é sempre 0.
- **bi.painel é redundante** — confirmado. Usa 5 hooks (usePainelKPIsRpc,
  usePedidosKPIsRpc, useClientesKPIsRpc, useServicosKPIsRpc, useCrossKPIsRpc)
  e renderiza um grid de cards que são subsets do que Ações + Visão Geral já
  mostram.
- **tools.performance é stub** — confirmado. Renderiza apenas um ícone
  `<Construction />` com texto "Em desenvolvimento".
- **bi.inteligencia é disperso** — confirmado. O `useInteligenciaBIRpc` faz
  5 queries separadas (negocios, pedidos, parque, servicos, esforco). Mistura
  temas sem narrativa. E o queryKey `["rpc", "negocios-bi", ...]` é o MESMO
  que `ComercialSection` usa via `useNegociosBIRpc` — React Query faz dedup,
  mas pro usuário é a mesma informação em 2 lugares.
- **RPCs são reaproveitadas** entre telas — React Query dedup funciona, mas
  a UX mostra os mesmos dados sob rótulos diferentes em telas separadas.

---

## 2. Onde Concordo com a Cloud

| Ponto | Veredito |
|---|---|
| bi.painel deve morrer | ✓ Totalmente redundante |
| bi.inteligencia deve ser fragmentado | ✓ Melhor inline nos contextos certos |
| crm.negocios é redundante com Ações | ✓ Usa DashboardNegociosMensais que é um paralelo |
| crm.insights é dispensável | ✓ Lista de observações textuais, baixa rotatividade |
| crm.administrativo → admin | ✓ É auditoria interna, não BI |
| bi.etl-monitor → admin | ✓ Já está em grupo admin na sidebar |
| tools.performance → não entregar | ✓ Stub vazio |
| Limpar widgets zumbis de bi.servicos | ✓ 4 componentes que nunca renderizam dado |
| Pedidos cabe como aba de Comercial | ✓ Público similar, dado complementar |
| bi.admin cabe como aba "Carteira" | ✓ KPIs de carteira são contexto de vendas |
| IA progressiva (1 card → medir → expandir) | ✓ Prudente |

---

## 3. Onde Discordo da Cloud

### 3.1 "De 14 → 2 telas novas" é agressivo demais

A proposta junta **9 telas** em 2. Na prática:

- **Comercial com 4 abas** teria ~20 KPIs + ~17 gráficos numa só rota. Mesmo
  com tabs, a carga cognitiva é alta e o bundle lazy-loaded é pesado.
- **Serviços com 5 abas** mistura públicos: gestor comercial vê "Clientes
  Críticos" mas não quer ver "KM por Técnico". Operacional é público diferente
  de quem analisa OS/SLA.

**Minha proposta: 3 telas novas, não 2.** Separa Operacional de Serviços.

### 3.2 "Mapa" dentro de Serviços não faz sentido semântico

O `CrmMapaRpc` (que li no código) mostra regiões por **ações/pipeline/visitas**.
Isso é COMERCIAL. O mapa responde "onde estou atuando comercialmente" — não
"onde tem OS aberta". A RPC usada é `rpc_ranking_regioes` que traz `acoes`,
`clientes`, `valor`, `visitas`.

**Minha sugestão:** Mapa entra como aba na Comercial (Carteira) ou permanece
como feature dentro de Ações (já tem `AcoesMapaOportunidades` lá).

### 3.3 "Clientes Críticos" é comercial, não serviço

O `CrmCriticos` mostra:
- Dias sem CONTATO COMERCIAL (>90 dias)
- Pipeline do cliente
- Vendedor responsável
- Última ação (comercial)

Isso é **gestão de carteira comercial**, não pós-venda. Já existe drill-down
para isso dentro de Ações via `AcoesGestaoCarteira`. Colocar em Serviços é
contra-intuitivo para o gestor comercial.

**Minha sugestão:** Clientes Críticos vira aba da Comercial (Carteira) ou
permanece como drill-down dentro de Ações.

### 3.4 A tela Ações está OBESA e ninguém fala disso

A `AcoesSection` renderiza **~15 blocos visuais**:
- 2 grids de KPIs (carteira + oportunidades)
- Funil de conversão
- Termômetro de fechamento
- Ranking consultores (tabela heat)
- Esforço × retorno (2 tabelas)
- Ranking vendedor × cidade
- 6 charts (consultor, evolução ações, cidade, tipo ação, visitas, risco)
- Tabela de clientes mais atendidos
- Gestão de carteira (com 4 sub-abas internas!)
- Mapa de oportunidades
- Tabela de detalhe paginada com filtro de status

Antes de consolidar as outras, **Ações deveria perder peso.** Os rankings e
a gestão de carteira poderiam migrar para a nova Comercial.

### 3.5 bi.operacional merece entrada própria

bi.operacional (técnicos, frota, KM, agenda) é nicho mas é **o que justifica
o BI para o time de pós-venda/campo**. Se enterrar isso numa aba 1/5 dentro
de "Serviços", o gestor de campo perde a sensação de que o sistema é pra ele.

**Minha sugestão:** Operacional mantém entrada standalone ou, no mínimo,
deep-link direto na sidebar que leva pra aba específica.

### 3.6 bi.produtos — manter separado não custa nada

É pequeno (4 KPIs + 3 charts), pouco volátil, 72 linhas de código. Jogar
dentro da aba "Carteira" da Comercial (que já teria admin + classificação +
heatmap) polui uma aba que já está densa. Renomear para "Base Instalada" e
deixar standalone é mais limpo.

---

## 4. Proposta Alternativa Kiro: 3 Telas Novas

| Tela Nova | Absorve | Abas | Público |
|---|---|---|---|
| **Comercial** | bi.comercial + bi.pedidos + bi.admin + bi.inteligencia (blocos 1+2) + crm.criticos | Vendas, Pedidos, Carteira, Mercado | Gestor comercial, diretoria |
| **Serviços & OS** | bi.servicos (limpando zumbis) + bi.inteligencia (bloco 4 - SLA) | Ordens de Serviço, SLA | Supervisor pós-venda |
| **Operacional** | bi.operacional (mantém como está) | (tela única, sem tabs) | Gestor de campo/frota |

### 4.1 Tela "Comercial" — 4 abas

Mesma estrutura que a Cloud propõe, com 2 mudanças:

1. **Aba "Carteira" inclui Clientes Críticos** (ao invés de jogar em Serviços)
   - KPIs de carteira (admin) + heatmap BR + lista de críticos >90d
   - CTA drill-through para Ações

2. **Aba "Mercado" inclui Mapa** (ao invés de jogar em Serviços)
   - Mapa geográfico de regiões (CrmMapaRpc) entra aqui — é comercial

### 4.2 Tela "Serviços & OS" — 2 abas

Mais enxuta que a Cloud (que propôs 5 abas):

1. **Aba "Ordens de Serviço"** — OS por Status, Faixas Resolução, Evolução Mensal
2. **Aba "SLA"** — Tempo por Filial, Tempo por Tipo

Sem widgets zumbis. Sem Mapa. Sem Clientes Críticos. Sem Operacional.

### 4.3 Tela "Operacional" — standalone

Mantém a `OperacionalSection` como está hoje (6 KPIs + 4 charts). Público
separado, carga separada, identidade separada.

---

## 5. Telas que morrem (igual à Cloud)

- `bi.painel` → matar
- `bi.inteligencia` → fragmentar (financeiro→Comercial, SLA→Serviços)
- `crm.negocios` → matar (redundante com Ações)
- `crm.insights` → matar (baixa rotatividade)
- `crm.administrativo` → mover para admin
- `tools.performance` → não entregar

---

## 6. Resultado Sugerido (Kiro)

**Sidebar final (8 telas de negócio + 4 admin/tools = 12 entradas):**

```
Ações               — /bi/acoes        (mantida, potencialmente mais leve)
Equipe              — /crm/consultores  (mantida)
Atividades          — /crm/registros   (mantida)
Visão Geral         — /crm/overview    (mantida)
Comercial           — /bi/comercial    (nova, 4 abas)
Serviços            — /bi/servicos     (nova, 2 abas)
Operacional         — /bi/operacional  (mantida/refatorada)
Base Instalada      — /bi/produtos     (mantida, renomear label)
                                         --- admin ---
Gerenciar Usuários  — /admin/users
Meu Perfil          — /admin/profile
Monitor ETL         — /admin/etl-monitor
Auditoria           — /admin/auditoria
                                         --- tools ---
Explorador          — /tools/explorer
```

---

## 7. Comparativo Cloud vs Kiro

| Critério | Cloud | Kiro |
|---|---|---|
| Telas novas | 2 (Comercial 4 abas, Serviços 5 abas) | 3 (Comercial 4 abas, Serviços 2 abas, Operacional standalone) |
| Total sidebar negócio | 6 | 8 |
| bi.produtos | Funde em Comercial | Mantém separado (renomeia "Base Instalada") |
| bi.operacional | Funde em Serviços (aba 1/5) | Mantém separado |
| crm.mapa | Aba em Serviços | Aba em Comercial (Mercado/Carteira) |
| crm.criticos | Aba em Serviços | Aba em Comercial (Carteira) |
| Ações perde peso? | Não (mantém obesa) | Sim (propõe mover gestão carteira) |
| Complexidade refactor | Alta (9 merges em 2 telas) | Média (6 merges em 3 telas) |
| Risco UX | Tab overload em Serviços (5 abas heterogêneas) | Uma tela a mais na sidebar |
| Coerência de público | Mistura comercial + campo em Serviços | Separação por audiência |

---

## 8. Pontos de Debate para a Terceira IA Arbitrar

1. **2 telas ou 3?** Cloud prioriza minimalismo. Kiro prioriza coerência de
   público e viabilidade de entrega. Qual pesa mais para este cliente?

2. **Mapa e Clientes Críticos — Serviços ou Comercial?** Dado que as RPCs
   (`rpc_ranking_regioes`, `useClientesCriticos`) trazem dados de ações/vendas
   e não de OS/técnicos, onde faz mais sentido semanticamente?

3. **Ações precisa emagrecer?** Com ~15 blocos visuais + 6 RPCs, é a tela
   mais pesada. Se a gestão de carteira + mapa migram para Comercial, Ações
   fica mais focada. Ou o cliente gosta de ter tudo num lugar?

4. **Operacional standalone ou aba?** O argumento Cloud (menos sidebar) vs
   argumento Kiro (público diferente = identidade separada). Meio-termo:
   entry-point próprio na sidebar com deep-link para aba em Serviços?

5. **bi.produtos mantém ou funde?** É 72 linhas de código, trimestral, e
   adicionar 3 charts na aba "Carteira" de Comercial poluiria uma aba densa.
   Mas ter uma tela com uso trimestral na sidebar ocupa espaço visual.

6. **Sprint sizing:** Fusão em 2 telas (Cloud) = refactor maior num shot.
   Fusão em 3 telas (Kiro) = entregas incrementais possíveis. Qual se alinha
   melhor à capacidade do time?

7. **IA:** Ambas concordam em começar com 1 card/tela e medir. Mas em quantas
   telas de cara? Cloud diz 4, Kiro diz 2 (Equipe que já tem + Comercial Vendas).

8. **Naming "Comercial":** Se Ações JÁ é chamada de "comercial" pelo cliente,
   ter OUTRA tela chamada Comercial cria confusão. Alternativas: "Vendas & Pedidos"?
   "Negócios"? "Resultados"?

---

---
## 9. Consenso entre Cloud e Kiro

Apesar das divergências, AMBOS concordam em:

- bi.painel → matar
- bi.inteligencia → fragmentar e matar
- crm.negocios → matar
- crm.insights → matar
- crm.administrativo → admin
- tools.performance → não entregar
- Widgets zumbis de servicos → remover
- IA progressiva (1 card → medir → expandir)
- Tab-based layout para as novas telas
- Comercial absorve bi.comercial + bi.pedidos + bi.admin
- etl-monitor fica em admin
- Manter as 4 liberadas intactas (Ações, Equipe, Atividades, Visão Geral)

**Os pontos de discordância são 3:** (a) Operacional separado vs junto,
(b) Mapa/Críticos em Serviços vs Comercial, (c) bi.produtos mantém vs funde.

---
---

# ANÁLISE 3ª IA (ARBITRAGEM & PLANO DEFINITIVO)

> Auditoria realizada pela terceira LLM com base na leitura detalhada do código-fonte,
> dos contratos de dados (RPCs e views mirror), da arquitetura de componentes
> React e da experiência do usuário final do Ceres BI.

---

## 1. Veredito sobre os 8 Pontos de Debate

### Ponto 1: Quantas Telas Novas? (2 ou 3?)
**Veredito: 2 Telas Novas (com arquitetura balanceada e sem sobrecarga cognitiva).**
- **Por que a proposta Cloud de 2 telas falhou no detalhe:** Cloud empilhou 5 abas heterogêneas dentro de "Serviços" (misturando frota técnica com clientes comerciais sem contato e mapa geral).
- **Por que a proposta Kiro de 3 telas peca por fragmentação:** Kiro manteve 8 telas de negócio na sidebar (deixando `bi.operacional` e `bi.produtos` soltas), o que não atinge o objetivo do cliente de enxugar a navegação para um BI executivo de alto impacto.
- **A Solução Balanceada:** **2 Telas Novas com agrupamento semântico real por persona:**
  1. **"Vendas & Resultados"** (Comercial, Pedidos, Faturamento, Carteira, Mercado e Parque) → 3 abas.
  2. **"Pós-Venda & Serviços"** (Ordens de Serviço, SLA de Filiais e Operação Técnica/Frota) → 2 abas.

---

### Ponto 2: Onde Ficam "Mapa" e "Clientes Críticos"?
**Veredito: Não devem ir para Serviços nem virar abas inchadas na nova Comercial.**
- **Mapa:** A tela `/crm/mapa` deve ser **descontinuada**.
  - O mapa tático/operacional com clusters e pinos por oportunidade já está implementado e em produção dentro de `Ações` (`AcoesMapaOportunidades.tsx`).
  - O mapa estratégico nacional de cobertura já existe no componente `BrazilHeatmap` e entra na aba "Carteira & Mercado" da nova tela de Vendas. Ter uma 3ª tela de mapa é redundância pura.
- **Clientes Críticos:** A rota isolada `/crm/criticos` deve ser **descontinuada**.
  - Clientes sem contato comercial >90d com pipeline aberto é uma métrica 100% comercial e de ação imediata.
  - A tela `Ações` já tem o gráfico "Clientes em Risco" (faixas de dias sem contato). A ação correta é **restaurar o drill-down direto em Ações** (corrigindo a remoção da aba `sem_contato` feita na Story 2-A) ou abrir um modal focado de reativação com CTA para o consultor.

---

### Ponto 3: A tela "Ações" Precisa Emagrecer?
**Veredito: NÃO alterar o escopo funcional de Ações agora.**
- `Ações` é o cockpit comercial diário adotado pelo cliente e já validado em produção. O pedido inicial do cliente foi explícito para não desestabilizar as telas liberadas.
- Qualquer refatoração profunda em Ações no mesmo momento da consolidação das 14 outras telas introduz risco desnecessário de regressão.
- **Único ajuste em Ações:** Corrigir a interação de clique do gráfico "Clientes em Risco" para exibir a listagem dos clientes daquela faixa.

---

### Ponto 4: "Operacional" (Frota/Técnicos) Fica Standalone ou Vira Aba?
**Veredito: Vira a Aba 2 ("Operação Técnica & Frota") dentro de "Pós-Venda & Serviços".**
- No agronegócio e revendas de máquinas, Pós-Venda engloba Oficina (OS/SLA) e Atendimento em Campo (Frota/Técnicos/KM).
- Como `bi.servicos` perde 4 widgets zumbis sem dados, sua estrutura fica enxuta o suficiente para compor a Aba 1 ("Ordens de Serviço & SLA").
- A Aba 2 recebe integralmente os 6 KPIs e 4 gráficos de `bi.operacional` (Técnicos Ativos, KM, Utilização, Agenda).
- Ambas as abas atendem à mesma persona: **Gerência de Serviços e Pós-Venda**.

---

### Ponto 5: O que fazer com "bi.produtos" (Base Instalada)?
**Veredito: Fundir na Aba 3 ("Carteira & Mercado") de Vendas & Resultados.**
- `bi.produtos` possui apenas 72 linhas de código, 4 KPIs e 3 gráficos (Total Máquinas, Clientes com Parque, Grupos, Marcas e Modelos).
- Métricas de base instalada possuem frequência de consulta trimestral/semestral. Manter uma rota exclusiva na sidebar para 72 linhas polui o menu sem gerar tração.
- No agronegócio, máquinas no campo com mais de 5 anos são o maior gatilho para a equipe de vendas abordar renovação de maquinário.

---

### Ponto 6: Estratégia de IA (BI + IA com ROI Real)
**Veredito: 2 Fases Estruturadas de IA.**
- **Fase 1 (Imediata):**
  - Manter o resumo de IA existente em **Equipe** (`/crm/consultores`).
  - Adicionar **1 Card de IA em "Vendas & Resultados" (Aba 1)**: sintetiza conversão, velocidade de fechamento, principais motivos de perda da semana e desvios de ticket/bancos, gerando recomendações executivas para a diretoria comercial.
- **Fase 2 (Subsequente):**
  - Adicionar **1 Card de IA em "Pós-Venda & Serviços" (Aba 1)**: sintetiza gargalos de SLA por filial, técnicos sobrecarregados/ociosos e taxa de conclusão de agenda.

---

### Ponto 7: Naming das Telas para Eliminar Ambiguidade
**Veredito: Nomenclatura baseada no objetivo de negócio.**
- Como o cliente chama `Ações` informalmente de "comercial", nomear outra tela de "Comercial" geraria confusão operacional imediata.
- **Estrutura de Naming Recomendada:**
  - **Ações** (`/bi/acoes`) → Mantido (rotina e ação tática).
  - **Vendas & Resultados** (`/bi/comercial` ou `/bi/resultados`) → Análise macro de vendas, pedidos e mercado.
  - **Pós-Venda & Serviços** (`/bi/servicos`) → Atendimento, oficinas, SLA e técnicos de campo.
  - **Equipe** (`/crm/consultores`) → Desempenho individual e IA.
  - **Atividades** (`/crm/registros`) → Log operacional de registros.
  - **Visão Geral** (`/crm/overview`) → Snapshot executivo.

---

### Ponto 8: Sprint Sizing e Execução Técnica
**Veredito: Execução em 2 Sprints Incrementais.**
- **Sprint 1:**
  1. Criação da nova tela **Vendas & Resultados** (`/bi/comercial`) com 3 abas (Vendas, Pedidos, Carteira & Mercado) e card de IA.
  2. Criação da nova tela **Pós-Venda & Serviços** (`/bi/servicos`) com 2 abas (Ordens de Serviço & SLA, Operação & Frota).
  3. Remoção de widgets zumbis e desativação das rotas redundantes (`bi.painel`, `bi.inteligencia`, `crm.negocios`, `crm.insights`, `crm.criticos`, `crm.mapa`).
- **Sprint 2:**
  1. Rebaixamento de rotas administrativas para o grupo Configurações (`admin.etl-monitor`, `admin.auditoria`).
  2. Ajuste do drill-down de clientes em risco dentro de `Ações`.
  3. Ocultação do stub `tools.performance`.
  4. Validação de testes automatizados e permissões no Supabase (`app_modules`).

---

## 2. Desenho Arquitetural da Nova Sidebar

```
── BI & CRM (6 Módulos de Negócio) ───────────────────────
1. Visão Geral          → /crm/overview       (mantida — snapshot executivo)
2. Ações                → /bi/acoes           (mantida — cockpit operacional diário)
3. Vendas & Resultados  → /bi/comercial       (NOVA — 3 abas: Funil, Pedidos, Mercado) + IA
4. Pós-Venda & Serviços → /bi/servicos        (NOVA — 2 abas: OS & SLA, Operação Frota)
5. Equipe               → /crm/consultores    (mantida — ranking + IA consultor)
6. Atividades           → /crm/registros      (mantida — log detalhado de ações)

── CONFIGURAÇÕES & ADMIN (Apenas Administradores) ────────
7. Gerenciar Usuários   → /admin/users
8. Monitor ETL          → /admin/etl-monitor  (rebaixado do BI)
9. Auditoria            → /admin/auditoria    (rebaixado de crm.administrativo)
10. Meu Perfil          → /admin/profile

── TOOLS / SUPORTE (Power Users) ─────────────────────────
11. Explorador de Views → /tools/explorer
```

**Resultado:** Redução de **18 módulos dispersos para 6 telas de negócio limpas, densas e complementares**, com separação cristalina de permissões administrativas.

---

## 3. Matriz Comparativa Definitiva: Cloud vs Kiro vs 3ª IA

| Dimensão | Cloud | Kiro | 3ª IA (Arbitragem Definitiva) |
|---|---|---|---|
| **Telas Novas** | 2 telas | 3 telas | **2 telas (equilibradas)** |
| **Telas de Negócio na Sidebar** | 6 telas | 8 telas | **6 telas (alta densidade)** |
| **Comercial / Vendas** | 4 abas (muito densa) | 4 abas | **3 abas coesas** (Vendas, Pedidos, Carteira & Mercado) |
| **Serviços / Pós-Venda** | 5 abas (Frankenstein) | 2 abas | **2 abas por persona** (OS & SLA + Frota Técnica) |
| **Operacional (Frota/KM)** | Aba 1/5 em Serviços | Tela isolada | **Aba 2 em Pós-Venda** |
| **Base Instalada (`bi.produtos`)** | Funde em Comercial | Tela isolada (72 linhas) | **Funde na Aba Carteira & Mercado de Vendas** |
| **Mapa (`crm.mapa`)** | Joga em Serviços | Joga em Comercial | **Descontinua** (já existe em Ações + Heatmap BR) |
| **Clientes Críticos (`crm.criticos`)**| Joga em Serviços | Joga em Comercial | **Integra no fluxo de Ações** (drill de Risco) |
| **Tela Ações** | Mantém intacta | Força emagrecimento | **Mantém intacta** (corrige apenas drill de Risco) |
| **Estratégia de IA** | 4 telas de cara | 2 telas | **Fase 1: Equipe + Vendas; Fase 2: Pós-Venda** |
| **Naming de Comercial** | Mantém "Comercial" | Questiona sem definir | **"Vendas & Resultados"** (elimina ambiguidade com Ações) |



---

# 11. Plano de implementação — Fase 1: duas telas novas, telas estáveis preservadas

> **Decisão de escopo:** esta fase implementa somente as duas novas telas de negócio e a reorganização reversível da sidebar. As telas já liberadas — **Ações, Equipe, Atividades e Visão Geral** — não terão componentes, regras, métricas, filtros ou comportamento alterados nesta fase.
>
> A eliminação das sobreposições que hoje existem entre as telas estáveis será tratada em uma fase posterior, depois que as duas novas telas estiverem em produção e seu uso for validado. Isso reduz o risco de regressão nas telas já aprovadas pelo cliente.

## 11.1 Resultado da Fase 1

Ao fim desta fase, a sidebar de negócio exibirá seis entradas:

```text
Visão Geral             /crm/overview          — existente, sem alteração
Ações                   /bi/acoes              — existente, sem alteração
Vendas & Resultados     /bi/comercial          — nova composição em 3 abas
Pós-Venda & Serviços    /bi/servicos           — nova composição em 2 abas
Equipe                  /crm/consultores       — existente, sem alteração
Atividades              /crm/registros         — existente, sem alteração
```

A estratégia não cria uma terceira rota de negócio: reaproveita os caminhos já existentes e ainda não aprovados pelo cliente:

- `/bi/comercial` passa a ter o label **Vendas & Resultados**;
- `/bi/servicos` passa a ter o label **Pós-Venda & Serviços**.

Isso evita criar módulos, permissões e rotas paralelas que depois precisariam ser migrados. As páginas antigas que esses caminhos representam podem ser refatoradas porque não fazem parte das quatro telas estáveis.

## 11.2 Escopo fechado: o que não será mexido agora

| Tela estável | Regra da Fase 1 |
|---|---|
| `bi.acoes` — Ações | Nenhuma remoção, reorganização ou adição de widget. O mapa, a gestão de carteira, os gráficos e a tabela permanecem como estão. |
| `crm.consultores` — Equipe | Nenhuma alteração no ranking, nos drill-downs ou no card de IA existente. |
| `crm.registros` — Atividades | Nenhuma alteração na busca, debounce, tabela ou regras de expansão de período. |
| `crm.overview` — Visão Geral | Nenhuma remoção de cards/gráficos e nenhuma mudança no comportamento de resumo executivo. |

Também ficam fora desta fase:

- emagrecimento de Ações;
- remoção de gráficos repetidos entre Ações, Visão Geral e Equipe;
- consolidação funcional do mapa de `crm.mapa` dentro de Ações;
- restauração/implementação do drill-down completo de Clientes Críticos em Ações;
- mudanças de UX, filtros ou navegação interna nas quatro telas estáveis;
- exclusão física de código, rotas, módulos ou RPCs legados.

> **Ressalva assumida:** enquanto as telas estáveis permanecerem intactas, parte da sobreposição comercial já existente continuará temporariamente visível. Não criaremos uma tela redundante adicional; porém, eliminar toda repetição exigirá a Fase 2, que deliberadamente fica adiada para não colocar em risco o que o cliente já aprovou.

## 11.3 Nova tela 1 — Vendas & Resultados (`/bi/comercial`)

### Objetivo

Concentrar as telas BI não liberadas ligadas a resultado comercial, pedidos, carteira, mercado e parque instalado em uma única página com abas. A página substitui a exposição separada de `bi.comercial`, `bi.pedidos`, `bi.admin`, `bi.produtos` e os blocos comercial/financeiro/mercado de `bi.inteligencia`.

### Estrutura

| Aba | Componentes/origens a compor | Conteúdo da entrega |
|---|---|---|
| **Vendas** | `ComercialSection` | KPIs e análises de negócios, conversão, pipeline, ganhos/perdas, ciclo, esforço, funil, origem, motivos de perda, velocidade, evolução e ranking atualmente disponíveis na seção Comercial. |
| **Pedidos** | `PedidosSection` | Total, faturamento, ticket, aprovação, financiamento, cancelamentos, evolução, pagamento, situação, vendedores, cidades, grupos e marcas. |
| **Carteira & Mercado** | `AdminSection`, `ProdutosSection` e recortes exclusivos de `InteligenciaSection` | Carteira/ativos/prospects/cobertura/classificação, base instalada por grupo/marca/modelo, frota com mais de cinco anos e share por banco. Não duplicar nesta aba os visuais de funil, motivos de perda e mix de pagamento que já estão nas abas Vendas/Pedidos. |

### Filtros e semântica de dados

- **Vendas** e **Pedidos** usam o intervalo de datas selecionado, como fazem hoje suas respectivas seções.
- **Carteira & Mercado** precisa dividir visualmente dados de natureza diferente:
  - carteira e base instalada são uma **posição atual** e devem ser identificadas como tal;
  - indicadores financeiros/mercado que aceitam período devem informar o período aplicado.
- `ProdutosSection` e `AdminSection` atualmente ignoram `dateRange`; nesta fase não se deve sugerir ao usuário que o calendário os filtra. A evolução dessas RPCs para receber período é um backlog de dados, não uma suposição de interface.

### IA

- Adicionar somente **um card de IA** no topo da aba **Vendas**.
- O card deve analisar o conjunto de métricas da própria aba (conversão, pipeline, ciclo, perdas e evolução). Não deve chamar IA por aba nem duplicar a IA já existente em Equipe.
- IA de Pós-Venda fica explicitamente para a fase posterior, após medir engajamento e qualidade do card de Vendas.

## 11.4 Nova tela 2 — Pós-Venda & Serviços (`/bi/servicos`)

### Objetivo

Expor somente a operação técnica/frota efetivamente usada pelo CEM: técnicos, agenda e deslocamento de campo. Embora a rota preserve o nome **Pós-Venda & Serviços**, ela reutiliza apenas `bi.operacional` nesta fase.

> **Decisão de produto posterior ao plano inicial:** o CEM não usa Ordens de Serviço nem SLA. Portanto, `ServicosSection` e os recortes de SLA de `InteligenciaSection` não entram na composição nova. Eles permanecem como código/rota legados reversíveis e não são apagados nesta fase.

### Estrutura

| Conteúdo | Componente/origem | Entrega |
|---|---|---|
| **Operação Técnica & Frota** | `OperacionalSection` | Técnicos ativos, KM, utilização, ociosidade, eventos/conclusão de agenda, utilização/KM por técnico e agenda por status/tipo. |

### Filtros e semântica de dados

- **Operação Técnica & Frota** hoje consulta `useOperacionalBIRpc(active)` sem enviar `dateRange`. Na Fase 1, a página deve declarar **“posição operacional atual”** e não deve apresentar comparação por período inexistente.
- Caso a experiência exija calendário também para frota, a RPC deve primeiro ser ampliada para aceitar `from`/`to`; não é aceitável aplicar um filtro visual que não corresponde aos dados.

## 11.5 Estratégia da sidebar e dos módulos antigos

### Princípio: ocultar primeiro, excluir depois

A aplicação já controla a navegação por `app_modules`, `user_permissions`, `is_visible` e `ModuleGuard`. Na implementação atual, o label é lido de `app_modules`, enquanto a visibilidade individual da sidebar é materializada em **`user_permissions.is_visible`** — não existe `app_modules.is_visible`. Portanto, a migração não deve apagar código ou rotas assim que as duas telas forem entregues.

1. Construir e testar as novas composições sem ativá-las para todos.
2. Alterar os labels de `bi.comercial` e `bi.servicos` em `app_modules` e liberá-los para um grupo piloto.
3. Depois da validação, ocultar da sidebar os módulos incorporados configurando `user_permissions.is_visible = false` **somente para os usuários/perfis-alvo**.
4. Manter rotas, permissões e código legado acessíveis como fallback temporário por duas sprints.
5. Somente após uso estável, confirmar ausência de dependências e aprovar a Fase 2/descontinuação física.

**Runbook manual pós-QA (não executar antes do aceite):** atualizar os labels com `UPDATE app_modules SET label = ... WHERE id IN ('bi.comercial', 'bi.servicos')`; para cada usuário piloto, executar `UPDATE user_permissions SET is_visible = false WHERE user_id = '<piloto>' AND module_id IN (...)`. O rollback é o mesmo `UPDATE` com `is_visible = true`; `ModuleGuard` continua liberando a rota porque `canAccess()` verifica a permissão, não a visibilidade.

Esse desenho é reversível: se uma aba nova apresentar problema, basta restaurar `user_permissions.is_visible` dos módulos antigos; não há necessidade de rollback de banco, rota ou código.

### Matriz de navegação na migração

| Módulo/rota atual | Ação na Fase 1 | Situação após o go-live da nova sidebar |
|---|---|---|
| `bi.comercial` / `/bi/comercial` | Refatorar para a nova composição | **Visível**, label Vendas & Resultados |
| `bi.servicos` / `/bi/servicos` | Refatorar para a nova composição | **Visível**, label Pós-Venda & Serviços |
| `bi.pedidos` | Conteúdo incorporado à aba Pedidos | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `bi.admin` | Conteúdo incorporado à aba Carteira & Mercado | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `bi.produtos` | Conteúdo incorporado à aba Carteira & Mercado | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `bi.operacional` | Conteúdo incorporado à aba Operação Técnica & Frota | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `bi.inteligencia` | Visuais distribuídos nas novas abas | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `bi.painel` | Não é fonte da nova UI; já é redundante | **Ocultar da sidebar**, rota/código mantidos como fallback |
| `crm.negocios` | Não é fonte da nova UI; permanece para revisão posterior | **Ocultar da sidebar** após validação de uso, rota/código mantidos |
| `crm.insights` | Não é fonte da nova UI; permanece para revisão posterior | **Ocultar da sidebar** após validação de uso, rota/código mantidos |
| `crm.criticos` | Não migrar funcionalidade nesta fase, pois Ações não será alterada | **Manter oculto apenas se já não estiver em uso**; não excluir nem alegar substituição até a Fase 2 restaurar o drill-down de reativação em Ações |
| `crm.mapa` | Não migrar funcionalidade nesta fase, pois Ações não será alterada | **Manter oculto apenas se já não estiver em uso**; não excluir até a Fase 2 decidir e consolidar o mapa comercial |
| `crm.administrativo` | Sem alteração funcional | Restringir/organizar como auditoria administrativa em fase posterior |
| `bi.etl-monitor` | Sem alteração funcional | Restringir a admins e organizar no grupo Configurações em fase posterior |
| `tools.performance` | Sem entrega | Ocultar da sidebar; código pode permanecer até limpeza final |

> `crm.criticos` e `crm.mapa` são exceções importantes: não devem aparecer na nova sidebar de negócio, mas também não podem ser considerados funcionalmente substituídos nesta fase porque as telas estáveis não serão modificadas. A decisão de excluí-los fica para a Fase 2.

## 11.6 Sequência de execução

### Etapa 0 — Preparação segura

- Congelar o escopo das quatro telas estáveis.
- Registrar screenshots e comportamento atual delas para regressão visual.
- Criar feature flag/critério de permissão para liberar as duas novas composições apenas a administradores e usuários-piloto.
- Não atualizar `is_visible` dos módulos antigos antes do aceite das telas novas.

### Etapa 1 — Construir Vendas & Resultados

- Refatorar somente a página/seções ligadas a `bi.comercial`.
- Implementar as três abas e o carregamento sob demanda das abas inativas.
- Reutilizar hooks e componentes existentes antes de criar novas RPCs.
- Inserir o card único de IA da aba Vendas.
- Marcar explicitamente blocos de posição atual que ignoram período.

### Etapa 2 — Construir Pós-Venda & Serviços

- Refatorar somente a página/seções ligadas a `bi.servicos`.
- Implementar as duas abas.
- Remover da composição os quatro widgets zumbis.
- Reutilizar `OperacionalSection` sem alterar seu comportamento de dados.
- Comunicar que Operação Técnica & Frota representa o estado atual enquanto a RPC não recebe período.

### Etapa 3 — QA e reconciliação de dados

- Validar cada aba contra a página de origem correspondente: valores, filtros, loading, estados vazios e erros.
- Validar que Vendas/Pedidos/OS respondem ao intervalo correto.
- Validar que Carteira/Base Instalada e Operação não fingem responder ao período.
- Validar permissões de admin, usuário-piloto e usuário sem acesso.
- Executar testes de rota, navegação por aba e smoke test das quatro telas estáveis para provar que não sofreram mudança.

### Etapa 4 — Go-live reversível da sidebar

- Atualizar os labels dos dois módulos novos.
- Tornar visíveis `bi.comercial` e `bi.servicos` para os perfis acordados.
- Ocultar os módulos efetivamente incorporados conforme a matriz acima.
- Manter as rotas antigas como fallback por duas sprints e acompanhar acessos/erros.

## 11.7 Critérios de aceite da Fase 1

A fase só estará pronta quando:

1. As quatro telas estáveis não tiverem alterações funcionais ou visuais não intencionais.
2. Vendas & Resultados apresentar as três abas e Pós-Venda & Serviços as duas abas previstas.
3. Nenhum dos quatro widgets zumbis for renderizado.
4. A sidebar dos usuários-alvo exibir exatamente as seis telas de negócio acordadas.
5. Os módulos ocultados puderem ser reexibidos exclusivamente por configuração, sem deploy.
6. Nenhuma rota ou módulo legado tiver sido fisicamente removido.
7. Dados dependentes de período e dados de posição atual estiverem identificados corretamente.
8. A Fase 2 estiver registrada como backlog, sem ser implementada de forma incidental.

## 11.8 Backlog explícito — Fase 2, somente após estabilização

- Eliminar sobreposições entre Ações, Equipe, Atividades, Visão Geral e Vendas & Resultados.
- Restaurar a lista/drill-down funcional de Clientes Críticos dentro de Ações antes de remover definitivamente `crm.criticos`.
- Consolidar ou encerrar `crm.mapa` somente depois de decidir qual informação regional precisa existir no mapa de Ações.
- Avaliar a remoção da tabela detalhada duplicada entre Ações e Atividades, com deep-link entre elas.
- Evoluir RPCs de Operacional, Produtos e Carteira caso o produto exija filtros históricos reais.
- Rebaixar Monitor ETL e Auditoria para Configurações e limpar fisicamente rotas, permissões, módulos e código legado após o período de fallback.
- Considerar o card de IA de Pós-Venda & Serviços com base no uso e feedback da IA em Vendas.
