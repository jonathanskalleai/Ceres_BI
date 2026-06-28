# Handoff — Discrepância de negócios: dealer 130 × BI 127 (junho/2026)

**Data:** 2026-06-26
**Origem:** sessão Claude Code (máquina local, sem acesso shell à VPS)
**Destino:** AI rodando NA VPS (178.238.235.203) — tem acesso ao banco e ao ETL
**Tela investigada:** `/bi/comercial` (http://localhost:8085/bi/comercial)

---

## 1. Problema relatado

- Na interface do **dealer (sistema de origem)**: **130** negócios cadastrados em junho/2026.
- No **BI** (tela Comercial, filtro default = mês atual): **127**.
- Gap = **3 negócios**.

## 2. O que JÁ foi confirmado (rodado contra o banco vivo via PostgREST)

Banco: Supabase self-hosted em `https://ceressupabasebi.vouxconsultoria.com.br` (roda na VPS).
Filtro reproduzido: `ngo_datacadastro` em `[2026-06-01, 2026-07-01)`, todos os funis.

| Métrica | Valor |
|---|---|
| `mirror.crm_negocios` — linhas BRUTAS (junho) | **140** |
| Negócios DISTINTOS por `ngo_numero` (junho) | **127** ← o que o BI mostra |
| Duplicatas no mirror (junho) | 13 |
| Origem (dealer) | **130** |
| Total tabela: bruto / distinto | 3333 / 3045 (288 dup no histórico) |

**Conclusões travadas:**
- ✅ **O BI está CORRETO.** A RPC `rpc_negocios_bi` filtra por `ngo_datacadastro` e deduplica com `DISTINCT ON (ngo_numero)`. 127 = negócios distintos reais cadastrados em junho.
- ❌ **NÃO é dedupe.** Dedupe explica 140→127 (corte de 13). O gap do usuário é 130→127 (3 que faltam). São coisas diferentes.
- ❌ **NÃO é lag.** O mirror está atualizado até hoje (cadastro mais recente = 2026-06-26 17:15).
- ❌ **NÃO há erro no `sync_log`** (últimos ciclos `status=success`).
- ➡️ **Os 3 negócios existem na ORIGEM (dealer=130) mas NÃO entraram no `mirror.crm_negocios` (127 distinto).** É **perda silenciosa do sync incremental**.

## 3. Causa raiz (hipótese forte)

Sync de `crm_negocios` é **incremental por watermark** na coluna **`NGO_DataAtualizacao`**:
- `sync_control.crm_negocios`: watermark_column=`NGO_DataAtualizacao`, watermark_value=`2026-06-26T17:15:11.6`
- Source view = **`VW_Ceres_CRM_Negocios`**

Incremental por timestamp de atualização **pula linhas** quando uma linha aparece/comita com `NGO_DataAtualizacao` ≤ watermark já gravado (skew de relógio origem↔ETL, fuso horário, ou exclusão pelo limite `>` estrito). Já é a 2ª ocorrência desse padrão de perda de dados neste projeto.

## 4. O QUE A AI NA VPS PRECISA FAZER (continuação)

> Você está NA VPS — tem o ETL e a conexão da origem que eu (sessão local) não tenho.

### Passo 1 — achar a conexão da origem
O ETL é Python e **não está no repo local** (`Ceres_BI`), está na VPS. Localizar:
```bash
sudo find / -name "*.py" 2>/dev/null | xargs grep -l "VW_Ceres_CRM_Negocios\|pyodbc\|pymssql\|NGO_DataAtualizacao" 2>/dev/null | head
# procurar também o .env/config do ETL com a string de conexão da origem (SQL Server provável)
```

### Passo 2 — contar na ORIGEM (deve dar 130)
Conectar na origem (`VW_Ceres_CRM_Negocios`) e rodar — ajustar dialeto conforme o banco fonte:
```sql
-- negócios cadastrados em junho/2026 na ORIGEM
SELECT COUNT(DISTINCT NGO_Numero)
FROM VW_Ceres_CRM_Negocios
WHERE CAST(NGO_DataCadastro AS date) >= '2026-06-01'
  AND CAST(NGO_DataCadastro AS date) <  '2026-07-01';
-- esperado: 130
```

### Passo 3 — diff origem × mirror = os 3 faltantes
Pegar a lista de `NGO_Numero` da origem (junho) e subtrair os do mirror:
```sql
-- no mirror (Postgres / Supabase):
SELECT ngo_numero FROM mirror.crm_negocios
WHERE ngo_datacadastro::date >= '2026-06-01' AND ngo_datacadastro::date < '2026-07-01'
GROUP BY ngo_numero;   -- 127 números
```
Os 3 `NGO_Numero` que estão na origem e não nessa lista = os faltantes. Inspecionar `NGO_DataAtualizacao` deles e comparar com o watermark `2026-06-26T17:15:11.6` para confirmar o mecanismo (≤ watermark = pulados pelo incremental).

### Passo 4 — corrigir
- **Imediato:** re-sync FULL (não-incremental) de `crm_negocios` → recontar → deve virar 130. (Conferir o histórico: o gap aparece em vários meses, não só junho.)
- **Estrutural (recomendado):** trocar o incremental "cego" por **janela de overlap** (re-puxar as últimas N horas/dias a cada ciclo, com upsert idempotente por `ngo_numero`) + **reconciliação diária de contagem origem×mirror** que alerta quando diverge. Sem isso, o gap volta calado.
- **Higiene separada (não urgente):** limpar as 13 duplicatas de junho (288 no total) em `mirror.crm_negocios`. Não afeta o BI (a RPC já faz `DISTINCT ON`), mas suja a tabela. Investigar por que o upsert do ETL insere duplicado em vez de fazer merge por `ngo_numero`.

## 5. Referências de código (repo local)
- Tela: `src/pages/bi/BiComercial.tsx` → `src/components/bi/sections/ComercialSection.tsx`
- Hook/serviço: `src/hooks/bi/useNegociosBIRpc.ts` → `src/services/bi/biRpcService.ts` (`fetchNegociosBI`)
- RPC SQL: `supabase/migrations/20260626_filtro_cidade_vendedor_rpcs.sql` (filtro `ngo_datacadastro::date BETWEEN p_from AND v_to`, `v_to := LEAST(p_to, CURRENT_DATE)`)
- Filtro default da tela: `src/contexts/NegociosFilterContext.tsx` (`currentMonthRange` = mês atual)

## 6. Endpoints/tabelas úteis (mirror schema, PostgREST)
- `mirror.crm_negocios` (Accept-Profile: mirror) — colunas SEM underscore divergem; o banco vivo usa `ngo_*`.
- `mirror.sync_control` — watermark por tabela.
- `mirror.sync_log` / `mirror.sync_metadata` — histórico/erros de sync.
- RPC `rpc_etl_status` — status do ETL (minutes_since_sync).

---

**Resumo de 1 linha para a AI da VPS:** o BI está certo (127 distintos); 3 negócios de junho existem na origem (`VW_Ceres_CRM_Negocios` = 130) mas o sync incremental por `NGO_DataAtualizacao` não os trouxe ao mirror — achar os 3 pelo diff origem×mirror, confirmar pelo watermark, e corrigir com re-sync full + janela de overlap.
