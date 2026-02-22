-- ==============================================================================
-- FIX CHECK CONSTRAINT AND UPDATE ORIGIN DATA
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Drop the old constraint that only allowed 'Indonesian Expat'
ALTER TABLE public.candidates 
DROP CONSTRAINT IF EXISTS candidates_origin_check;

-- 2. Add the new constraint with the updated wording
ALTER TABLE public.candidates 
ADD CONSTRAINT candidates_origin_check 
CHECK (origin IN ('Lombok Local', 'Indonesian (Non-Lombok)', 'International'));

-- 3. Now update the existing data
UPDATE public.candidates
SET origin = 'Indonesian (Non-Lombok)'
WHERE origin = 'Indonesian Expat';
