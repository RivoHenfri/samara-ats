-- Migration to grant satya@samaralombok.com Super Admin status

DO $$
DECLARE
    satya_id uuid;
    super_admin_role_id uuid;
    tenant uuid;
BEGIN
    -- Getting the user ID
    SELECT id INTO satya_id
    FROM public.profiles
    WHERE email = 'satya@samaralombok.com'
    LIMIT 1;

    -- Getting the role ID
    SELECT id INTO super_admin_role_id
    FROM rbac.roles
    WHERE name = 'Super Admin'
    LIMIT 1;

    IF satya_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
        -- We need to get tenant id from profile if it has one
        SELECT tenant_id INTO tenant
        FROM public.profiles
        WHERE id = satya_id
        LIMIT 1;

        IF tenant IS NOT NULL THEN
            DELETE FROM rbac.user_roles WHERE user_id = satya_id AND tenant_id = tenant;
            INSERT INTO rbac.user_roles (user_id, role_id, tenant_id)
            VALUES (satya_id, super_admin_role_id, tenant);
        END IF;

    END IF;
END $$;
