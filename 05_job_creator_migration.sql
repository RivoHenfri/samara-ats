-- ==============================================================================
-- JOB CREATOR MIGRATION
-- Run this in Supabase SQL Editor.
-- Creates:
--   1. departments lookup table (dynamic, replaces hardcoded array)
--   2. job_descriptions table (structured JD + formatted versions + scoring)
--   3. New columns on roles: location, work_arrangement, scoring_weights
-- ==============================================================================

-- ── 1. Departments lookup table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.departments (
    id         UUID        DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read departments"
ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert departments"
ON public.departments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update departments"
ON public.departments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete departments"
ON public.departments FOR DELETE TO authenticated USING (true);

-- Seed default departments
INSERT INTO public.departments (name) VALUES
    ('Hospitality'),
    ('Operations'),
    ('Construction')
ON CONFLICT (name) DO NOTHING;

-- ── 2. Extend roles table ────────────────────────────────────────────────────

ALTER TABLE public.roles
    ADD COLUMN IF NOT EXISTS location         TEXT,
    ADD COLUMN IF NOT EXISTS work_arrangement  TEXT DEFAULT 'Onsite',
    ADD COLUMN IF NOT EXISTS scoring_weights   JSONB DEFAULT '{"must_have": 0.55, "nice_to_have": 0.25, "salary_alignment": 0.20}'::jsonb;

-- ── 3. Job descriptions table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_descriptions (
    id                    UUID        DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    role_id               UUID        REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,

    -- Structured JD (English)
    structured_jd         JSONB       NOT NULL DEFAULT '{}'::jsonb,

    -- Formatted versions (English)
    formatted_internal    TEXT        NOT NULL DEFAULT '',
    formatted_whatsapp    TEXT        NOT NULL DEFAULT '',
    formatted_linkedin    TEXT        NOT NULL DEFAULT '',
    formatted_job_board   TEXT        NOT NULL DEFAULT '',

    -- Bahasa Indonesia versions
    structured_jd_id      JSONB,
    formatted_internal_id TEXT,
    formatted_whatsapp_id TEXT,
    formatted_linkedin_id TEXT,
    formatted_job_board_id TEXT,

    -- Scoring criteria extracted from the JD
    scoring_criteria      JSONB       NOT NULL DEFAULT '{}'::jsonb,

    -- Generation audit trail
    generation_metadata   JSONB       NOT NULL DEFAULT '{}'::jsonb,

    created_at            TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read job descriptions"
ON public.job_descriptions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert job descriptions"
ON public.job_descriptions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update job descriptions"
ON public.job_descriptions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete job descriptions"
ON public.job_descriptions FOR DELETE TO authenticated USING (true);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- One JD per role (latest wins)
CREATE INDEX IF NOT EXISTS idx_jd_role_id
    ON public.job_descriptions(role_id);

CREATE INDEX IF NOT EXISTS idx_jd_role_updated
    ON public.job_descriptions(role_id, updated_at DESC);

-- GIN index on scoring_criteria for JSONB queries
CREATE INDEX IF NOT EXISTS idx_jd_scoring_criteria
    ON public.job_descriptions USING GIN (scoring_criteria);

-- ── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jd_updated_at ON public.job_descriptions;
CREATE TRIGGER trg_jd_updated_at
    BEFORE UPDATE ON public.job_descriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
