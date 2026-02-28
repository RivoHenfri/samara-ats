-- Migration: Create Webhook to Trigger Edge Function
-- This sets up a database trigger to automatically call 'score-candidate'
-- when a new application is inserted, or it is explicitly set back to 'pending'.

-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create the trigger function that makes the background HTTP request
CREATE OR REPLACE FUNCTION public.trigger_ai_scoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- We assume the URL and KEY are available in the Vault or we can use the local/Supabase URLs.
  -- In production, the Supabase project URL is constructed differently, but using pg_net webhooks 
  -- via Supabase UI is standard. Since we are doing it via SQL:
  
  -- The Edge Function URL (adjust the domain in production or use env vars if available in Postgres)
  -- A safer way in Supabase migrations is to rely on the current host logic or a custom setting,
  -- but commonly we just define the webhook intent.
  
  edge_function_url := current_setting('custom.edge_function_url', true);
  service_role_key := current_setting('custom.service_role_key', true);

  -- If not set via settings, fallback to standard local URL for dev or you can configure this per environment
  IF edge_function_url IS NULL THEN
     edge_function_url := 'http://kong:8000/functions/v1/score-candidate';
  END IF;

  IF service_role_key IS NULL THEN
     service_role_key := 'anon'; -- fallback, should be configured in deployment
  END IF;

  PERFORM net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'schema', TG_TABLE_SCHEMA,
          'record', row_to_json(NEW),
          'old_record', row_to_json(OLD)
      )
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS tr_score_new_candidate ON public.applications;

-- Create the trigger: After INSERT or UPDATE when status returns to 'pending'
CREATE TRIGGER tr_score_new_candidate
AFTER INSERT OR UPDATE OF scoring_status ON public.applications
FOR EACH ROW
WHEN (
  NEW.scoring_status = 'pending'
)
EXECUTE FUNCTION public.trigger_ai_scoring();
