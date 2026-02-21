-- ==============================================================================
-- ENTERPRISE MULTI-TENANCY & RLS SETUP
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Create the Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insert the Default Tenant (Samara Lombok)
-- We insert an initial tenant and keep its ID specifically for migrating existing data
INSERT INTO public.tenants (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Samara Lombok')
ON CONFLICT DO NOTHING;

-- 3. Add tenant_id to all core tables 
-- By default, all existing records are assigned to the "Samara Lombok" tenant.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.application_history ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Make tenant_id NOT NULL for future inserts (optional, but good practice if all rows have defaults)
-- ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
-- ALTER TABLE public.roles ALTER COLUMN tenant_id SET NOT NULL;

-- 4. Enable Row-Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;

-- 5. Helper Function: Get Current Tenant ID from JWT claims
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id', ''))::UUID;
$$ LANGUAGE SQL STABLE;

-- 6. Helper Function: Sync Profile -> Auth JWT App Metadata
-- This trigger fires whenever a profile is inserted or updated.
-- It injects the user's `role` and `tenant_id` directly into the Supabase auth token.
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS trigger AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        json_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role)::jsonb
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_auth
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth();

-- 7. Define RLS Policies for Tenants
-- Read Policies
CREATE POLICY "Tenant Profiles Read" ON public.profiles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Roles Read" ON public.roles FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Candidates Read" ON public.candidates FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Applications Read" ON public.applications FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant History Read" ON public.application_history FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

-- Write Policies (Using WITH CHECK to ensure users can only insert for their own tenant)
CREATE POLICY "Tenant Profiles Update" ON public.profiles FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant Roles Insert" ON public.roles FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Roles Update" ON public.roles FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Roles Delete" ON public.roles FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant Candidates Insert" ON public.candidates FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Candidates Update" ON public.candidates FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant Applications Insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Applications Update" ON public.applications FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant Applications Delete" ON public.applications FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());
