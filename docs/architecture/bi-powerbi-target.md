# Arquitetura-alvo do Ceres BI — modelo Import/Composite

## Diagnóstico

O gateway FastAPI já isolou o navegador e centralizou autenticação, limites,
cache e telemetria. Isso não era suficiente para reproduzir o comportamento de
uma plataforma de BI: as RPCs ainda recalculavam joins sobre `mirror` durante a
navegação.

O PostgreSQL de produção possui as tabelas sincronizadas no schema `mirror`,
mas não possuía um schema físico de leitura `bi`, tabelas agregadas ou um
manifesto de publicação. A dificuldade vinha da recomposição repetida, não de
milhões de linhas.

## Desenho

```text
ERP / SQL Server
      ↓
ETL Python incremental + janela de overlap + reconciliação
      ↓
mirror (dados canônicos sincronizados)
      ↓
bi (read models diários e mensais)
      ↓
refresh_manifest + versão publicada
      ↓
FastAPI semântica, cache e paginação
      ↓
React: filtros, estado visual e renderização
```

Os princípios equivalentes ao Power BI são:

- **Import:** histórico servido de agregados físicos `bi.*_daily`/mensais;
- **DirectQuery controlado:** drill-down limitado consulta fatos no PostgreSQL;
- **Composite/Hybrid:** período recente é atualizado incrementalmente e o
  histórico permanece estável em agregados;
- **Query reduction:** uma chamada semântica por bloco de dashboard, com
  filtros aplicados explicitamente;
- **Refresh:** ETL e publicação ocorrem fora do request do usuário;
- **Paridade:** RPCs antigas permanecem como fallback até a comparação dos
  valores novo versus legado.

## Entrega estrutural atual

- schema `bi` criado;
- read models `acoes_daily`, `negocios_daily`, `pedidos_daily` e
  `servicos_daily` criados com índices de filtro;
- `bi.refresh_read_models` idempotente, com lock, janela de dados e manifesto;
- worker periódico separado do processo HTTP;
- role de refresh separada da role read-only da API;
- rota protegida para ler modelos físicos sem SQL dinâmico do usuário.

## Critérios para a migração completa das telas

Cada dashboard só sai do caminho RPC legado quando cumprir:

1. o read model cobre todos os KPIs e dimensões da tela;
2. o resultado novo bate com o legado e com a origem;
3. p95 normal fica abaixo de 3 s e pesado abaixo de 5 s;
4. o payload é paginado ou agregado;
5. refresh, idade e falhas aparecem no manifesto;
6. existe rollback por feature flag;
7. o frontend não executa join, soma financeira ou agrupamento de fatos.

As RPCs existentes não serão removidas antes de a paridade de cada tela ser
comprovada. Isso evita trocar lentidão por números incorretos.
