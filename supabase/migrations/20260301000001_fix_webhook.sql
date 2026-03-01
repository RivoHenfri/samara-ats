-- Migration: Fix AI Scoring Webhook URL
-- Replaces localhost kong URL with the actual project Edge Function URL

CREATE OR REPLACE FUNCTION public.trigger_ai_scoring()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Provide production URL directly
  edge_function_url := 'https://cyxlgjpkldefwmjvcjxt.supabase.co/functions/v1/score-candidate';
  
  -- The anon key from the project (fallback auth)
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5eGxnanBrbGRlZndtanZjanh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzE5NTUsImV4cCI6MjA4NjcwNzk1NX0.NoVYY7lckWqUuuTZgtwBwSgI1mUzDC7UUVvZ1meWHrk';

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
