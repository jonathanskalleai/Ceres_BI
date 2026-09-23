# Plano de melhoria e entrega do Ceres BI

**Data:** 22/09/2026
**Status:** Plano técnico para execução em branch/preview; nenhuma mudança de produção autorizada por este documento.
**Base:** [auditoria de capacidade, performance e resiliência](../audits/2026-09-22-bi-capacity-resilience.md)

## 1. Resultado que precisa ser entregue

O produto deve ser confiável em quatro dimensões ao mesmo tempo:

1. **Verdade dos dados:** zero real não pode ser confundido com erro, timeout,
   ausência ou resposta parcial.
2. **Resiliência:** uma resposta inválida afeta somente o cartão, gráfico,
   tabela ou mapa correspondente; a rota continua utilizável.
3. **Desempenho previsível:** o primeiro KPI aparece cedo, detalhes pesados não
   bloqueiam a tela e uma janela anual não transforma o navegador em um estado
   de carregamento infinito.
4. **Operação recuperável:** cada falha tem request id, métrica, alerta,
   retry controlado e rollback conhecido.

Isso é maior que “deixar uma RPC mais rápida”. É uma entrega de produto com
contratos, orçamento de consultas, validação de dados, observabilidade e
aceite do cliente.

## 2. Arquitetura real verificada

O nome correto para a infraestrutura é **PostgreSQL self-hosted na VPS
178.238.235.203**. Não é Supabase Cloud. A VPS executa componentes self-hosted
que fornecem PostgREST, autenticação e gateway; eles estão ativos e não devem
ser removidos como “lixo” sem prova de que não são usados.

```text
React/Vite (dashboards)
  └─ @supabase/supabase-js → Kong/PostgREST → RPCs → PostgreSQL (mirror/public)

FastAPI Python (/api/ai)
  └─ psycopg2 → PostgreSQL       (IA, relatórios e agente; não é o caminho
                                  principal das RPCs dos dashboards)

ETL/ops
  └─ atualiza mirror e metadados de sincronização
```

Evidência operacional da sessão: `ceresbi_web`, `ceresbi_ai` e
`supabase_supabase_db` estavam ativos na VPS; o acesso administrativo foi feito
por `ceres-prod`, como `ceres-admin`, na porta `2222`. O caminho crítico das
telas BI é, portanto, PostgreSQL/RPC/PostgREST e navegador. Otimizar somente o
Python não corrige a latência principal.

## 3. Baseline comprovado e limites da medição

As medições abaixo são amostras reais de produção, não um p95 de carga formal:

| Indicador | Evidência atual |
|---|---:|
| Desempenho anual | 3.516 nós DOM / 541 KB de HTML |
| Ações | 4.349 nós DOM / 581 KB de HTML |
| Fan-out inicial de Ações | aproximadamente 11 RPCs |
| Fan-out do Painel | aproximadamente 10–14 chamadas |
| `rpc_resultados_negocios_bi` YTD | ~1,19 s no banco |
| `rpc_resultados_negocios_bi` multi-ano | ~8,74 s; picos de ~9,3 s |
| `rpc_acoes_mapa_oportunidades` | ~232 KB / 702 pinos |
| Recarga problemática | shell por ~7 s + timeout de perfil observado |

A medição de sessões PostgreSQL não mostrou saturação contínua no instante da
coleta. Isso não autoriza concluir que nunca existe fila em horário de pico;
por isso a primeira fase precisa produzir p50/p95/p99 separados em navegador,
gateway e banco.

## 4. Contrato de dados: zero não é erro

### 4.1 Semântica obrigatória

| Situação | Estado exibido | Valor permitido |
|---|---|---|
| Consulta válida com resultado zero | `ok` | `0` validado pelo domínio |
| Consulta válida sem linhas | `ok` + empty state | `[]`, `null` semântico ou “sem dados” |
| Consulta em andamento | `loading`/`refreshing` | manter último dado válido |
| Timeout, 401, 5xx ou indisponibilidade | `error` | não substituir por zero |
| Contrato parcial/inválido/`NaN` | `partial` ou `error` | isolar o widget e permitir retry |

### 4.2 Envelope de transição

Cada service deve adaptar a resposta para um envelope versionado, mesmo que a
RPC legada continue retornando JSON puro durante a migração:

```ts
type WidgetResult<T> = {
  status: "ok" | "partial" | "error";
  data: T | null;
  issues: Array<{ path: string; code: string }>;
  fetchedAt: string;
  requestId: string;
  schemaVersion: string;
};
```

Na primeira release, a validação pode ficar no adaptador TypeScript (Zod ou
validador equivalente), sem quebrar todas as RPCs de uma vez. Depois, as RPCs
críticas podem ganhar contratos `v2` com metadados e paginação. Nenhum campo
numérico pode chegar ao gráfico sem ser finito; latitude/longitude inválidas
devem ser descartadas e contabilizadas como `semCoordenada`.

## 5. Plano técnico de melhoria

### F0 — Baseline, contratos e inventário (1–2 dias após acesso ao ambiente)

- Mapear cada tela → hook → service → RPC → tabelas/índices → payload.
- Confirmar quais migrations SQL estão efetivamente na VPS. O repositório tem
  migrations customizadas e scripts de aplicação; não usar apenas uma tabela
  genérica de migrations como prova de deploy.
- Registrar p50/p95/p99 para mês, YTD, ano completo, multi-ano e filtro sem
  resultado, em 1 e 10 sessões concorrentes.
- Criar fixtures douradas com contagens, totais monetários e regras de
  deduplicação. Contagens e valores em centavos devem permanecer exatamente
  iguais antes/depois.
- Definir owners, SLOs, janela de manutenção e rollback antes de alterar SQL.

**Gate F0:** baseline reproduzível, matriz de dependências, contrato de cada
RPC crítica e caso de reconciliação aprovado.

### F1 — Robustez P0 (2–4 dias)

- Validar runtime de todas as respostas críticas: Desempenho, Ações, Painel,
  Comercial, Pedidos, Serviços, Inteligência, Admin e mapa.
- Criar `WidgetErrorBoundary`/estado de erro por widget; retry deve atingir
  somente a query key daquele bloco.
- Preservar último dado válido durante refetch e mostrar “atualização pendente”
  em vez de apagar o cartão.
- Corrigir `toFixed`, `Number`, percentuais e séries para rejeitar `NaN`,
  `Infinity`, strings inesperadas e coordenadas fora do domínio.
- Separar `loading`, `empty`, `partial` e `error`; eliminar defaults silenciosos
  que transformam falha em zero.
- Corrigir inicialização de perfil/permissões para ter timeout recuperável,
  retry limitado e estado visível — nunca spinner infinito.
- Cobrir payload parcial, 401, 403, 5xx, timeout, `NaN`, coordenada inválida e
  filtro sem dados em testes unitários, integração e E2E.

**Gate F1:** resposta inválida não desmonta a rota; zero válido continua zero;
20 recargas consecutivas não deixam apenas o shell por mais de 2 s.

### F2 — SQL/RPC e modelo de leitura (3–6 dias)

Toda alteração SQL deve ter plano antes/depois (`EXPLAIN (ANALYZE, BUFFERS)`),
reconciliação de dados e rollback independente. Não criar índice “por tentativa”.

1. **Remover overloads ambíguos (P0 operacional).** A VPS tem simultaneamente
   assinaturas legadas e vigentes de `rpc_desempenho_vendas_bi` (10/11 args) e
   dos dois drill-downs de Ações (6/7 args); uma chamada sem `p_funis` falha na
   resolução (`function is not unique`). `rpc_evolucao_ganhos_perdidos_12m`
   também tem assinaturas de 1/3 args e falha quando o corpo é vazio. As
   migrations locais
   `20260922_remove_ambiguous_rpc_desempenho_vendas_overload.sql` e
   `20260922_remove_ambiguous_acoes_gpo_overloads.sql` removem somente os
   legados, sem `CASCADE`, validam identidades/retornos antes e depois e enviam
   `NOTIFY pgrst`. Os serviços já
   passam a enviar `p_funis: null` nos drill-downs e em Desempenho quando não há
   filtro; o hook de evolução já envia as três chaves. As duas migrations foram
   aplicadas com snapshot de rollback e smoke independente; o PostgREST precisou
   de restart controlado para recarregar o schema. Antes de qualquer hardening
   de ACL ou rewrite SQL, preservar a evidência pós-deploy e o snapshot da
   definição do GPO, que não existe como arquivo histórico no repositório.
2. **`rpc_resultados_negocios_bi`** — é o maior risco de latência: multi-ano chegou a
   ~8,7–9,3 s. Consolidar a coorte uma vez, evitar RPCs pesadas aninhadas e
   recomputação de CTEs; filtrar período antes de `DISTINCT ON`, `STRING_AGG`,
   cidade e produto. Manter caminho especializado para ano completo somente se
   o plano e a paridade confirmarem benefício.
3. **Mapa de oportunidades** — separar resumo de pinos; carregar mapa sob
   demanda/viewport; retornar clusters ou página de pinos, não centenas de
   registros e texto livre no caminho inicial. Validar coordenadas no servidor.
4. **Desempenho de vendas** — entregar KPI/série primeiro e drill-down depois;
   materializar resumo mensal quando o ETL puder garantir `freshness` e
   reconciliação. Não misturar 50 linhas detalhadas com o primeiro paint.
5. **Ações/funil** — filtrar a coorte antes de deduplicar/agregar, compartilhar
   uma base de leitura por período e separar listas paginadas de cards. Evitar
   repetir a mesma consulta para abas que ainda não estão visíveis.
6. **Paginação e histórico** — cursor/chave para detalhes; ano histórico sem
   limite deve virar consulta assíncrona/exportação, não bloquear a rota.
7. **Índices e materialização** — já existem índices de data, vendedor,
   negócio e expressões. Só adicionar ou alterar índice quando o plano real
   demonstrar ganho líquido e custo aceitável de ETL/escrita.

**Gate F2:** p95 agregado ≤1,5 s, nenhuma chamada interativa >10 s no teste
acordado, buffers/temp I/O não pioram mais de 10%, e 100% dos fixtures mantêm
paridade.

### F3 — Orquestração do frontend e transporte (2–4 dias)

- Limitar a no máximo três consultas pesadas concorrentes por rota na primeira
  onda; deduplicar query keys e cancelar filtros obsoletos.
- Usar filtro em rascunho + botão **Aplicar**, debounce de 300–500 ms e
  `enabled` somente para seções visíveis/necessárias.
- Carregar em fases: KPI/série → tabelas resumidas → detalhes, IA e mapa.
- Virtualizar/truncar observações e abrir texto completo sob demanda.
- Manter o mapa fechado ou lazy por viewport; clusterizar antes do render.
- Só então avaliar o proxy same-origin preparado no commit local `6a25076`.
  Ele pode reduzir variabilidade de transporte, mas não é substituto para F1/F2
  e ainda não está publicado na produção.

**Gate F3:** primeiro KPI ≤2 s, tela útil mensal ≤4 s, anual útil ≤4 s com
detalhes fora do caminho crítico, payload inicial agregado <250 KB.

### F4 — FastAPI/Python (frente separada, 1–3 dias)

O `ai-service/` é FastAPI/Uvicorn e usa `psycopg2`; a stack o roteia em
`/api/ai`. Ele não é a origem comprovada das RPCs principais dos dashboards,
mas também precisa de endurecimento:

- trocar conexão nova por query por pool limitado (`ThreadedConnectionPool`
  ou equivalente) e definir `connect_timeout`, `statement_timeout`,
  `application_name` e transação read-only para consultas analíticas;
- limitar concorrência explicitamente: há `ThreadPoolExecutor(max_workers=4)`
  em `main.py` e consultas paralelas; o limite deve respeitar a capacidade do
  PostgreSQL e devolver 429/503 claro quando excedido;
- adicionar `response_model`/schemas Pydantic aos endpoints legados; erro não
  deve voltar como HTTP 200 com `{"error": ...}`;
- substituir `print` e mensagens que incluem exceção bruta por logger
  estruturado com request id e redação de PII;
- reutilizar cliente HTTP, separar tarefas longas de IA do request interativo
  e reduzir o timeout de 120 s para um orçamento explícito com job assíncrono;
- manter a validação JWT e os limites de query já existentes; não permitir que
  o agente dinâmico vire atalho para `SELECT *` ou consulta sem limite.

**Gate F4:** `/health` distingue processo, banco e provedor; timeout do AI não
segura worker indefinidamente; falha do AI não altera os números do BI.

### F5 — Staging, UAT e entrega ao cliente (2–3 dias)

- Staging próximo da produção, com volume representativo e dados mascarados.
- Carga mínima acordada: 10 sessões concorrentes nas rotas Ações,
  Desempenho e Painel, mês/YTD/ano completo e filtro sem resultados.
- Fault injection: timeout, 401/403, 5xx, JSON parcial, `NaN`, mapa sem
  coordenada, sessão expirada e ETL atrasado.
- Rodar gates FULL: reviewer, security condicional, QA, smoke das rotas
  afetadas, build, typecheck, testes e verificação do SHA.
- Fazer canário/feature flag; manter imagem anterior e funções SQL legadas para
  rollback. Em caso de SLO rompido, desligar a flag ou voltar ao SHA anterior.

## 6. Plano de entrega ao cliente

### Entrega 1 — Estabilidade visível

Escopo: contratos runtime, isolamento por widget, estados de erro, proteção de
auth/perfil, mapa e detalhes fora do caminho inicial, filtros com aplicação
controlada e telemetria mínima.

**Demonstração:** abrir cada tela, filtrar mês/ano, usar filtro sem dados,
forçar retry e mostrar que um widget indisponível não derruba a rota.

### Entrega 2 — Performance mensurável

Escopo: reescritas SQL comprovadas, resumos/paginação, redução de fan-out,
payload e DOM, pool/timeout do AI service e dashboard operacional.

**Demonstração:** comparar baseline e pós-melhoria com os mesmos filtros e
fixtures, exibindo tempo até primeiro KPI, tela útil, p95, payload e contagens.

### Entrega 3 — Go-live assistido

Escopo: release imutável na VPS, smoke pós-deploy, monitoramento intensivo por
24–48 h, relatório final, runbook e treinamento curto do cliente.

**Material entregue:**

- relatório executivo antes/depois;
- matriz de telas, RPCs, owners e SLOs;
- reconciliação de dados e regras de zero/null/partial;
- planos SQL antes/depois e registro de migrations aplicadas;
- runbook de health, alertas, retry e rollback;
- roteiro de aceite e evidências de smoke.

Uma estimativa preliminar é de **9–14 dias úteis** para uma pessoa dedicada,
depois de F0 e sem mudança de regra de negócio. Isso é faixa de planejamento,
não promessa: carga, staging, acesso aos dados e decisões do cliente podem
alterar o prazo.

## 7. Critérios de aceite final

- Primeiro KPI ≤2 s; tela útil mensal ≤4 s; anual útil ≤4 s sem drill-down/mapa
  bloqueante.
- p95 de RPC agregada ≤1,5 s; nenhuma chamada interativa acima de 10 s no
  teste acordado; erro/timeout de tela ≤1% sob a carga aprovada.
- No máximo três consultas pesadas simultâneas por rota; payload inicial
  agregado <250 KB.
- 20 reloads consecutivos sem shell preso por mais de 2 s.
- 100% das RPCs críticas com schema e estado por widget; nenhum `catch` que
  converta falha em zero.
- Paridade de 100% dos fixtures de contagens e valores; tolerância numérica
  definida para arredondamentos de apresentação.
- Cada rewrite SQL possui `EXPLAIN` antes/depois, rollback e registro de
  migration aplicada na VPS.
- `/health`, logs e telemetria recebem evento sintético; alertas de p95, 5xx,
  pool, disco e freshness foram exercitados.
- Build, typecheck, testes, reviewer/security/QA e smoke do SHA passam antes do
  aceite do cliente.

## 8. Pendências que não devem ser escondidas

- Ainda não existe benchmark p95 formal nem teste de carga; as medições atuais
  são fotografias de uma sessão.
- O timeout de perfil foi reproduzido, mas sua causa final (fila de transporte,
  gateway, cliente ou concorrência) precisa de request id e telemetria.
- A VPS tem disco raiz perto de 83%; não causou o congelamento observado, mas
  precisa de alerta e plano de manutenção.
- A configuração same-origin está somente no commit local `6a25076`; produção
  continua no SHA `ead1742538d2` até passar pelos gates.
- O prazo de atualização/freshness do ETL e a semântica comercial de `partial`
  precisam de aceite explícito do cliente.

## 9. Próximo passo autorizado

Executar F0 em branch/preview: fechar inventário, contratos, fixtures, p95,
planos SQL e rollback. Só depois implementar F1/F2 e decidir publicação na VPS.
Este documento e a auditoria são documentação; não aplicam código, migration,
proxy ou alteração de serviço por conta própria.
