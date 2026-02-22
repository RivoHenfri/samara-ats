-- ==============================================================================
-- FIX: applications_stage_check CONSTRAINT
-- The stage CHECK constraint is missing the new interview sub-stages added
-- when interview scheduling was implemented.
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- 1. Drop the outdated constraint
ALTER TABLE public.applications
DROP CONSTRAINT IF EXISTS applications_stage_check;

-- 2. Re-add with all current valid stages
ALTER TABLE public.applications
ADD CONSTRAINT applications_stage_check
CHECK (stage IN (
  'New',
  'Screening',
  'Interview Pending',
  'Interview Scheduled',
  'Interview Completed',
  'Offer',
  'Hired',
  'Rejected'
));

-- 3. Verify
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'applications_stage_check';
