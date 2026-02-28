-- =====================================================================
-- Migration: Force Backfill Missing Employee Details
-- The previous backfill used INSERT ... WHERE NOT EXISTS. However, 
-- existing pending candidates were already inserted by the pipeline 
-- trigger but were missing first_name, last_name, role, and department.
-- This forces an UPDATE to populate the missing data so the UI can render.
-- =====================================================================

UPDATE hr.employee_records er
SET 
    first_name = split_part(c.full_name, ' ', 1),
    last_name = CASE 
        WHEN position(' ' in c.full_name) > 0 
        THEN substring(c.full_name from position(' ' in c.full_name) + 1)
        ELSE ''
    END,
    email = c.email,
    phone = c.whatsapp,
    department = COALESCE(r.department, 'General'),
    role = r.title,
    status = 'Pending'
FROM public.applications a
JOIN public.candidates c ON c.id = a.candidate_id
JOIN public.roles r ON r.id = a.role_id
WHERE er.candidate_id = a.candidate_id 
  AND a.stage = 'Hired'
  AND (er.first_name IS NULL OR er.first_name = '');
