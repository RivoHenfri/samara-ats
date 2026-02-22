-- ==============================================================================
-- INTERVIEW SCHEDULING V2 — New columns, interview_rounds, stage enforcement
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Admin-managed interview rounds table
CREATE TABLE IF NOT EXISTS public.interview_rounds (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE public.interview_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rounds"
ON public.interview_rounds FOR SELECT
TO authenticated
USING (true);

-- Seed default rounds
INSERT INTO public.interview_rounds (name, sort_order)
VALUES ('HR', 1), ('Technical', 2), ('Final', 3)
ON CONFLICT (name) DO NOTHING;

-- 2. Add new columns to interviews table
ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS interview_type TEXT NOT NULL DEFAULT 'Online';

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS round TEXT;

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS interviewers TEXT[] DEFAULT '{}';

ALTER TABLE public.interviews
ADD COLUMN IF NOT EXISTS location TEXT;

-- Check constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_type_check'
  ) THEN
    ALTER TABLE public.interviews
    ADD CONSTRAINT interviews_type_check
    CHECK (interview_type IN ('Online', 'Onsite'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'interviews_location_check'
  ) THEN
    ALTER TABLE public.interviews
    ADD CONSTRAINT interviews_location_check
    CHECK (location IS NULL OR location IN ('Lombok', 'Sumbawa', 'Bali', 'Jakarta'));
  END IF;
END $$;

-- 3. Stage enforcement trigger
-- Blocks moving to 'Interview Scheduled' unless a scheduled interview exists
CREATE OR REPLACE FUNCTION enforce_interview_scheduled_stage()
RETURNS TRIGGER AS $$
DECLARE
  has_scheduled BOOLEAN;
BEGIN
  -- Only fire when stage is being changed TO 'Interview Scheduled'
  IF NEW.stage = 'Interview Scheduled'
     AND (OLD.stage IS NULL OR OLD.stage IS DISTINCT FROM 'Interview Scheduled') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.interviews
      WHERE application_id = NEW.id
        AND scheduled_at IS NOT NULL
    ) INTO has_scheduled;

    IF NOT has_scheduled THEN
      RAISE EXCEPTION 'Cannot move to Interview Scheduled: no interview with a scheduled date exists for this application.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_enforce_interview_scheduled ON public.applications;
CREATE TRIGGER trigger_enforce_interview_scheduled
  BEFORE UPDATE OF stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION enforce_interview_scheduled_stage();
