-- =====================================================================
-- Migration: Create public views for HR schema tables
-- This solves the PostgREST 406 Not Acceptable errors by exposing
-- hr tables through the public schema without altering authenticator roles.
-- 
-- The views are created WITH (security_invoker = true) to enforce the RLS 
-- policies defined on the underlying tables.
-- =====================================================================

CREATE OR REPLACE VIEW public.hr_employee_records WITH (security_invoker = on) AS
SELECT * FROM hr.employee_records;

CREATE OR REPLACE VIEW public.hr_workflow_templates WITH (security_invoker = on) AS
SELECT * FROM hr.workflow_templates;

CREATE OR REPLACE VIEW public.hr_workflow_template_tasks WITH (security_invoker = on) AS
SELECT * FROM hr.workflow_template_tasks;

CREATE OR REPLACE VIEW public.hr_employee_workflows WITH (security_invoker = on) AS
SELECT * FROM hr.employee_workflows;

CREATE OR REPLACE VIEW public.hr_employee_workflow_tasks WITH (security_invoker = on) AS
SELECT * FROM hr.employee_workflow_tasks;
