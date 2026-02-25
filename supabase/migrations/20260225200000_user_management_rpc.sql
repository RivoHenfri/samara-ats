-- ==============================================================================
-- 9. User Management RPCs (Super Admin Only)
-- ==============================================================================

-- A internal helper to assert Super Admin status before executing sensitive RPCs
CREATE OR REPLACE FUNCTION rbac.is_super_admin()
RETURNS BOOLEAN AS $$
DECLARE
    _is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_roles ur
        JOIN rbac.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = 'Super Admin'
          AND ur.tenant_id = public.current_tenant_id()
    ) INTO _is_admin;
    RETURN _is_admin;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 9.1 Fetch all users and their currently assigned ATS roles
DROP FUNCTION IF EXISTS public.get_all_users_with_roles();
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
    id UUID,
    email TEXT,
    full_name TEXT,
    role_id UUID,
    role_name TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Security Check: Only Super Admins can list all users and their roles
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to view the user list.';
    END IF;

    RETURN QUERY
    SELECT 
        au.id,
        au.email::text,
        COALESCE(p.full_name, au.raw_user_meta_data->>'full_name', '') AS full_name,
        ur.role_id,
        COALESCE(r.name, 'Unassigned') AS role_name,
        au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    LEFT JOIN rbac.user_roles ur ON au.id = ur.user_id AND ur.tenant_id = public.current_tenant_id()
    LEFT JOIN rbac.roles r ON ur.role_id = r.id
    ORDER BY au.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9.2 Fetch available roles to populate the assignment dropdown
DROP FUNCTION IF EXISTS public.get_available_roles();
CREATE OR REPLACE FUNCTION public.get_available_roles()
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT
) AS $$
BEGIN
    -- Security Check
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to view roles.';
    END IF;

    RETURN QUERY
    SELECT r.id, r.name, r.description
    FROM rbac.roles r
    ORDER BY r.created_at ASC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- 9.3 Assign a specific role to a user
DROP FUNCTION IF EXISTS public.assign_user_role(UUID, UUID);
CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id UUID, target_role_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Security Check
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to assign roles.';
    END IF;

    -- Upsert the user role
    INSERT INTO rbac.user_roles (user_id, role_id, tenant_id)
    VALUES (target_user_id, target_role_id, public.current_tenant_id())
    ON CONFLICT (user_id, role_id, tenant_id) 
    DO UPDATE SET role_id = EXCLUDED.role_id;

    -- Alternatively, if a user can only have ONE role per tenant in your business logic, 
    -- we should delete old roles first or rely on a unique constraint. 
    -- Since the primary key is (user_id, role_id, tenant_id), to functionally "switch" a role
    -- we delete previous roles for this tenant first.
    
    DELETE FROM rbac.user_roles 
    WHERE user_id = target_user_id 
      AND tenant_id = public.current_tenant_id()
      AND role_id != target_role_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
