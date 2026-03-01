-- ============================================================
-- 09_screening_verdict.sql
-- Adds screening verdict + comment columns to applications
-- for Role Summary feature.
-- ============================================================

-- 1. Add screening verdict column (Passed / Failed / Passed with concern)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_verdict text;

-- 2. Add screening comment column (recruiter's manual screening notes)
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS screening_comment text;

-- 3. Constrain verdict to valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_screening_verdict_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_screening_verdict_check
      CHECK (screening_verdict IS NULL OR screening_verdict IN ('passed', 'failed', 'passed_with_concern'));
  END IF;
END $$;

-- 4. Index for efficient filtering by verdict
CREATE INDEX IF NOT EXISTS idx_applications_screening_verdict
  ON public.applications (screening_verdict)
  WHERE screening_verdict IS NOT NULL;
