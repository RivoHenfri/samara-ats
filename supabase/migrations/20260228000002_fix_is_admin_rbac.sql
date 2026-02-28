-- =====================================================================
-- Migration: Fix public.is_admin() to integrate with RBAC
-- The hr schema previously relied on a missing "public.users" table.
-- This updates it to correctly use the actual permissions from the new 
-- rbac system (checking if the user has employees manage access).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
     SELECT rbac.has_permission(auth.uid(), 'employees', 'manage')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
