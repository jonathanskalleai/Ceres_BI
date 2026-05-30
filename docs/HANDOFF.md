# Ceres BI — Handoff de Sessão

**Data:** 2026-05-27
**Status:** Dashboard funcional com dados reais do SQL Server

---

## O que foi feito nesta sessão

### 1. Infraestrutura
- `.env` atualizado para Supabase self-hosted (`ceressupabasebi.vouxconsultoria.com.br`)
- Edge function `query-sqlserver` criada e deployada na VPS (178.238.235.203)
- Driver: `tedious@19` (TDS puro — `mssql` era pesado demais para o edge runtime)
- Env vars do SQL Server configuradas no Docker Swarm service
- IP da VPS liberado no firewall do SQL Server (wfrsistemas.net.br:1433)

### 2. Frontend
- Service layer criado: `src/services/sqlServerApi.ts`, `registrosService.ts`, `negociosService.ts`
- Hooks migrados de Supabase direto → React Query + edge function
- `useComercialData.ts` — usa `fetchRegistrosComerciais()` (VW_Ceres_CRM_Acoes)
- `useNegociosData.ts` — usa `fetchNegociosMensais()` (Negocios + Pedidos + Usuario)
- Dashboard.tsx atualizado (removido syncAndRefresh/Dropbox, adicionado invalidateQueries)
- Build + TypeScript passando sem erros

### 3. Documentação
- `docs/MAPEAMENTO_DADOS.md` — mapeamento completo views → dashboard

---

## Limitações atuais / Problemas conhecidos

1. **CPU limit do edge runtime** — não consegue retornar mais de ~3000 registros por request. Solução implementada: paginação com batches de 3 paralelos.

2. **Tempo de carregamento** — ~20-25s para 28k registros (10 páginas × 3000). Aceitável para validação, mas precisa otimizar depois.

3. **`EMP_Cidade` não é cidade do cliente** — é a cidade da filial. Para corrigir, integrar `VW_Ceres_CRM_CarteiraClientes.CLI_Cidade`.

4. **`negocioValor` zerado nas ações** — a view de Ações não tem valor. Pipeline real vem de `VW_Ceres_CRM_Negocios`.

5. **Vendedor em Negócios é código** — `NGO_Vendedores` é numérico, resolvido via `VW_Ceres_Usuario`. Pode ter mapeamentos faltando.

---

## Próximos passos

1. **Validar dados** — comparar dashboard com relatórios do sistema original, um menu de cada vez
2. **Filtro de data padrão** — carregar últimos 3 meses por padrão (reduz 28k → ~7k, load de 5-8s)
3. **Corrigir mapeamento de cidade** — usar `VW_Ceres_CRM_CarteiraClientes` para cidade real do cliente
4. **Sync incremental** — job periódico SQL Server → Postgres para eliminar latência
5. **Autenticação** — implementar login (Supabase Auth já está no self-hosted)
6. **Deploy do frontend** — hospedar o build na VPS (Nginx/Traefik)

---

## Arquivos-chave

```
supabase/functions/query-sqlserver/index.ts  — Edge function (tedious driver)
src/services/sqlServerApi.ts                 — API client + paginação
src/services/registrosService.ts             — Mapeia VW_Ceres_CRM_Acoes → Registro
src/services/negociosService.ts              — Mapeia Negocios+Pedidos+Usuario → NegocioRow
src/hooks/useComercialData.ts                — React Query hook (registros)
src/hooks/useNegociosData.ts                 — React Query hook (negócios)
src/pages/Dashboard.tsx                      — Roteamento de views
docs/MAPEAMENTO_DADOS.md                     — Documentação completa
```

---

## Credenciais / Acessos

- **VPS:** root@178.238.235.203 (senha: 5qv2fJT3Cv5W36RrY)
- **SQL Server:** wfrsistemas.net.br:1433 / CamposDealer_BI / usrBI_CresCandiotto
- **Supabase:** https://ceressupabasebi.vouxconsultoria.com.br
- **Anon Key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.yXg8zkCdBRNXAPyONyI0GuX77HnQWed9Rnh_R0idFg4

---

## Comandos úteis

```bash
# Build
npm run build

# Dev server
npm run dev

# Deploy edge function na VPS
sshpass -p '5qv2fJT3Cv5W36RrY' scp -o StrictHostKeyChecking=no \
  supabase/functions/query-sqlserver/index.ts \
  root@178.238.235.203:/root/supabase/docker/volumes/functions/query-sqlserver/index.ts

# Restart edge functions
sshpass -p '5qv2fJT3Cv5W36RrY' ssh -o StrictHostKeyChecking=no root@178.238.235.203 \
  "docker service update --force supabase_supabase_functions"

# Testar edge function
curl -s -X POST "https://ceressupabasebi.vouxconsultoria.com.br/functions/v1/query-sqlserver" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -d '{"view": "VW_Ceres_CRM_Acoes", "columns": ["CLI_Nome","ACO_Vendedor"], "limit": 5}'

# Ver logs do edge runtime
sshpass -p '5qv2fJT3Cv5W36RrY' ssh root@178.238.235.203 \
  "docker logs \$(docker ps -q -f name=supabase_supabase_functions) 2>&1 | tail -20"
```
