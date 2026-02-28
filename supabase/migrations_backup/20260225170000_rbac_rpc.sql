-- ==============================================================================
-- 8. Expose RBAC Permissions to the API Safely
-- ==============================================================================
-- Because the "rbac" schema is not exposed to the PostgREST API by default,
-- frontend queries directly to "rbac.user_roles" will fail with a PGRST205 error.
-- To solve this without changing global API configurations, we create a secure 
-- RPC function in the "public" schema that returns the exact array of permissions 
-- for the currently logged-in user.

CREATE OR REPLACE FUNCTION public.get_user_permissions()
RETURNS text[] AS $$
DECLARE
    perms text[];
BEGIN
    SELECT array_agg(p.module || ':' || p.action) INTO perms
    FROM rbac.user_roles ur
    JOIN rbac.roles r ON ur.role_id = r.id
    JOIN rbac.role_permissions rp ON r.id = rp.role_id
    JOIN rbac.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = public.current_tenant_id();
      
    RETURN COALESCE(perms, ARRAY[]::text[]);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
