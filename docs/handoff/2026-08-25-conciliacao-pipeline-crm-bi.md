# Handoff — Conciliação Pipeline CRM × BI: resíduo de R$ 425 mil

**Data:** 2026-08-25  
**Status:** regra de pipeline alinhada ao CRM e aplicada em produção; falta identificar **1 negócio de R$ 425.000,00** que aparece no card nativo do CRM, mas não no espelho `mirror` usado pelo BI.

## Objetivo da próxima sessão

Localizar o negócio residual de R$ 425 mil e corrigir a causa na fonte certa (consulta do CRM, ETL ou mirror). Não alterar novamente a regra de pipeline sem primeiro identificar esse negócio.

## Resultado esperado hoje

O usuário filtrou no CRM:

- Funil: **Vendas**;
- Data de abertura do negócio: **01/01/2026 até o momento atual**;
- Cards por etapa atual.

O print do CRM mostra:

| Etapa | Negócios | Valor |
|---|---:|---:|
| Oportunidade | 475 | R$ 72.276.629,91 |
| Cotação | 76 | R$ 11.642.259,00 |
| Proposta ao cliente | 104 | R$ 18.886.372,03 |
| **Total** | **655** | **R$ 102.805.260,94** |

Depois da alteração, a RPC do BI retorna em agosto/2026:

| Etapa | Negócios | Valor |
|---|---:|---:|
| Oportunidade | 474 | R$ 71.851.629,91 |
| Cotação | 76 | R$ 11.642.259,00 |
| Proposta ao cliente | 104 | R$ 18.886.372,03 |
| **Total** | **654** | **R$ 102.380.260,94** |

Portanto, o resíduo é exatamente **1 negócio / R$ 425.000,00**, na etapa **Oportunidade**.

## Regra atualmente publicada no BI

As colunas financeiras **Oportunidade, Cotação e Proposta** da Análise de Desempenho agora usam o mesmo critério lógico dos cards do CRM:

1. negócio canônico (`DISTINCT ON (ngo_numero)`, versão mais recente);
2. `ngo_datacadastro` dentro do ano selecionado, até a competência exibida (ou até a data atual para o mês corrente/futuro);
3. `ngo_funil` atual = `VENDAS`;
4. `ngo_etapa` atual em `1-OPORTUNIDADE`, `2-COTACAO` ou `3-PROPOSTA AO CLIENTE`;
5. valor = `ngo_vlrtotalnegociado` da versão canônica.

Ganhos, metas, clientes, conversões e demais indicadores **não foram alterados**.

### Artefatos

- Migration aplicada: `supabase/migrations/20260825_equipe_desempenho_pipeline_criterio_crm_atual.sql`.
- Migration anterior também aplicada: `20260825_equipe_desempenho_pipeline_inicio_ano.sql`; ela foi supersedida pela migration acima e não deve ser reaplicada isoladamente em produção.
- Frontend chama `rpc_equipe_desempenho_mensal_v2`, que reaproveita os valores financeiros da `rpc_equipe_desempenho_mensal`.
- A função foi validada em produção depois da aplicação; o predicado `nc.ngo_datacadastro::date >= make_date(p_ano, 1, 1)` está instalado.

## O que já foi conciliado

Antes de alinhar a regra, o BI usava `mirror.crm_funil_etapa` (histórico de entrada/saída de etapa) e o CRM usava a etapa atual do negócio. Isso gerava dois grupos legítimos de divergência no espelho:

| Situação entre os conjuntos do espelho | Negócios | Valor | Motivo |
|---|---:|---:|---|
| Em ambos, mesma etapa | 623 | R$ 96.922.783,94 | Conjunto comum |
| Apenas CRM | 31 | R$ 5.457.477,00 | A etapa atual do negócio está aberta, mas o histórico da etapa está encerrado antes do fim de agosto |
| Apenas BI anterior | 10 | R$ 1.735.176,00 | Negócio aberto antes de 2026, porém entrou na etapa em 2026 |

Isso foi resolvido como regra de negócio: o BI agora acompanha o CRM pela data de abertura e etapa atual, não pelo histórico de etapas.

O resíduo de R$ 425 mil é posterior a essa correção e deve ser investigado como discrepância de dados/sincronização, não como nova divergência de definição.

## Hipóteses do resíduo de R$ 425 mil

1. O CRM nativo tem um negócio em Oportunidade que ainda não chegou ao `mirror.crm_negocios` na última sincronização.
2. O CRM nativo escolhe outra versão de um mesmo `NGO_Numero` que a regra canônica do BI (`ngo_dataatualizacao DESC`, depois `dthregistro DESC`).
3. O card do CRM deduplica/soma negócios de forma diferente do mirror.
4. A data/filtro do print do CRM inclui um registro que não está dentro de `ngo_datacadastro` no mirror.

Não assumir Repasse de Máquina: a consulta do BI alinhada ao CRM retornou os 654 negócios todos com `ngo_funil = 'VENDAS'`.

## Roteiro recomendado para a próxima sessão

### 1. Confirmar a fotografia do mirror

No banco de produção, repetir a agregação canônica. O resultado esperado é 474 oportunidades / R$ 71.851.629,91:

```sql
WITH negocios AS (
  SELECT DISTINCT ON (n.ngo_numero)
    n.ngo_numero,
    n.ngo_datacadastro::date AS data_abertura,
    n.ngo_funil,
    n.ngo_etapa,
    n.ngo_vlrtotalnegociado AS valor
  FROM mirror.crm_negocios n
  WHERE n.ngo_numero IS NOT NULL AND n.ngo_numero <> ''
  ORDER BY n.ngo_numero,
    n.ngo_dataatualizacao DESC NULLS LAST,
    n.dthregistro DESC NULLS LAST
)
SELECT COUNT(*) AS negocios, SUM(valor) AS valor
FROM negocios
WHERE data_abertura BETWEEN DATE '2026-01-01' AND CURRENT_DATE
  AND UPPER(BTRIM(ngo_funil)) = 'VENDAS'
  AND UPPER(BTRIM(ngo_etapa)) = '1-OPORTUNIDADE';
```

### 2. Consultar a origem do CRM com o mesmo filtro

Usar a conexão do ETL para consultar a view/origem que alimenta `mirror.crm_negocios`. Não expor credenciais em arquivos, terminal ou handoff.

Comparar uma lista por `NGO_Numero` com, no mínimo:

- `NGO_Numero`;
- `NGO_DataCadastro`;
- `NGO_Funil`;
- `NGO_Etapa`;
- `NGO_VlrTotalNegociado`;
- data de atualização/origem, se disponível.

Aplicar o mesmo filtro do CRM e localizar o conjunto `CRM_origem EXCEPT mirror_canonico`. O esperado é encontrar 1 linha de R$ 425.000,00.

### 3. Se o negócio existir no mirror em mais de uma versão

Consultar todas as linhas do `NGO_Numero` encontrado em `mirror.crm_negocios`, ordenando por `ngo_dataatualizacao DESC, dthregistro DESC`. Verificar se a deduplicação atual escolhe a versão errada ou se a origem possui versão mais nova ainda não sincronizada.

### 4. Corrigir no menor escopo

- Se for atraso do ETL: corrigir/sincronizar o ETL; não adulterar a RPC para compensar um registro ausente.
- Se for deduplicação: ajustar a regra canônica em uma migration própria e revalidar Cotação/Proposta.
- Se o card do CRM usa outra regra: documentar a regra exata e alterar a RPC de forma explícita, com teste de regressão.

## Infra e execução segura

- Produção é Supabase self-hosted na VPS; não usar Supabase Cloud/MCP para este alvo.
- SSH usa a porta **2222**. Não registrar credenciais neste arquivo.
- DB container é dinâmico: `docker ps -q -f name=supabase_supabase_db`.
- Para alterar as RPCs, usar `psql -U supabase_admin -d postgres`; `postgres` não é dono dessas funções.
- A execução ETL ativa está em `/opt/etl-stack/` e o cron em `/etc/cron.d/ceres-etl-simple`.
- Em 25/08, `mirror.sync_control` indicava `crm_negocios` sincronizado às `2026-08-25 12:15:06` e `crm_funil_etapa` às `12:15:14`.

## Estado do repositório

O worktree já estava sujo antes desta sessão, com alterações de outros trabalhos. Não limpar, resetar ou incluir mudanças não relacionadas.

As duas migrations acima foram criadas localmente e aplicadas diretamente na VPS. Verificar `git status` e versioná-las no commit adequado antes do próximo deploy de frontend.
