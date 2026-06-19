# Análise de Views SQL Server + Descoberta de KPIs

Análise feita a partir de sample real (10 linhas × 29 views) coletada via `scripts/sample-views.ts`.

## Documentos

1. **[inventario-colunas.md](./inventario-colunas.md)** — todas as views, colunas, tipos e volume.
2. **[relacionamentos.md](./relacionamentos.md)** — mapa de joins (diagrama + tabela).
3. **[kpis-existentes.md](./kpis-existentes.md)** — o que o BI já mede hoje.
4. **[kpis-propostos.md](./kpis-propostos.md)** — backlog de 30 KPIs novos, priorizado P0/P1/P2.
5. **[raw/](./raw/)** — JSON com sample bruto por view.

## TL;DR

- Hoje o BI consome **5 de 29 views**.
- Em `Negocios` usamos **~14 de 92 colunas** — sobra muito (motivos de perda/ganho, campanha, canal, concorrente, probabilidade, ciclo já calculado…).
- **6 KPIs P0 (todos esforço S)** podem ser entregues numa sessão usando colunas já carregadas — sem precisar de view nova.
- **4 KPIs P1** (funil real, mix de produto, concorrência, utilização técnico) destravam módulos inteiros (Pipeline, Produtos, Operacional).

## Próximo passo

Validar com você quais entram na próxima onda — ver "Top 10 recomendados" em `kpis-propostos.md`.
