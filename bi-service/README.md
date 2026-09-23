# Ceres BI API

Serviço FastAPI isolável para o caminho de dados das dashboards. A primeira
fatia expõe os contratos da tela **Ações** sem alterar o resultado visual nem
as RPCs existentes.

## Configuração

- `BI_DATABASE_URL` ou `BI_DATABASE_URL_FILE`: URL privada do PostgreSQL para
  a role read-only do BI. Em produção, use o arquivo montado por Docker Secret.
- `BI_SUPABASE_JWT_SECRET` ou `BI_SUPABASE_JWT_SECRET_FILE`: segredo HS256
  usado para validar tokens Supabase. Em produção, use Docker Secret.
- `BI_SUPABASE_JWT_AUDIENCE`: audience esperada (padrão: `authenticated`).
- `BI_DATABASE_POOL_MIN`: conexões mínimas (padrão: `1`).
- `BI_DATABASE_POOL_MAX`: conexões máximas (padrão: `8`).
- `BI_STATEMENT_TIMEOUT_MS`: limite de cada RPC (padrão: `30000`).
- `BI_CACHE_TTL_SECONDS`: TTL do cache L1 e da coalescência de consultas
  idênticas (padrão: `5`; `0` desliga).
- `BI_CACHE_MAX_ITEMS`: máximo de resultados mantidos por processo (padrão:
  `512`). O cache é isolado por usuário, RPC e parâmetros e não substitui
  read models nem a invalidação do ETL.
- `BI_CACHE_MAX_ENTRY_BYTES`: tamanho máximo de um resultado armazenado (padrão:
  `1000000`). Respostas maiores continuam sendo entregues, mas não ficam em
  memória no cache.
- `BI_CORS_ORIGINS`: origens permitidas, separadas por vírgula. O padrão aceita
  somente `https://ceresbi.vouxconsultoria.com.br`; desenvolvimento local deve
  declarar `http://localhost:5173` explicitamente.

O serviço falha fechado: sem URL do banco ou segredo JWT, as rotas
protegidas não executam consultas. Nenhum usuário `postgres` é embutido no
código.

## Rotas

- `GET /health`: estado da aplicação e da configuração (não expõe segredos).
- `GET /api/bi/acoes/core`
- `GET /api/bi/acoes/detalhe`
- `GET /api/bi/acoes/funil`
- `GET /api/bi/acoes/mapa`

As quatro rotas retornam o envelope `{status, data, issues, requestId,
fetchedAt}`. A autorização exige usuário ativo e `bi.acoes` em
`public.user_permissions`, salvo para administradores.

## Execução local

```bash
pip install -r requirements.txt
BI_DATABASE_URL='postgresql://bi_readonly:***@localhost:5432/postgres' \
BI_SUPABASE_JWT_SECRET='***' \
uvicorn main:app --reload --port 8100
```

O serviço usa a conexão PostgreSQL diretamente. O PostgREST não participa da
consulta do BI.

O container executa como usuário sem privilégios, com healthcheck próprio. Na
stack de produção ele também usa filesystem somente leitura, sem capabilities e
com limites de CPU/memória.
