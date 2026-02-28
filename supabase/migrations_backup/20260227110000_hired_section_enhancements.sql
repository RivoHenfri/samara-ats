-- ============================================================
-- Migration: Hired Section Enhancements
-- Adds hire metadata columns, auto-populate trigger,
-- application_id link on hr.employee_records, and partial indexes.
-- ============================================================

-- 1. Add hire metadata columns to applications
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS hired_by UUID REFERENCES auth.users(id);

-- 2. Backfill hired_at from application_history
UPDATE public.applications a
SET hired_at = COALESCE(
  (SELECT ah.created_at
   FROM public.application_history ah
   WHERE ah.application_id = a.id
     AND ah.new_stage = 'Hired'
   ORDER BY ah.created_at DESC
   LIMIT 1),
  a.updated_at
)
WHERE a.stage = 'Hired' AND a.hired_at IS NULL;

-- 3. BEFORE UPDATE trigger to auto-populate hire metadata
CREATE OR REPLACE FUNCTION public.handle_hire_metadata()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stage = 'Hired' AND (OLD.stage IS NULL OR OLD.stage != 'Hired') THEN
    NEW.hired_at := NOW();
    NEW.hired_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_hire_metadata ON public.applications;
CREATE TRIGGER trg_hire_metadata
  BEFORE UPDATE OF stage ON public.applications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_hire_metadata();

-- 4. Add application_id to hr.employee_records for full audit trail linkage
ALTER TABLE hr.employee_records
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.applications(id);

-- Backfill application_id from applications via candidate_id
UPDATE hr.employee_records er
SET application_id = (
  SELECT a.id
  FROM public.applications a
  WHERE a.candidate_id = er.candidate_id
    AND a.stage = 'Hired'
  ORDER BY a.updated_at DESC
  LIMIT 1
)
WHERE er.application_id IS NULL;

-- 5. Update the existing handle_hired_candidate() trigger to also set application_id
CREATE OR REPLACE FUNCTION public.handle_hired_candidate()
RETURNS TRIGGER AS $$
DECLARE
    cand_row RECORD;
    emp_department TEXT;
    role_title TEXT;
BEGIN
    -- Only act if stage changes TO 'Hired'
    IF NEW.stage = 'Hired' AND (OLD.stage IS NULL OR OLD.stage != 'Hired') THEN

        -- Get candidate details
        SELECT * INTO cand_row FROM public.candidates WHERE id = NEW.candidate_id;

        -- Get role details for department
        SELECT title INTO role_title FROM public.roles WHERE id = NEW.role_id;
        SELECT COALESCE((SELECT department FROM public.roles WHERE id = NEW.role_id LIMIT 1), 'General')
        INTO emp_department;

        -- Insert into hr.employee_records (idempotent check)
        IF NOT EXISTS (SELECT 1 FROM hr.employee_records WHERE candidate_id = NEW.candidate_id) THEN
            INSERT INTO hr.employee_records (
                candidate_id,
                application_id,
                first_name,
                last_name,
                email,
                phone,
                department,
                role,
                status
            ) VALUES (
                cand_row.id,
                NEW.id,
                split_part(cand_row.full_name, ' ', 1),
                CASE
                    WHEN position(' ' in cand_row.full_name) > 0
                    THEN substring(cand_row.full_name from position(' ' in cand_row.full_name) + 1)
                    ELSE ''
                END,
                cand_row.email,
                cand_row.whatsapp,
                emp_department,
                role_title,
                'Pending'
            );
        ELSE
            -- If employee record already exists, update the application_id
            UPDATE hr.employee_records
            SET application_id = NEW.id
            WHERE candidate_id = NEW.candidate_id
              AND application_id IS NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Partial index for hired pool queries
CREATE INDEX IF NOT EXISTS idx_applications_hired
  ON public.applications(hired_at DESC)
  WHERE stage = 'Hired';
