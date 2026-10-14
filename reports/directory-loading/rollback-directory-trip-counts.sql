-- Use only after reverting the frontend that calls this RPC.
-- Additive function rollback: no application records or policies are changed.
BEGIN;
DROP FUNCTION IF EXISTS public.directory_trip_counts(uuid, text);
NOTIFY pgrst, 'reload schema';
COMMIT;
