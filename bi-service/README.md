# Ceres BI API

Serviço FastAPI isolável para o caminho de dados das dashboards. A primeira
fatia expõe os contratos da tela **Ações** sem alterar o resultado visual nem
as RPCs existentes.

## Configuração

- `BI_DATABASE_URL`: URL privada do PostgreSQL para a role read-only do BI.
- `BI_SUPABASE_JWT_SECRET`: segredo HS256 usado para validar tokens Supabase.
- `BI_SUPABASE_JWT_AUDIENCE`: audience esperada (padrão: `authenticated`).
- `BI_DATABASE_POOL_MIN`: conexões mínimas (padrão: `1`).
- `BI_DATABASE_POOL_MAX`: conexões máximas (padrão: `8`).
- `BI_STATEMENT_TIMEOUT_MS`: limite de cada RPC (padrão: `30000`).
- `CORS_ORIGINS`: origens permitidas, separadas por vírgula.

O serviço falha fechado: sem `BI_DATABASE_URL` ou segredo JWT, as rotas
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
