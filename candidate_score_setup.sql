-- ==============================================================================
-- CANDIDATE COMPATIBILITY SCORE TABLE
-- Execute this script in your Supabase SQL Editor.
-- Stores AI-generated compatibility scores per application, with full version
-- history so scores can be regenerated without losing previous evaluations.
--
-- Score dimensions:
--   overall_score          0–100  Weighted composite of all dimensions
--   must_have_score        0–100  Match against non-negotiable requirements
--   nice_to_have_score     0–100  Match against preferred-but-optional criteria
--   salary_alignment_score 0–100  How well expected salary fits budget/range
--
-- risk_flags: JSONB array of { flag, detail, severity: "low"|"medium"|"high" }
-- interview_focus: JSONB array of strings (recruiter action items)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.application_scores (
    id                     UUID        DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id         UUID        REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,

    -- Score dimensions (0–100)
    overall_score          INTEGER     CHECK (overall_score          BETWEEN 0 AND 100),
    must_have_score        INTEGER     CHECK (must_have_score        BETWEEN 0 AND 100),
    nice_to_have_score     INTEGER     CHECK (nice_to_have_score     BETWEEN 0 AND 100),
    salary_alignment_score INTEGER     CHECK (salary_alignment_score BETWEEN 0 AND 100),

    -- AI-generated narrative payload
    -- risk_flags:     [{ "flag": "...", "detail": "...", "severity": "low|medium|high" }]
    -- interview_focus: ["Focus area 1", "Focus area 2"]
    risk_flags             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    executive_summary      TEXT,
    interview_focus        JSONB       NOT NULL DEFAULT '[]'::jsonb,

    -- Audit: who triggered the score and which model/prompt version was used
    scored_by_name         TEXT,
    model_version          TEXT        NOT NULL,
    prompt_version         TEXT        NOT NULL DEFAULT 'v1',

    created_at             TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ── Row Level Security ──────────────────────────────────────────────────────────

ALTER TABLE public.application_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read application scores"
ON public.application_scores FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert application scores"
ON public.application_scores FOR INSERT
TO authenticated
WITH CHECK (true);

-- ── Indexes ────────────────────────────────────────────────────────────────────

-- Fast lookup by application (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_as_application_id
    ON public.application_scores(application_id);

-- Latest score per application (used in list/kanban views)
CREATE INDEX IF NOT EXISTS idx_as_application_created
    ON public.application_scores(application_id, created_at DESC);

-- High-match quick filter: "WHERE overall_score >= 80"
CREATE INDEX IF NOT EXISTS idx_as_overall_score
    ON public.application_scores(overall_score DESC)
    WHERE overall_score IS NOT NULL;

-- GIN index for risk_flags JSONB queries (e.g. filter by severity)
CREATE INDEX IF NOT EXISTS idx_as_risk_flags
    ON public.application_scores USING GIN (risk_flags);
