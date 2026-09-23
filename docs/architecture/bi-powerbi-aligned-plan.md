# Plano arquitetural do BI — princípios Power BI aplicados ao Ceres

**Status:** proposta para execução por fases  
**Data:** 2026-09-23  
**Escopo:** todas as dashboards do Ceres BI, com Ações como primeiro canário

## Decisão executiva

O Ceres não deve tentar reproduzir o Power BI como produto. Deve reproduzir os
princípios que tornam o Power BI previsível: modelo semântico, consultas
foldadas para a fonte, agregações, redução de consultas, cache e separação entre
dados quentes e históricos.

O navegador não será um motor de ETL ou de cálculo financeiro. Python fará
ingestão, normalização, reconciliação e snapshots assíncronos. PostgreSQL fará
joins, filtros e agregações. A API entregará contratos de indicadores e o React
apenas apresentará esses contratos.

## Referência Power BI → Ceres

| Princípio Power BI | Implementação Ceres |
|---|---|
| Import | Read models e snapshots agregados no PostgreSQL |
| DirectQuery | FastAPI → PostgreSQL para dados recentes ou drill-down paginado |
| Composite/Hybrid | Histórico em snapshots + janela recente em fatos/RPCs |
| Query folding | Filtros, joins e agregações executados no PostgreSQL |
| Aggregations | Tabelas `dashboard_*_daily/monthly` e agregações canônicas |
| Query reduction | Aplicar filtros explicitamente, debounce e menos fan-out |
| Semantic model | DTOs versionados por dashboard/indicador |
| Performance Analyzer | Instrumentação de `query_ms`, `db_ms`, `payload_bytes`, cache e snapshot |

O Power BI recomenda Import quando possível, DirectQuery quando há necessidade
de atualidade ou volume, e composição híbrida quando o histórico pode ser
cacheado e apenas a janela quente precisa ser consultada na origem. Essa é a
mesma estratégia que adotaremos, com PostgreSQL e FastAPI no lugar do motor
semântico do Power BI. [DirectQuery e modos de conexão](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-directquery-about), [modos de modelo semântico](https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand)

## Arquitetura-alvo

```text
ERP / API / SQL Server
          |
          v
ETL Python + staging + reconciliação retroativa
          |
          v
Fatos e dimensões canônicas no PostgreSQL
          |
          +--> read models / snapshots / agregações
          |
          v
FastAPI: auth + filtros + semântica + cache + limites + métricas
          |
          v
React: estado visual, gráficos e tabelas paginadas
```

O Supabase self-hosted permanece temporariamente para autenticação e serviços
existentes. Ele não deve ser o caminho obrigatório das consultas analíticas.
Não haverá um segundo banco nesta etapa.

## Estado conhecido do Ceres

- Existe um único PostgreSQL, dentro do stack Supabase self-hosted da VPS.
- O ETL Python alimenta o schema `mirror`; não devemos duplicar esse banco.
- O frontend ainda usa várias RPCs/PostgREST e mantém caminhos legados que
  precisam ser inventariados antes de qualquer remoção.
- O gateway FastAPI possui uma borda genérica allow-listada para todas as RPCs
  das dashboards inventariadas. Ações também mantém endpoints especializados
  para o batch dos blocos críticos. Tudo está protegido por
  `VITE_BI_API_ENABLED=false`; ainda não foi colocado em canário.
- A medição anual aquecida das quatro RPCs principais de Ações ficou em cerca
  de 1,72 s se executada em série: core ~0,78 s, detalhe ~0,34 s, funil ~0,30 s
  e mapa ~0,30 s. O mapa retornou aproximadamente 214 KB.
- Esses números não representam o p95 da página. Ainda faltam tempo de rede,
  autenticação, consultas auxiliares, parsing e renderização no navegador.

A consequência é importante: não há evidência para reescrever tudo ou criar
snapshots de todos os domínios agora. Há evidência para reduzir fan-out, medir a
página ponta a ponta e materializar somente os caminhos que continuarem acima
da meta depois das correções SQL.

## Fases de execução

### Fase 0 — inventário e baseline

Antes de substituir consultas, catalogar todas as telas, hooks, RPCs, tabelas,
joins, filtros e cálculos executados no React.

Para cada endpoint e dashboard, registrar:

```text
dashboard, endpoint, filtros, query_ms, db_ms, api_ms, frontend_ms,
p50, p95, p99, linhas_lidas, linhas_retornadas, payload_bytes,
cache_hit, snapshot_at, status
```

Critério de saída: cada dashboard tem uma fonte de verdade, um contrato de
indicadores e uma medição reproduzível mensal e anual.

### Fase 1 — correções SQL de baixo risco

- analisar `EXPLAIN (ANALYZE, BUFFERS)` dos endpoints mais lentos;
- eliminar funções sobre colunas indexadas e casts nos joins;
- tornar filtros de data sargáveis;
- remover joins repetidos e CTEs materializadas sem necessidade;
- limitar rankings, listas e drill-down no banco;
- preservar a semântica atual com testes de paridade.

Não adicionar índice sem evidência de plano e seletividade.

### Fase 2 — modelo canônico e read models

Definir dimensões compartilhadas (`date`, filial, cliente, vendedor, cidade,
status) e fatos por domínio. Depois criar read models somente para combinações
de filtros usadas de fato, por exemplo:

```text
dashboard_acoes_daily
dashboard_negocios_daily
dashboard_pedidos_daily
dashboard_inadimplencia_daily
dashboard_dre_monthly
```

O ETL deve atualizar staging, reconciliar os últimos meses e publicar a versão
do snapshot. O dashboard continua servindo o snapshot anterior enquanto o novo
é calculado.

Contrato mínimo:

```json
{
  "data": {},
  "snapshot_at": "2026-09-23T18:00:00Z",
  "status": "ready",
  "is_stale": false,
  "version": "etl-2026-09-23-1800"
}
```

### Fase 3 — API semântica, cache e limites

Endpoints devem representar indicadores, não tabelas:

```text
GET /api/bi/acoes
GET /api/bi/negocios
GET /api/bi/pedidos
GET /api/bi/inadimplencia
GET /api/bi/dre
```

Cada endpoint deve impor schema de filtros, período máximo quando aplicável,
paginação, top-N, limite de payload, timeout e autorização. O cache deve usar
dashboard + filtros normalizados + tenant/usuário quando necessário, com
invalidação após ETL/reconciliação e coalescência de requisições iguais.

### Fase 4 — frontend orientado a query reduction

- botão **Aplicar filtros** para consultas pesadas;
- debounce para busca textual;
- manutenção dos dados anteriores enquanto a nova resposta carrega;
- skeleton e estado parcial por bloco;
- paginação e virtualização de tabelas;
- nenhuma agregação financeira de fatos no React;
- nenhuma consulta pesada por clique de checkbox;
- feature flags por dashboard para rollback.

### Fase 5 — observabilidade e carga

Testar sem filtro, mês, ano, filial, vendedor, múltiplos filtros, troca rápida,
cache frio/quente, falha parcial, snapshot em atualização e concorrência de 2,
10 e mais usuários.

Monitorar p50/p95/p99, timeout, erro, cache hit/miss, payload, linhas lidas,
CPU, memória, temporários e idade do snapshot.

### Fase 6 — paridade e reconciliação

Para cada indicador, comparar consulta antiga, nova API, staging e origem nos
períodos atual e anterior. Validar especialmente recebidos, pagos, cancelados,
abertos, IDs, títulos, filiais e status.

Uma otimização só passa se os números forem iguais ou se a diferença estiver
documentada e aprovada como correção de regra.

### Fase 7 — publicação progressiva

1. local e testes;
2. benchmark local;
3. imagem/release;
4. uma instância ou rota de canário;
5. smoke autenticado e validação de dados;
6. medição comparativa;
7. habilitação gradual da flag;
8. promoção para os demais clientes.

Nenhuma publicação deve ocorrer antes da role PostgreSQL dedicada, RLS/ACL,
EXECUTE mínimo das RPCs e benchmark autenticado estarem comprovados.

## Metas de aceite

- p95 de dashboard normal abaixo de 3 s;
- p95 de dashboard pesada abaixo de 5 s;
- nenhuma consulta normal dependendo de timeout elevado;
- payload padrão preferencialmente abaixo de 200 KB;
- rankings e listas sempre limitados/paginados;
- zero fato bruto desnecessário no navegador;
- paridade comprovada com a fonte;
- mesma release para múltiplos clientes, com configuração versionada;
- rollback por feature flag e por versão de snapshot.

Essas metas são critérios de engenharia, não promessa de ganho. O percentual de
melhoria só será declarado depois do baseline e do benchmark pós-mudança.

## Ordem recomendada para o Ceres

1. Ações: consolidar fan-out atual e validar mapa/pinos/tiles.
2. Negócios e Pedidos: separar KPIs, funil e tabelas paginadas.
3. Painel comercial: reutilizar read models e dimensões comuns.
4. Inadimplência, DRE e FPD: snapshots mensais/diários assíncronos.
5. Serviços/Atendimento: migrar fontes legadas somente após inventário e
   contrato de dados.

## Pacotes imediatos de trabalho

### WP0 — catálogo e telemetria

**Mudança:** gerar inventário versionado de tela → hook → endpoint/RPC → tabela,
e instrumentar tempo de API/banco, payload, request ID e cache.  
**Arquivos afetados:** serviços em `src/services/bi`, hooks em `src/hooks/bi`,
`bi-service` e documentação de features.  
**Risco:** baixo; instrumentação não pode registrar token, PII ou SQL com dados.  
**Rollback:** desligar middleware/métricas mantendo as rotas atuais.  
**Aceite:** 100% das telas liberadas aparecem no catálogo e têm baseline mensal
e anual reproduzível.

### WP1 — canário da API de Ações

**Mudança:** provisionar role PostgreSQL exclusiva, grants mínimos, imagem do
gateway e rota de canário; manter frontend antigo como fallback.  
**Arquivos afetados:** `bi-service`, `docker-stack.yml`, pipeline de deploy e
configuração segura da VPS.  
**Risco:** RLS/ACL e funções `SECURITY DEFINER`; uma conexão direta não recebe
automaticamente `auth.uid()`.  
**Rollback:** `VITE_BI_API_ENABLED=false` e remoção da réplica de canário.  
**Aceite:** 401 sem token, 403 sem permissão, sucesso com usuário autorizado,
paridade dos quatro blocos e zero uso do usuário `postgres` pela API.

### WP2 — redução de fan-out de Ações

**Mudança:** medir todas as chamadas da página e consolidar somente blocos que
compartilham o mesmo grão/filtro. Não criar uma RPC gigante para tudo.  
**Arquivos afetados:** contrato FastAPI, consultas SQL canônicas e hooks de
Ações.  
**Risco:** misturar semânticas de ação, negócio e pedido.  
**Rollback:** endpoints separados por bloco e flag atual.  
**Aceite:** mesma saída visual, mesmos valores e redução comprovada de requests,
p95 e bytes.

**Implementação local concluída:** a rota autenticada
`GET /api/bi/acoes/batch` executa core e funil em paralelo e retorna um envelope
`ok`, `partial` ou `error` sem fabricar zeros. O scheduler do frontend coalesce
as chamadas core/funil da mesma onda de filtros; quando só um bloco é solicitado,
mantém a rota individual para não dobrar a carga do banco. A flag continua
desligada por padrão e a redução de requests só será habilitada no canário após
paridade autenticada. A rota BI também passa por compressão HTTP no Traefik;
`payload_bytes` continua medindo o JSON antes da compressão para que o baseline
seja comparável entre ambientes.

### WP3 — mapa de Ações

**Mudança:** reduzir o payload de pinos, avaliar projeção mínima, coordenada
canônica e consulta por viewport/cluster quando o volume exigir.  
**Arquivos afetados:** RPC/read model do mapa, DTO e componente de mapa.  
**Risco:** perder pinos, cores, popup ou fundo de tiles; todos já foram falhas
reais.  
**Rollback:** endpoint atual de mapa.  
**Aceite:** mesmos pinos e metadados, tiles visíveis, payload preferencialmente
abaixo de 200 KB e erro do mapa isolado do restante da dashboard.

### WP4 — decisão de read model

**Mudança:** criar snapshot/read model somente para consultas que continuem
acima da meta após WP2/WP3.  
**Arquivos afetados:** migrations, ETL Python, controle de snapshot e API.  
**Risco:** dados desatualizados ou diferença de grão.  
**Rollback:** consulta canônica direta enquanto o snapshot é reconstruído.  
**Aceite:** paridade, versão/freshness expostos, atualização retroativa e
dashboard disponível durante refresh.

### WP5 — migração comum de todas as dashboards

**Mudança:** usar `POST /api/bi/rpc/{rpc_name}` como borda única para as RPCs
  read-only de Painel, Comercial, Pedidos, Produtos, Serviços, Operacional,
  Admin, Ações, Inteligência, ETL Monitor e Desempenho. O catálogo no backend
  valida nome, parâmetros, limites e datas; o módulo de permissão é resolvido
  antes da execução. `invokeBiRpc` no frontend mantém a chamada Supabase apenas
  como fallback até o canário passar.
**Arquivos afetados:** `bi-service/catalog.py`, `bi-service/main.py`,
  `src/services/bi/biRpcService.ts`, serviços/hooks de BI, inventário e runbook.
**Risco:** uma assinatura incorreta ou grant ausente pode afetar mais de uma
  tela; por isso a flag fica desligada e os parâmetros seguem as assinaturas
  introspectadas no PostgreSQL de produção.
**Rollback:** desligar `VITE_BI_API_ENABLED`; o fallback legado permanece sem
  alteração de contrato visual.
**Aceite:** cada rota inventariada tem uma RPC catalogada, envelope estável,
  telemetria e teste de validação; depois, canário autenticado comprova
  paridade por dashboard antes de habilitar a flag.

## Riscos que precisam permanecer explícitos

- Conexão direta do FastAPI não carrega automaticamente `auth.uid()`; RLS e
  autorização precisam de desenho próprio para a role do serviço.
- As RPCs atuais são referência de paridade, não garantia de bom plano.
- Reconciliação precisa cobrir alterações retroativas e exclusões na origem.
- Cache não pode misturar clientes, usuários ou períodos.
- Supabase não deve ser removido antes de autenticação e demais dependências
  terem caminho equivalente.

## Referências oficiais

- [DirectQuery no Power BI](https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-directquery-about)
- [Orientação de modelos DirectQuery](https://learn.microsoft.com/en-us/power-bi/guidance/directquery-model-guidance)
- [Modos de armazenamento do modelo](https://learn.microsoft.com/en-us/power-bi/connect-data/service-dataset-modes-understand)
- [Query folding](https://learn.microsoft.com/en-us/power-query/query-folding-basics)
