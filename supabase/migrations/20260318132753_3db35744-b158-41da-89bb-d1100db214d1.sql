CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE POLICY "Allow service role delete"
ON public.registros_comerciais
FOR DELETE
TO service_role
USING (true);

CREATE POLICY "Allow service role insert"
ON public.registros_comerciais
FOR INSERT
TO service_role
WITH CHECK (true);