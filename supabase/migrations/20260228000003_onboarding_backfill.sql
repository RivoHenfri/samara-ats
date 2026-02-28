-- =====================================================================
-- Migration: Seed Realistic Onboarding Templates and Backfill HR Records
-- 1. Inserts 4 comprehensive workflows for different ATS needs
-- 2. Backfills public.applications (Stage='Hired') into hr.employee_records
-- =====================================================================

-- 1. SEED WORKFLOW TEMPLATES
INSERT INTO hr.workflow_templates (id, name, description, type)
VALUES 
    (gen_random_uuid(), 'Hospitality Excellence (Resort)', 'Standard induction for F&B, Housekeeping, and Front Office roles.', 'Onboarding'),
    (gen_random_uuid(), 'Corporate & Management', 'Corporate onboarding for the Lombok Hub and managerial roles.', 'Onboarding'),
    (gen_random_uuid(), 'Construction & Engineering', 'Mandatory HSE and site induction for remote frontier operations.', 'Onboarding'),
    (gen_random_uuid(), 'International Relocation', 'Logistics, visa, and housing setup for expatriate hires.', 'Onboarding')
ON CONFLICT (name) DO NOTHING;

-- Map tasks to templates securely without hardcoded UUIDs
DO $$
DECLARE
    hosp_id UUID;
    corp_id UUID;
    const_id UUID;
    expat_id UUID;
BEGIN
    SELECT id INTO hosp_id FROM hr.workflow_templates WHERE name = 'Hospitality Excellence (Resort)';
    SELECT id INTO corp_id FROM hr.workflow_templates WHERE name = 'Corporate & Management';
    SELECT id INTO const_id FROM hr.workflow_templates WHERE name = 'Construction & Engineering';
    SELECT id INTO expat_id FROM hr.workflow_templates WHERE name = 'International Relocation';

    -- Clear existing tasks for idempotency 
    DELETE FROM hr.workflow_template_tasks WHERE template_id IN (hosp_id, corp_id, const_id, expat_id);

    -- Tasks: Hospitality Excellence
    IF hosp_id IS NOT NULL THEN
        INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
            (hosp_id, 'Uniform Sizing & Issuance', 'Measure and issue standard department attire (min 3 sets).', 1),
            (hosp_id, 'Guest Service Training', 'Half-day induction covering Samara Core Values.', 2),
            (hosp_id, 'Food Safety / Hygiene Sign-off', 'Mandatory checklist for kitchen & dining staff.', 3),
            (hosp_id, 'Resort Familiarization Tour', 'Guided tour of public areas, villas, and BOH.', 4);
    END IF;

    -- Tasks: Corporate & Management
    IF corp_id IS NOT NULL THEN
        INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
            (corp_id, 'IT Equipment & Accounts', 'Issue laptop, create O365 account, and setup ATS access.', 1),
            (corp_id, 'Benefits & Payroll Setup', 'Submit NPWP, BPJS, and direct deposit information.', 2),
            (corp_id, 'Welcome Lunch & 1:1', 'Schedule alignment lunch with Department Head.', 3),
            (corp_id, '30-60-90 Day Goal Setting', 'Draft probation period KPIs together with manager.', 4);
    END IF;

    -- Tasks: Construction & Engineering
    IF const_id IS NOT NULL THEN
        INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
            (const_id, 'PPE Procurement', 'Issue calibrated hardhat, steel-toes, and reflectives.', 1),
            (const_id, 'Site Health & Safety (HSE) Briefing', 'Mandatory half-day safety induction upon arrival.', 2),
            (const_id, 'Machinery Certification Check', 'Verify validity of operating licenses and certificates.', 3),
            (const_id, 'First Toolbox Talk', 'Introduce to team and assign to first safety patrol.', 4);
    END IF;

    -- Tasks: International Relocation
    IF expat_id IS NOT NULL THEN
        INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
            (expat_id, 'KITAS / Work Visa Documents', 'Collect passport bio, legalized degrees, and CV for agency.', 1),
            (expat_id, 'Flight & Arrival Pickup', 'Book flight mapping to LOP and schedule driver.', 2),
            (expat_id, 'Temporary Housing Assignment', 'Allocate transit villa or apartment for first 30 days.', 3),
            (expat_id, 'Local Lifeline Setup', 'Assist with local SIM card and Indonesian bank account.', 4);
    END IF;
END $$;


-- 2. BACKFILL HR EMPLOYEE RECORDS (Idempotent)
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
)
SELECT 
    a.candidate_id,
    a.id,
    split_part(c.full_name, ' ', 1) as first_name,
    CASE 
        WHEN position(' ' in c.full_name) > 0 
        THEN substring(c.full_name from position(' ' in c.full_name) + 1)
        ELSE ''
    END as last_name,
    c.email,
    c.whatsapp,
    COALESCE(r.department, 'General'),
    r.title as role,
    'Pending'
FROM public.applications a
JOIN public.candidates c ON c.id = a.candidate_id
JOIN public.roles r ON r.id = a.role_id
WHERE a.stage = 'Hired'
  -- Only insert if the record doesn't already exist for this candidate
  AND NOT EXISTS (
      SELECT 1 FROM hr.employee_records er 
      WHERE er.candidate_id = a.candidate_id
  );
