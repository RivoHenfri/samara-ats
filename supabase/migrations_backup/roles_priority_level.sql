-- ==============================================================================
-- ADD PRIORITY LEVEL TO ROLES
-- ==============================================================================

-- 1. Add priority_level column if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='roles' AND column_name='priority_level') THEN
        ALTER TABLE public.roles ADD COLUMN priority_level TEXT DEFAULT 'Normal';
    END IF;
END
$$;

-- 2. Migrate existing priority labels where applicable
-- Since Priority in the UI is becoming "Type" with options (Core, Support), 
-- we migrate Old "Critical" to "Core" on the backend data to match the UI constraints.
UPDATE public.roles 
SET priority = 'Core' 
WHERE priority = 'Critical';
