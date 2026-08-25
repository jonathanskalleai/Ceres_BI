-- The ten-parameter version supplies defaults for the original six inputs.
-- Keeping this legacy overload makes PostgREST return PGRST203 whenever the
-- caller sends only the original filter set.
DROP FUNCTION IF EXISTS public.rpc_desempenho_vendas_bi(
  date,
  date,
  integer,
  text,
  text,
  text
);

NOTIFY pgrst, 'reload schema';
