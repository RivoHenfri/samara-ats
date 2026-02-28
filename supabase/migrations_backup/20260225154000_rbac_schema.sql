-- ==============================================================================
-- RBAC VIA NEGATIVA DEFINITIONS (DEFAULT DENY)
-- Schema, Tables, Seeds, and RLS re-wiring
-- ==============================================================================

-- 1. Create RBAC Schema
CREATE SCHEMA IF NOT EXISTS rbac;

-- 2. Define Tables
CREATE TABLE IF NOT EXISTS rbac.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS rbac.role_permissions (
    role_id UUID REFERENCES rbac.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES rbac.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS rbac.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES rbac.roles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, role_id, tenant_id)
);

-- 3. Basic Helper Function to check permissions securely
CREATE OR REPLACE FUNCTION rbac.has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    _has_access BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_roles ur
        JOIN rbac.role_permissions rp ON ur.role_id = rp.role_id
        JOIN rbac.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = _user_id
          AND p.module = _module
          AND p.action = _action
          AND ur.tenant_id = public.current_tenant_id()
    ) INTO _has_access;

    RETURN _has_access;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 4. Seed Essential Roles
INSERT INTO rbac.roles (name, description) VALUES
    ('Super Admin', 'Full system access'),
    ('TA Lead / HR', 'Full ATS operational access but restricted settings'),
    ('Hiring Manager', 'Restricted to owning roles and direct applicants'),
    ('Viewer / Interviewer', 'Read-only access to assigned candidates')
ON CONFLICT (name) DO NOTHING;

-- 5. Seed Permissions Matrix Definition
INSERT INTO rbac.permissions (module, action, description) VALUES
    ('candidates', 'read', 'View candidates'),
    ('candidates', 'insert', 'Add new candidates'),
    ('candidates', 'update', 'Edit candidate details'),
    ('candidates', 'delete', 'Delete candidates'),

    ('applications', 'read', 'View pipeline applications'),
    ('applications', 'insert', 'Add pipeline applications'),
    ('applications', 'update', 'Move stages or update pipeline applications'),
    ('applications', 'delete', 'Delete applications'),

    ('roles', 'read', 'View roles/job reqs'),
    ('roles', 'insert', 'Create new roles'),
    ('roles', 'update', 'Edit role details'),
    ('roles', 'delete', 'Archive roles'),

    ('settings', 'manage', 'Full access to ATS settings'),
    ('employees', 'manage', 'Full HR employee data access')
ON CONFLICT (module, action) DO NOTHING;

-- Map basic permissive matrix for Super Admin
DO $$
DECLARE
    super_admin_id UUID;
BEGIN
    SELECT id INTO super_admin_id FROM rbac.roles WHERE name = 'Super Admin';
    
    INSERT INTO rbac.role_permissions (role_id, permission_id)
    SELECT super_admin_id, id FROM rbac.permissions
    ON CONFLICT DO NOTHING;
END $$;

-- Map for TA Lead / HR (Everything except settings)
DO $$
DECLARE
    hr_id UUID;
BEGIN
    SELECT id INTO hr_id FROM rbac.roles WHERE name = 'TA Lead / HR';
    
    INSERT INTO rbac.role_permissions (role_id, permission_id)
    SELECT hr_id, id FROM rbac.permissions WHERE module != 'settings'
    ON CONFLICT DO NOTHING;
END $$;


-- 6. Overwrite Public Row-Level Security Policies carefully enforcing Via Negativa.

-- Candidates
DROP POLICY IF EXISTS "Tenant Candidates Read" ON public.candidates;
CREATE POLICY "Tenant Candidates Read" ON public.candidates FOR SELECT TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'candidates', 'read'));

DROP POLICY IF EXISTS "Tenant Candidates Insert" ON public.candidates;
CREATE POLICY "Tenant Candidates Insert" ON public.candidates FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'candidates', 'insert'));

DROP POLICY IF EXISTS "Tenant Candidates Update" ON public.candidates;
CREATE POLICY "Tenant Candidates Update" ON public.candidates FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'candidates', 'update'))
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'candidates', 'update'));


-- Candidates Delete
DROP POLICY IF EXISTS "Tenant Candidates Delete" ON public.candidates;
CREATE POLICY "Tenant Candidates Delete" ON public.candidates FOR DELETE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'candidates', 'delete'));

-- Applications Read
DROP POLICY IF EXISTS "Tenant Applications Read" ON public.applications;
CREATE POLICY "Tenant Applications Read" ON public.applications FOR SELECT TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'applications', 'read'));

-- Applications Insert
DROP POLICY IF EXISTS "Tenant Applications Insert" ON public.applications;
CREATE POLICY "Tenant Applications Insert" ON public.applications FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'applications', 'insert'));

-- Applications Update
DROP POLICY IF EXISTS "Tenant Applications Update" ON public.applications;
CREATE POLICY "Tenant Applications Update" ON public.applications FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'applications', 'update'))
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'applications', 'update'));

-- Applications Delete
DROP POLICY IF EXISTS "Tenant Applications Delete" ON public.applications;
CREATE POLICY "Tenant Applications Delete" ON public.applications FOR DELETE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'applications', 'delete'));

-- Roles Read
DROP POLICY IF EXISTS "Tenant Roles Read" ON public.roles;
CREATE POLICY "Tenant Roles Read" ON public.roles FOR SELECT TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'roles', 'read'));

-- Roles Insert
DROP POLICY IF EXISTS "Tenant Roles Insert" ON public.roles;
CREATE POLICY "Tenant Roles Insert" ON public.roles FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'roles', 'insert'));

-- Roles Update
DROP POLICY IF EXISTS "Tenant Roles Update" ON public.roles;
CREATE POLICY "Tenant Roles Update" ON public.roles FOR UPDATE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'roles', 'update'))
    WITH CHECK (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'roles', 'update'));

-- Roles Delete
DROP POLICY IF EXISTS "Tenant Roles Delete" ON public.roles;
CREATE POLICY "Tenant Roles Delete" ON public.roles FOR DELETE TO authenticated
    USING (tenant_id = public.current_tenant_id() AND rbac.has_permission(auth.uid(), 'roles', 'delete'));

-- ==============================================================================
-- 7. Assign Super Admin to user: satya@samaralombok.com
-- ==============================================================================

DO $$
DECLARE
    target_user_id UUID;
    super_admin_role_id UUID;
BEGIN
    -- Find the user ID based on the email
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'satya@samaralombok.com' LIMIT 1;
    
    -- Find the Super Admin role ID
    SELECT id INTO super_admin_role_id FROM rbac.roles WHERE name = 'Super Admin' LIMIT 1;

    -- Only insert if the user actually exists in the Auth table
    IF target_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
        INSERT INTO rbac.user_roles (user_id, role_id, tenant_id)
        VALUES (
            target_user_id, 
            super_admin_role_id, 
            '00000000-0000-0000-0000-000000000001' -- Default Samara Lombok Tenant
        ) ON CONFLICT DO NOTHING;
    END IF;
END $$;
