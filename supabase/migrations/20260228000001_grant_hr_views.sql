-- =====================================================================
-- Migration: Grant privileges for HR public views and schema
-- PostgREST requires the active role (authenticated/anon) to have explicitly
-- granted permissions to query the views, and for security invoker views,
-- they also need usage on the underlying schema and tables.
-- =====================================================================

-- 1. Grant usage on the custom 'hr' schema
GRANT USAGE ON SCHEMA hr TO authenticated, anon;

-- 2. Grant privileges on all hr tables to allow security_invoker to run queries
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hr TO authenticated, anon;

-- 3. In case future tables are added to the hr schema, ensure privileges are granted automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA hr 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, anon;

-- 4. Grant privileges on the newly created public views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_records TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_templates TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_workflow_template_tasks TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_workflows TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_employee_workflow_tasks TO authenticated, anon;
