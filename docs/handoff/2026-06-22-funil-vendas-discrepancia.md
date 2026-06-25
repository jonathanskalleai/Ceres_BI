# Handoff: Discrepância Funil VENDAS — 16 no BI vs 13 no banco

**Data:** 2026-06-22
**Status:** INVESTIGAR
**Prioridade:** Alta (dado afeta confiança no dashboard)

---

## Problema

Usuário filtra negócios por "Data Conclusão" em junho/2026, funil VENDAS.
- **Sistema de referência (CRM):** mostra 16 negócios
- **Banco mirror (query direta):** 13 distintos `ngo_numero` com `ngo_datafechamento` em junho + `ngo_funil = 'VENDAS'`
- **BI dashboard:** mostrando 16 (antes do fix de filtro strict)

## Dados no banco (13 distintos VENDAS, junho 2026)

```
26060210462118485  | 2026-06-03T13:32:25 | Em Andamento
W26060810075918128 | 2026-06-08T10:11:37 | Em Andamento
26061009291524423  | 2026-06-10T10:20:24 | Em Andamento
26061011241725060  | 2026-06-10T15:10:44 | Em Andamento
2501210833108969   | 2026-06-11T00:00:00 | Perdido
2504251609198969   | 2026-06-11T00:00:00 | Perdido
2606171657108969   | 2026-06-17T17:03:49 | Em Andamento
2606171701468969   | 2026-06-17T17:10:17 | Em Andamento
2606171536448968   | 2026-06-17T18:10:51 | Em Andamento
25111717372025060  | 2026-06-19T00:00:00 | Perdido
26061908565625060  | 2026-06-19T09:32:47 | Em Andamento
25091916001618668  | 2026-06-19T18:51:32 | Em Andamento
26062216580318485  | 2026-06-22T17:10:22 | Em Andamento
```

## Todos os funis em junho 2026 (com datafechamento)

| Funil | Distintos |
|-------|-----------|
| VENDAS | 13 |
| REPASSE DE MAQUINA | 7 |
| OFICINA | 5 |
| BANCOS | 4 |
| MARKETING | 3 |
| ADM | 2 |
| Vendas AP | 1 |
| **TOTAL** | **35** |

## Hipóteses para a diferença (13 → 16)

1. **Categoria "VENDAS" no frontend inclui mais de um funil** — ex: `VENDAS` + `Vendas AP` = 14 (ainda falta 2)
2. **O CRM de referência filtra por outra data** — `ngo_datacadastro` ou `ngo_dataatualizacao` em vez de `ngo_datafechamento`
3. **Registros novos entraram após última sync** — pouco provável, ETL rodou às 23:05 e o watermark mostra 5 negócios sincronizados
4. **Dedup diferente** — CRM pode contar por produto (linhas no banco = 14 para VENDAS, pois 1 `ngo_numero` tem 2 produtos). Se CRM não deduplica = 14, não 16
5. **Filtro de data com timezone** — `ngo_datafechamento` no SQL Server pode ter registros com timestamp que cai em junho em BRT mas não em UTC

## O que investigar na próxima sessão

1. **Verificar `getFunisByCategoria`** no frontend — quais funis a categoria "VENDAS" mapeia?
   - Arquivo: `src/lib/categoriaFunil.ts`
   - Se inclui "Vendas AP" → soma 14, não 13

2. **Comparar com o CRM real** — pedir screenshot do filtro exato usado (campo de data, funil selecionado)

3. **Checar se `fetchNegociosBI` aplica filtro de funil server-side** — pode estar vindo sem filtro de funil e o client-side está contando errado
   - Arquivo: `src/services/bi/negociosBIService.ts`

4. **Testar sem dedup** — se desabilitar `dedupeNegocios`, quantas linhas sobram? (14 no banco para VENDAS)

5. **Verificar timezone** — `ngo_datafechamento` values com `T00:00:00` podem ter sido gerados em timezone diferente

## Contexto técnico relevante

- ETL real: `/opt/etl/` na VPS (Python, funciona bem, a cada 15 min)
- Edge function `sync-mirror.sh` foi DESATIVADA (causava registros orphan "running")
- `sync_control` é a fonte de verdade do status do ETL
- Filtro de data no BI: estritamente `ngo_datafechamento` (sem fallback para datacadastro)
- Records sem `ngo_datafechamento` são EXCLUÍDOS do filtro (fix aplicado nesta sessão)

## Arquivos relevantes

- `src/hooks/bi/useNegociosBI.ts` — filtro client-side strict por datafechamento
- `src/services/bi/negociosBIService.ts` — fetch + filtro server-side
- `src/lib/categoriaFunil.ts` — mapeamento categoria → lista de funis
- `/opt/etl/transformers/mappings.py` (VPS) — mapeamento real SQL Server → mirror
