CREATE OR REPLACE FUNCTION public.on_invite_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  func_url TEXT := 'https://devszzjyobijwldayicb.supabase.co/functions/v1/send-invite';
  -- Using Anon key valid for project devszzjyobijwldayicb
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldnN6emp5b2JpandsZGF5aWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNTQxNzUsImV4cCI6MjA4MDgzMDE3NX0.4iaizPS_qSAsCc2SZL0KpGErvHhASAWaIyu6UU3cMTY';
BEGIN
  -- We use net.http_post to call the edge function asynchronously
  PERFORM
    net.http_post(
      url := func_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$function$;
