-- ─────────────────────────────────────────────────────────────────────────────
-- Public Careers Page Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS guards).
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Tenant slug ──────────────────────────────────────────────────────────────
--    Stable, human-readable URL segment for the careers page.
--    Decoupled from tenant.name so renaming a tenant doesn't break URLs.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Seed the default Samara Lombok tenant
UPDATE public.tenants
  SET slug = 'samara-lombok'
  WHERE id = '00000000-0000-0000-0000-000000000001'
    AND slug IS NULL;

-- Enforce non-null after backfill (safe because we just set the only existing row)
ALTER TABLE public.tenants
  ALTER COLUMN slug SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_slug
  ON public.tenants (slug);


-- B. Source tracking on applications ─────────────────────────────────────────
--    Tracks how each application entered the system.
--    Existing rows get DEFAULT 'Manual' automatically.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'Manual';

ALTER TABLE public.applications
  DROP CONSTRAINT IF EXISTS chk_applications_source;

ALTER TABLE public.applications
  ADD CONSTRAINT chk_applications_source
  CHECK (source IN ('Manual', 'Career Page', 'Import', 'Referral'));


-- C. Cover letter ─────────────────────────────────────────────────────────────
--    Submission-specific text; lives on applications (not candidates) because
--    the same candidate may apply to multiple roles with different cover letters.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS cover_letter TEXT;


-- D. RLS policies for anonymous reads ────────────────────────────────────────
--    The careers page is fully public — no login required.
--    These policies expose only open job listings (no personal data).
--    All writes still go through the careers-submit Edge Function
--    (service role key, server-side validation) — no anon INSERT policies added.

-- Allow anon to look up a tenant by slug (CareersPage: slug → tenant.id)
DROP POLICY IF EXISTS "Public tenant slug lookup" ON public.tenants;
CREATE POLICY "Public tenant slug lookup"
  ON public.tenants
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to read Open roles (CareersPage listing + ApplyPage role fetch)
DROP POLICY IF EXISTS "Public open roles read" ON public.roles;
CREATE POLICY "Public open roles read"
  ON public.roles
  FOR SELECT
  TO anon
  USING (status = 'Open');
