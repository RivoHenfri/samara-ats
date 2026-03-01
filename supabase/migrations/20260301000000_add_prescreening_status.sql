-- Migration: Add missing prescreening_status to applications table
-- This fixes the 400 Bad Request when triggering autoPreparePrescreen which attempts to update prescreening_status

ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS prescreening_status text;

-- Also adding the prescreening workflow tracking status just in case it's used elsewhere for filtering applications.
CREATE INDEX IF NOT EXISTS idx_applications_prescreening_status
ON public.applications(prescreening_status);
