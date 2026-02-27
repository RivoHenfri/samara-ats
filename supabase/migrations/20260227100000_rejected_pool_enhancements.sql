-- ============================================================
-- Migration: Rejected Pool Enhancements
-- Adds rejection metadata columns, auto-populate trigger,
-- partial indexes, and RBAC permission for reconsideration.
-- ============================================================

-- 1. Add structured rejection metadata columns
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS rejected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by    UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_stage TEXT;

-- 2. Backfill rejected_at and rejection_stage from application_history
UPDATE public.applications a
SET
  rejected_at = COALESCE(
    (SELECT ah.created_at
     FROM public.application_history ah
     WHERE ah.application_id = a.id
       AND ah.new_stage = 'Rejected'
     ORDER BY ah.created_at DESC
     LIMIT 1),
    a.updated_at
  ),
  rejection_stage = COALESCE(
    (SELECT ah.previous_stage
     FROM public.application_history ah
     WHERE ah.application_id = a.id
       AND ah.new_stage = 'Rejected'
     ORDER BY ah.created_at DESC
     LIMIT 1),
    'Unknown'
  )
WHERE a.stage = 'Rejected' AND a.rejected_at IS NULL;

-- 3. BEFORE UPDATE trigger to auto-populate rejection metadata
CREATE OR REPLACE FUNCTION public.handle_rejection_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- When moving INTO Rejected
  IF NEW.stage = 'Rejected' AND (OLD.stage IS NULL OR OLD.stage != 'Rejected') THEN
    NEW.rejected_at    := NOW();
    NEW.rejected_by    := auth.uid();
    NEW.rejection_stage := OLD.stage;
  END IF;

  -- When reconsidered (moved OUT of Rejected)
  IF OLD.stage = 'Rejected' AND NEW.stage != 'Rejected' THEN
    NEW.rejected_at     := NULL;
    NEW.rejected_by     := NULL;
    NEW.rejection_stage := NULL;
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_rejection_metadata ON public.applications;
CREATE TRIGGER trg_rejection_metadata
  BEFORE UPDATE OF stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_rejection_metadata();

-- 4. Partial indexes for rejected pool queries
CREATE INDEX IF NOT EXISTS idx_applications_rejected
  ON public.applications(rejected_at DESC)
  WHERE stage = 'Rejected';

CREATE INDEX IF NOT EXISTS idx_applications_rejection_reason
  ON public.applications(rejection_reason)
  WHERE stage = 'Rejected';

-- 5. RBAC: add 'reconsider' permission for applications
INSERT INTO rbac.permissions (module, action, description) VALUES
  ('applications', 'reconsider', 'Move rejected candidates back into the active pipeline')
ON CONFLICT (module, action) DO NOTHING;

-- Grant to Super Admin and TA Lead / HR
DO $$
DECLARE r_id UUID;
BEGIN
  FOR r_id IN SELECT id FROM rbac.roles WHERE name IN ('Super Admin', 'TA Lead / HR')
  LOOP
    INSERT INTO rbac.role_permissions (role_id, permission_id)
    SELECT r_id, p.id
    FROM rbac.permissions p
    WHERE p.module = 'applications' AND p.action = 'reconsider'
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
