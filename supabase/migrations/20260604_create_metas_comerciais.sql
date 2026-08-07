-- Migration: Create metas_comerciais table
-- Author: @data-engineer (Dara)
-- Date: 2026-06-04
-- Description: Tabela de metas comerciais anuais em R$. Usada pelo Dashboard BI
--              para calcular % de atingimento da meta no painel Comercial.
--              Uma linha por ano (constraint UNIQUE em ano).

-- =============================================================================
-- 1. TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.metas_comerciais (
    id          serial          PRIMARY KEY,
    ano         integer         NOT NULL,
    meta_anual  numeric(15,2)   NOT NULL,
    updated_at  timestamptz     NOT NULL DEFAULT now(),

    CONSTRAINT metas_comerciais_ano_unique UNIQUE (ano),
    CONSTRAINT metas_comerciais_ano_check  CHECK  (ano >= 2020 AND ano <= 2099),
    CONSTRAINT metas_comerciais_meta_check CHECK  (meta_anual > 0)
);

COMMENT ON TABLE public.metas_comerciais IS
  'Metas comerciais anuais em R$. Uma linha por ano fiscal. '
  'Consumida pelo Dashboard BI (tab Comercial) para calcular percentual de atingimento.';

COMMENT ON COLUMN public.metas_comerciais.ano        IS 'Ano fiscal de referência (ex: 2026).';
COMMENT ON COLUMN public.metas_comerciais.meta_anual IS 'Meta de receita anual em reais (R$).';
COMMENT ON COLUMN public.metas_comerciais.updated_at IS 'Última atualização do registro.';

-- =============================================================================
-- 2. INDEX
-- =============================================================================

-- O acesso sempre sera por ano; o UNIQUE ja cria o index, mas nomeado explicitamente
-- para facilitar EXPLAIN ANALYZE.
-- (Nao duplicar — o UNIQUE constraint ja gera um btree index no Postgres.)

-- =============================================================================
-- 3. ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.metas_comerciais ENABLE ROW LEVEL SECURITY;

-- SELECT: leitura aberta — dados de meta nao sao sensiveis
CREATE POLICY "metas_comerciais_select_open"
    ON public.metas_comerciais
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- INSERT: somente usuarios autenticados
CREATE POLICY "metas_comerciais_insert_authenticated"
    ON public.metas_comerciais
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- UPDATE: somente usuarios autenticados
CREATE POLICY "metas_comerciais_update_authenticated"
    ON public.metas_comerciais
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- DELETE: bloqueado (nao ha policy de DELETE = nenhuma role pode deletar via API)
-- Para remover uma meta, deve-se usar service_role direto ou uma funcao segura.

-- =============================================================================
-- 4. SEED — meta inicial 2026
-- =============================================================================

INSERT INTO public.metas_comerciais (ano, meta_anual)
VALUES (2026, 30000000.00)
ON CONFLICT ON CONSTRAINT metas_comerciais_ano_unique DO NOTHING;
