# Handoff: Sessão F — Ajuste de Filtros de Data + Integração Filtro Global

**Data:** 2026-06-25  
**Branch:** `perf/bi-quick-wins`  
**Último commit:** f490756  
**Status:** PLANEJADO — não iniciado

---

## Contexto

O BI tem um filtro global de data no topo que deveria funcionar para todas as telas. Problemas identificados:

1. **BiServicos** usa estado local (não responde ao filtro global)
2. Cada RPC filtra por campos de data diferentes — nem todos são "conclusão"
3. Cliente validou quais campos usar

---

## Decisões do Cliente

| Tela | Campo de data para filtro | Observação |
|------|--------------------------|------------|
| **Ações** | `aco_dthconclusao` | ✅ Já é o que usa. Manter. |
| **Negócios (BI Comercial)** | `ngo_datacadastro` | ⚠️ MUDAR — hoje usa `ngo_datafechamento`. Cliente quer por data de abertura/cadastro do negócio |
| **Pedidos** | Filtrar por status `ganho` (quando o negócio vira ganho = pedido OK) | ⚠️ Precisa investigar: qual campo/coluna indica "ganho"? Provavelmente JOIN com `crm_negocios.ngo_conclusao = 'Ganho'` + data do pedido |
| **Serviços** | (não definido ainda) | Manter `os_dthabertura` por enquanto |

---

## Tarefas para Sessão F

### 1. Integrar BiServicos com filtro global
- Mudar `src/pages/bi/BiServicos.tsx` para usar `useNegociosFilter()` em vez de estado local
- Mesmo padrão de BiComercial

### 2. Alterar rpc_negocios_bi: ngo_datafechamento → ngo_datacadastro
- Mudar WHERE de `ngo_datafechamento::date BETWEEN p_from AND p_to` para `ngo_datacadastro::date BETWEEN p_from AND p_to`
- **Impacto:** negócios em andamento agora aparecem (antes só apareciam os concluídos no período)
- Verificar se a lógica de KPIs ainda faz sentido com essa mudança (ex: cicloMedioDias depende de ter datafechamento preenchida)

### 3. Investigar filtro de Pedidos por "status ganho"
- O cliente quer ver pedidos apenas de negócios com conclusão "Ganho"
- Verificar: `rpc_pedidos_bi` já filtra por situação do pedido? Ou precisa JOIN com crm_negocios?
- Campos relevantes em `crm_pedidos`: `pdo_dthpedido`, `pdo_dthaprovacao`
- Regra do cliente: "quando coloca como ganho = pedido OK, assinado"
- Pode ser que o filtro seja: `pdo_dthpedido` (data do pedido) WHERE negócio = ganho

### 4. Filtro global: persistir ou resetar entre abas?
- **Decisão pendente** — manter comportamento atual (persiste) até cliente definir
- Se mudar para "reseta por aba": cada tela precisa default próprio

---

## Dados de referência

- Mapa completo de campos: `docs/data-map-campos-data.md`
- Tabela `mirror.ordens_servico`: apenas 147 registros, última abertura 2026-04-13
  - ETL funciona OK (sync hoje) — são os dados que existem na origem
  - Verificar com suporte Campo Dealer se view `VW_Ceres_OrdemServico` tem filtro restritivo

---

## Infraestrutura

- **Repo:** `git@github.com:jonathanskalleai/Ceres_BI.git`
- **Branch:** `perf/bi-quick-wins`
- **PR:** #2 (open)
- **VPS BI:** 178.238.235.203
- **Container DB:** `supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm`
- **Schema reload:** `docker kill --signal=SIGUSR1 $(docker ps -q -f name=supabase_rest)`
