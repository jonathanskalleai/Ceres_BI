# Análise de Views + Descoberta de KPIs

## Objetivo
Varrer as ~29 views disponíveis no SQL Server, entender o que cada uma oferece de fato (não só pelo nome), mapear relacionamentos (joins possíveis) e propor uma lista priorizada de **KPIs novos** que hoje não existem no BI — usando como referência os KPIs já implementados em `BiPainel` (Negócios, Pedidos, Clientes, Serviços, Cross).

Esta entrega é **um documento de análise + um backlog priorizado**, não código de produção ainda. Depois que você aprovar quais KPIs entram, criamos hooks/services/cards numa segunda rodada.

## Etapa 1 — Coleta automatizada (sample de 10 por view)

Script Node/TS rodado localmente que:
- Itera as 29 views listadas em `DashboardViewExplorer.tsx`.
- Para cada view: chama `querySqlServer({ view, limit: 10 })` + `count_only` para ter o volume total.
- Salva tudo em `docs/analise-views/raw/<view>.json` (10 linhas + total + lista de colunas com tipo inferido).

Vantagem: usa exatamente o mesmo edge function que o explorer já usa, então não inventa nada de schema.

## Etapa 2 — Mapa de relacionamentos

A partir do sample, identificar chaves comuns entre views (heurística por nome de coluna + valores reais):

```text
Acoes ──ACO_idCliente──┐
Negocios ──NGO_idCliente──┼──> CarteiraClientes (CLI_idCliente)
Pedidos ──PDO_idCliente──┘                          │
                                                    ├──> ParqueMaquinas
                                                    ├──> Propriedade
                                                    └──> Contatos

Negocios ──NGO_Numero──> Pedidos ──PDO_Numero──> PedidosItem ──> Produtos
                                                                 ├─ Grupo
                                                                 ├─ Marca
                                                                 └─ Modelo
Negocios ──NGO_idNegocio──> Negocios_Etapas ──> FunilEtapa
Acoes/Negocios/Pedidos ──> TAGX{ACAO,CLIENTE,NEGOCIO,PEDIDO}
OrdemServico ──OS_idCliente──> Cliente; ──> AtendimentoOS, TecnicoTempo, Ocorrencias
```

Saída: `docs/analise-views/relacionamentos.md` com diagrama ASCII + tabela "view A × view B × chave × força".

## Etapa 3 — Inventário de KPIs atuais

Listar o que já existe (de `usePainelKPIs`, `usePedidosKPIs`, `useClientesKPIs`, `useServicosKPIs`, `useCrossKPIs`, dashboards CRM) para **não duplicar**. Saída resumida no doc.

## Etapa 4 — Backlog de KPIs novos (priorizado)

Para cada KPI proposto:
- Nome, fórmula, view(s) de origem, joins necessários
- Por que é útil (insight de negócio)
- Esforço (S/M/L) e dependências (ex.: precisa de `PedidosItem` que ainda não consumimos)
- Em qual página BI ele entra (Painel, Pedidos, Serviços, Produtos, Inteligência…)

Áreas onde já há sinais de KPIs faltando, com base nas views não consumidas:

1. **Funil real** (`Negocios_Etapas` + `FunilEtapa`) — tempo médio por etapa, etapa que mais perde, conversão etapa→etapa, gargalo.
2. **Produtos / Mix** (`PedidosItem` + `Produtos`/`Grupo`/`Marca`/`Modelo`) — top produtos vendidos, mix por marca, ticket por categoria, margem por grupo, share de usado vs novo.
3. **Pós-venda profundo** (`OrdemServico` + `AtendimentoOS` + `TecnicoTempo` + `Ocorrencias`) — SLA, reincidência, produtividade de técnico (h faturáveis / h totais), TOP ocorrências, MTTR por tipo de máquina.
4. **Cliente 360** (`CarteiraClientes` + `ParqueMaquinas` + `Propriedade`) — share-of-wallet, clientes sem ação X dias, potencial por hectare/qtd máquinas, cobertura por safra.
5. **Tags** (`TAGX*`) — segmentação de clientes/negócios por tag, performance por tag.
6. **Agenda** — taxa de cumprimento, agenda futura vs realizada, no-show.
7. **Estoque virtual** — cobertura de estoque vs pipeline, dias de estoque, produtos parados.
8. **Cross-views** — receita por m²/hectare de propriedade, parque de máquinas vs OS abertas (saúde da base), tempo entre 1ª ação → 1ª venda (lead-to-cash real).

## Etapa 5 — Entregáveis

```text
docs/analise-views/
  ├── raw/<view>.json              (sample bruto, 10 linhas)
  ├── inventario-colunas.md        (todas as colunas, tipos, volume)
  ├── relacionamentos.md           (mapa de joins)
  ├── kpis-existentes.md           (o que já temos)
  └── kpis-propostos.md            (backlog priorizado, S/M/L)
```

Ao final apresento um resumo no chat com os top 10 KPIs recomendados para você dar GO/NO-GO antes de eu implementar.

## Fora de escopo desta etapa
- Implementar hooks/services/cards dos novos KPIs (próxima rodada, depois da sua escolha).
- Mudar dashboards existentes.
- Criar novas views no SQL Server.

## Pergunta antes de aprovar
Posso rodar o script de coleta usando o `query-sqlserver` em produção (29 views × 1 request cada = ~58 chamadas leves, `limit=10`)? Ou prefere que eu use apenas os samples que já estão acessíveis via Explorer e trabalhe a análise sobre os nomes/colunas conhecidos sem coleta nova?
