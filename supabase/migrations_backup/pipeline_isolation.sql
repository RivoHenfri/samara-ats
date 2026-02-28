-- 1. Create a dedicated HR schema
CREATE SCHEMA IF NOT EXISTS hr;

-- 2. Create the hr.employee_records table
CREATE TABLE IF NOT EXISTS hr.employee_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    hired_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'Onboarding',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by candidate
CREATE INDEX IF NOT EXISTS idx_employee_candidate_id ON hr.employee_records(candidate_id);

-- 3. Create public.audit_ledger table for tracking stage history
CREATE TABLE IF NOT EXISTS public.audit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    old_stage TEXT,
    new_stage TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient querying of specific application logs
CREATE INDEX IF NOT EXISTS idx_audit_application_id ON public.audit_ledger(application_id);

-- 4. Add rejection tracking to public.applications
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. Trigger Function: Log stage changes exactly when moving into a new stage
CREATE OR REPLACE FUNCTION public.log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO public.audit_ledger (application_id, old_stage, new_stage, changed_by)
        VALUES (
            NEW.id,
            OLD.stage,
            NEW.stage,
            auth.uid() -- captures the user making the change if via Supabase API
        );
        
        -- If moving to Hired, automatically provision HR record
        IF NEW.stage = 'Hired' THEN
            -- Only insert if one doesn't already exist for this candidate/application to prevent dupes
            IF NOT EXISTS (
                SELECT 1 FROM hr.employee_records 
                WHERE application_id = NEW.id
            ) THEN
                INSERT INTO hr.employee_records (candidate_id, application_id, hired_at)
                VALUES (NEW.candidate_id, NEW.id, NOW());
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger safely (ensure we drop it first for idempotent migrations)
DROP TRIGGER IF EXISTS trg_log_stage_change ON public.applications;
CREATE TRIGGER trg_log_stage_change
    AFTER UPDATE OF stage ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.log_application_stage_change();


-- 6. Zero-Downtime Migration & Data Backfill
-- Disable triggers temporarily on current session to prevent webhooks/duplicate logs
SET session_replication_role = 'replica';

-- Backfill existing "Hired" candidates into HR module
INSERT INTO hr.employee_records (candidate_id, application_id, hired_at, created_at)
SELECT candidate_id, id, updated_at, updated_at
FROM public.applications
WHERE stage = 'Hired'
  AND NOT EXISTS (
      SELECT 1 FROM hr.employee_records er WHERE er.application_id = public.applications.id
  );

-- Backfill the audit_ledger with a starting entry representing the *current* state of all applications
-- so metrics queries don't fail for existing candidates.
INSERT INTO public.audit_ledger (application_id, old_stage, new_stage, changed_at)
SELECT id, NULL, stage, updated_at
FROM public.applications
WHERE NOT EXISTS (
    SELECT 1 FROM public.audit_ledger al WHERE al.application_id = public.applications.id
);

-- Re-enable normal triggers
SET session_replication_role = 'origin';

-- Set RLS policies for hr.employee_records (assuming similar access pattern to recruiting)
ALTER TABLE hr.employee_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to hr.employee_records" 
    ON hr.employee_records
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Set RLS policies for public.audit_ledger
ALTER TABLE public.audit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated select on audit_ledger" 
    ON public.audit_ledger
    FOR SELECT 
    TO authenticated 
    USING (true);
    
CREATE POLICY "Allow authenticated insert on audit_ledger" 
    ON public.audit_ledger
    FOR INSERT 
    TO authenticated 
    WITH CHECK (true);
