# Relatório de Discrepância — View VW_Ceres_CRM_Acoes

**Data:** 10/06/2026  
**Responsável:** Equipe BI Ceres (VOUX Consultoria)  
**Destinatário:** Equipe Campus Dealer (CRM)

---

## Resumo

Durante a validação de dados do nosso painel de BI, identificamos uma discrepância entre o total de ações exibido na interface do CRM Campus e o total retornado pela view `VW_Ceres_CRM_Acoes` no SQL Server. A view está retornando **menos registros** do que o CRM exibe, o que resulta em dados incompletos no nosso BI.

---

## Evidências

### Teste 1 — Total geral (sem nenhum filtro)

| Fonte | Total de registros |
|-------|-------------------|
| Interface CRM Campus (todos status, todos responsáveis, sem filtro de data) | **28.711** |
| `SELECT COUNT(*) FROM [VW_Ceres_CRM_Acoes]` (sem WHERE) | **28.176** |
| **Diferença** | **535 registros ausentes na view** |

### Teste 2 — Filtro por Data de Conclusão em 2026

| Fonte | Total de registros |
|-------|-------------------|
| Interface CRM Campus (Data Conclusão: 01/01/2026 a 31/12/2026) | **4.309** |
| Mirror Supabase (`WHERE aco_dth_conclusao LIKE '2026%'`) | **3.854** |
| **Diferença** | **455 registros ausentes** |

### Teste 3 — Integridade do mirror (nosso lado)

Confirmamos que o nosso banco espelho (Supabase) está **100% fiel** à view:

| Métrica | Valor |
|---------|-------|
| Total na view SQL Server | 28.176 |
| Total no mirror Supabase | 28.176 |
| Diferença | **0** (sync íntegro) |

Ou seja: o problema não está no nosso processo de sincronização. Estamos recebendo exatamente o que a view entrega.

---

## Diagnóstico

A view `VW_Ceres_CRM_Acoes` aparenta ter um filtro interno (WHERE) que exclui ~535 registros que existem nas tabelas originais do CRM. Possíveis causas:

1. **Filtro por status** — a view pode estar excluindo ações com status específico (canceladas, reagendadas, ou pendentes)
2. **Filtro por tipo de ação** — alguma categoria de ação pode estar excluída
3. **Filtro por filial/empresa** — registros de alguma filial podem não estar na view
4. **JOIN restritivo** — se a view faz JOIN com outra tabela (ex: clientes), registros órfãos ficam de fora

---

## O que precisamos

Para que o BI reflita fielmente os dados do CRM, a view `VW_Ceres_CRM_Acoes` precisa retornar **TODOS os registros de ações**, sem filtro de status ou tipo. Especificamente:

1. **Incluir ações de todos os status** — Concluída, Cancelada, Reagendada, Pendente, Aberta, etc.
2. **Incluir todos os tipos de ação** — sem exceção
3. **Incluir todas as filiais**
4. **Usar LEFT JOIN** em vez de INNER JOIN se houver relacionamento com tabelas auxiliares (para não perder registros órfãos)

---

## Como validar após ajuste

Após a correção da view, podemos validar rodando:

```sql
SELECT COUNT(*) FROM [VW_Ceres_CRM_Acoes]
```

O resultado deve ser **igual ou superior a 28.711** (total atual do CRM). Se bater, o nosso sync vai trazer automaticamente os registros faltantes na próxima execução.

---

## Contato

Qualquer dúvida sobre este levantamento, entrar em contato com a equipe VOUX.
