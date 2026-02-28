-- Create HR Schema
CREATE SCHEMA IF NOT EXISTS hr;

-- Ensure EXTENSION for UUIDs if not already there
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Employees Table (Repair/Extend if already exists)
CREATE TABLE IF NOT EXISTS hr.employee_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    department TEXT,
    role TEXT,
    manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Pending',
    start_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns in case hr.employee_records was created by pipeline_isolation.sql
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'first_name') THEN
        ALTER TABLE hr.employee_records ADD COLUMN first_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'last_name') THEN
        ALTER TABLE hr.employee_records ADD COLUMN last_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'email') THEN
        ALTER TABLE hr.employee_records ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'phone') THEN
        ALTER TABLE hr.employee_records ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'department') THEN
        ALTER TABLE hr.employee_records ADD COLUMN department TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'role') THEN
        ALTER TABLE hr.employee_records ADD COLUMN role TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'manager_id') THEN
        ALTER TABLE hr.employee_records ADD COLUMN manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'hr' AND table_name = 'employee_records' AND column_name = 'start_date') THEN
        ALTER TABLE hr.employee_records ADD COLUMN start_date DATE;
    END IF;
END $$;

-- Workflow Tables
CREATE TABLE IF NOT EXISTS hr.workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    type TEXT DEFAULT 'Onboarding',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr.workflow_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES hr.workflow_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr.employee_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES hr.employee_records(id) ON DELETE CASCADE,
    template_id UUID REFERENCES hr.workflow_templates(id) ON DELETE RESTRICT,
    status TEXT DEFAULT 'Scheduled',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr.employee_workflow_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_workflow_id UUID REFERENCES hr.employee_workflows(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    is_required BOOLEAN DEFAULT true,
    completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-Trigger: Move Hired Candidates to HR Queue ----------------
-- Fixed: Listens to 'public.applications' stage change to 'Hired'
DROP FUNCTION IF EXISTS public.handle_hired_candidate() CASCADE;
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
                first_name,
                last_name,
                email,
                phone,
                department,
                role,
                status
            ) VALUES (
                cand_row.id,
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
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger on candidates if it was created by mistake
DROP TRIGGER IF EXISTS candidate_hired_trigger ON public.candidates;

-- Create correct trigger on applications
DROP TRIGGER IF EXISTS trg_hired_to_onboarding ON public.applications;
CREATE TRIGGER trg_hired_to_onboarding
    AFTER UPDATE OF stage ON public.applications
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_hired_candidate();


-- Row Level Security (RLS) --------------------------------------
ALTER TABLE hr.employee_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.workflow_template_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_workflow_tasks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'Admin' FROM public.users WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. hr.employee_records
DROP POLICY IF EXISTS "Admins have full access to employee_records" ON hr.employee_records;
CREATE POLICY "Admins have full access to employee_records" ON hr.employee_records
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Hiring Managers can view their direct reports" ON hr.employee_records;
CREATE POLICY "Hiring Managers can view their direct reports" ON hr.employee_records
    FOR SELECT USING (manager_id = auth.uid());

DROP POLICY IF EXISTS "Hiring Managers can update their direct reports" ON hr.employee_records;
CREATE POLICY "Hiring Managers can update their direct reports" ON hr.employee_records
    FOR UPDATE USING (manager_id = auth.uid());


-- 2. hr.workflow_templates
DROP POLICY IF EXISTS "Admins have full access to workflow_templates" ON hr.workflow_templates;
CREATE POLICY "Admins have full access to workflow_templates" ON hr.workflow_templates
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Everyone can read workflow_templates" ON hr.workflow_templates;
CREATE POLICY "Everyone can read workflow_templates" ON hr.workflow_templates
    FOR SELECT USING (true);


-- 3. hr.workflow_template_tasks
DROP POLICY IF EXISTS "Admins have full access to workflow_template_tasks" ON hr.workflow_template_tasks;
CREATE POLICY "Admins have full access to workflow_template_tasks" ON hr.workflow_template_tasks
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Everyone can read workflow_template_tasks" ON hr.workflow_template_tasks;
CREATE POLICY "Everyone can read workflow_template_tasks" ON hr.workflow_template_tasks
    FOR SELECT USING (true);


-- 4. hr.employee_workflows
DROP POLICY IF EXISTS "Admins have full access to employee_workflows" ON hr.employee_workflows;
CREATE POLICY "Admins have full access to employee_workflows" ON hr.employee_workflows
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Hiring Managers can view workflows of direct reports" ON hr.employee_workflows;
CREATE POLICY "Hiring Managers can view workflows of direct reports" ON hr.employee_workflows
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM hr.employee_records er 
            WHERE er.id = employee_id AND er.manager_id = auth.uid()
        )
    );


-- 5. hr.employee_workflow_tasks
DROP POLICY IF EXISTS "Admins have full access to employee_workflow_tasks" ON hr.employee_workflow_tasks;
CREATE POLICY "Admins have full access to employee_workflow_tasks" ON hr.employee_workflow_tasks
    FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Hiring Managers can view workflow tasks of direct reports" ON hr.employee_workflow_tasks;
CREATE POLICY "Hiring Managers can view workflow tasks of direct reports" ON hr.employee_workflow_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM hr.employee_workflows ew
            JOIN hr.employee_records er ON ew.employee_id = er.id
            WHERE ew.id = employee_workflow_id AND er.manager_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Hiring Managers can update workflow tasks of direct reports" ON hr.employee_workflow_tasks;
CREATE POLICY "Hiring Managers can update workflow tasks of direct reports" ON hr.employee_workflow_tasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM hr.employee_workflows ew
            JOIN hr.employee_records er ON ew.employee_id = er.id
            WHERE ew.id = employee_workflow_id AND er.manager_id = auth.uid()
        )
    );

-- Seed Templates
INSERT INTO hr.workflow_templates (id, name, description)
VALUES 
    (gen_random_uuid(), 'Sumbawa Frontier Deployment', 'Standard induction and logistics for Sumbawa remote roles.'),
    (gen_random_uuid(), 'Lombok Hub Onboarding', 'Corporate and operational onboarding for the Lombok main office.')
ON CONFLICT (name) DO NOTHING;

-- Get the generated UUIDs to insert tasks
DO $$
DECLARE
    sumbawa_id UUID;
    lombok_id UUID;
BEGIN
    SELECT id INTO sumbawa_id FROM hr.workflow_templates WHERE name = 'Sumbawa Frontier Deployment';
    SELECT id INTO lombok_id FROM hr.workflow_templates WHERE name = 'Lombok Hub Onboarding';

    -- Clear existing tasks for these templates to avoid duplicates on re-run
    DELETE FROM hr.workflow_template_tasks WHERE template_id IN (sumbawa_id, lombok_id);

    -- Tasks for Sumbawa
    INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
        (sumbawa_id, 'Approve TCOW budget allocation', 'Finalize camp and travel allowance.', 1),
        (sumbawa_id, 'Procure PPE gear', 'Hardhat, boots, reflective vest according to sizing.', 2),
        (sumbawa_id, 'Book travel arrangements', 'Flight and local transport to the frontier site.', 3),
        (sumbawa_id, 'Schedule Site Health & Safety Briefing', 'Mandatory 4-hour seminar upon arrival.', 4);

    -- Tasks for Lombok
    INSERT INTO hr.workflow_template_tasks (template_id, title, description, sort_order) VALUES
        (lombok_id, 'IT Provisioning', 'Issue company laptop and create Azure AD account.', 1),
        (lombok_id, 'Building Access', 'Issue keycard and register biometrics.', 2),
        (lombok_id, 'Welcome Lunch Alignment', 'Schedule welcome lunch with department head.', 3),
        (lombok_id, 'Compliance Signatures', 'Collect signed NDA and Employee Handbook acknowledgment.', 4);
END $$;
