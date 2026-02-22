-- ==============================================================================
-- FIX: PATCH 400 ERRORS ON SPECIFIC APPLICATION RECORDS
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- STEP 1: DIAGNOSE — Find applications with broken/missing relationships
-- These would cause the audit trigger to fail when stage is updated.
-- ──────────────────────────────────────────────────────────────────────────────
SELECT
  a.id,
  a.stage,
  a.source,
  a.created_at,
  a.candidate_id,
  a.role_id,
  c.full_name   AS candidate_name,
  r.title       AS role_title
FROM public.applications a
LEFT JOIN public.candidates c ON c.id = a.candidate_id
LEFT JOIN public.roles      r ON r.id = a.role_id
WHERE
  a.candidate_id IS NULL
  OR a.role_id IS NULL
  OR c.id IS NULL      -- candidate_id is set but candidate record was deleted
  OR r.id IS NULL;     -- role_id is set but role record was deleted


-- STEP 2: FIX — Make the audit trigger NULL-safe so broken records don't
-- block stage updates. Skips history logging when candidate/role is missing
-- instead of raising an exception that rolls back the whole UPDATE.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
        -- Guard: only log if we have the required denormalized keys
        IF NEW.candidate_id IS NOT NULL AND NEW.role_id IS NOT NULL THEN
            INSERT INTO public.application_history (
                application_id,
                candidate_id,
                role_id,
                actor_id,
                action_type,
                previous_stage,
                new_stage,
                metadata
            ) VALUES (
                NEW.id,
                NEW.candidate_id,
                NEW.role_id,
                auth.uid(),
                'STAGE_MOVED',
                OLD.stage,
                NEW.stage,
                jsonb_build_object('updated_via', 'trigger_update')
            );
        END IF;

    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW.candidate_id IS NOT NULL AND NEW.role_id IS NOT NULL THEN
            INSERT INTO public.application_history (
                application_id,
                candidate_id,
                role_id,
                actor_id,
                action_type,
                previous_stage,
                new_stage,
                metadata
            ) VALUES (
                NEW.id,
                NEW.candidate_id,
                NEW.role_id,
                auth.uid(),
                'CREATED',
                NULL,
                NEW.stage,
                jsonb_build_object('source', 'creation_event')
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- STEP 3: OPTIONAL — If Step 1 found applications with NULL candidate_id or
-- role_id, delete them (they're corrupted and cannot be used).
-- ONLY run this after reviewing Step 1's output and confirming those records
-- are safe to delete.
-- ──────────────────────────────────────────────────────────────────────────────
-- DELETE FROM public.applications
-- WHERE candidate_id IS NULL OR role_id IS NULL;


-- STEP 4: VERIFY — Confirm the trigger function was updated
-- ──────────────────────────────────────────────────────────────────────────────
SELECT
  proname   AS function_name,
  prosrc    AS function_body
FROM pg_proc
WHERE proname = 'log_application_stage_change';
