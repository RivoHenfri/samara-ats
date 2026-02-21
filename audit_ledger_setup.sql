-- ==============================================================================
-- ENTERPRISE AUDIT LEDGER FOR APPLICATION STAGES
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Create the Immutable History Table
-- This table is designed to be denormalized (storing candidate_id and role_id)
-- so you can execute fast UI queries without needing multi-table JOINs every time.
CREATE TABLE IF NOT EXISTS public.application_history (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
    candidate_id UUID NOT NULL,              -- Denormalized for fast candidate-level history
    role_id UUID NOT NULL,                   -- Denormalized for fast job-level history
    actor_id UUID REFERENCES auth.users(id), -- Records who made the change (Supabase Auth UID)
    action_type TEXT NOT NULL,               -- e.g., 'CREATED', 'STAGE_MOVED', 'BULK_REJECTED', 'NOTE_ADDED'
    previous_stage TEXT,                     -- Nullable (null if it's the initial creation)
    new_stage TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,      -- Extensible payload for rejection reasons, source, etc.
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Append-Only Protections
-- We strictly revoke all abilities to UPDATE or DELETE records from this table.
REVOKE UPDATE, DELETE ON public.application_history FROM PUBLIC, authenticated, anon;
-- (Optionally, also restrict Supabase service rolse if strict immutability is required)

-- 3. Row Level Security (RLS)
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;

-- Allow reading history for authenticated users (restrict to their tenant/org if multi-tenant)
CREATE POLICY "Users can read history" 
ON public.application_history FOR SELECT 
TO authenticated 
USING (true);

-- Allow inserting history
CREATE POLICY "Users can insert history" 
ON public.application_history FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- 4. High-Performance Indexing
-- These indexes handle your filtering requirements (by candidate, user, job, date range)
CREATE INDEX IF NOT EXISTS idx_app_hist_app_id ON public.application_history(application_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_candidate_id ON public.application_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_role_id ON public.application_history(role_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_actor_id ON public.application_history(actor_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_created_at ON public.application_history(created_at DESC);
-- GIN Index on metadata allows fast queries into the JSON (e.g., finding all histories with a specific rejection reason)
CREATE INDEX IF NOT EXISTS idx_app_hist_metadata ON public.application_history USING GIN (metadata);

-- ==============================================================================
-- AUTOMATIC AUDIT TRIGGER
-- ==============================================================================
-- This trigger automatically watches the 'applications' table.
-- Whenever an application is inserted or its stage is updated, the database 
-- writes the audit log directly. This means the frontend doesn't need to manually
-- write to the history table = 100% guarantee no actions are missed.

CREATE OR REPLACE FUNCTION log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
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
            auth.uid(), -- Extracts user ID from Supabase JWT Token automatically
            'STAGE_MOVED',
            OLD.stage,
            NEW.stage,
            -- Store any related data here if you expand the applications schema (e.g. rejection_reason)
            jsonb_build_object(
                'updated_via', 'trigger_update'
            )
        );
    ELSIF (TG_OP = 'INSERT') THEN
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists to allow re-running this script cleanly
DROP TRIGGER IF EXISTS trigger_log_app_stage ON public.applications;

CREATE TRIGGER trigger_log_app_stage
    AFTER INSERT OR UPDATE OF stage ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION log_application_stage_change();
