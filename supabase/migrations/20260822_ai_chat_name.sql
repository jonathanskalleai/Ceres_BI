BEGIN;

UPDATE public.app_modules
SET
  label = 'AI do BI'
WHERE id = 'bi.ya';

COMMIT;
