-- ==============================================================================
-- SCREENING QUESTIONS TABLE
-- Execute this script in your Supabase SQL Editor.
-- Stores AI-generated interview questions per application, with full version
-- history so you can regenerate without losing previous question sets.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.screening_questions (
    id              UUID        DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id  UUID        REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,

    -- JSONB payload with four question categories:
    -- { technical: [...], behavioral: [...], situational: [...], risk_probes: [...] }
    -- Each item: { question, rationale, follow_up } (risk_probes also has: risk)
    questions       JSONB       NOT NULL,

    -- Snapshot of risk areas surfaced during generation (for quick display)
    risk_areas      JSONB       DEFAULT '[]'::jsonb,

    -- Prompt version tag (e.g. "v1", "v2") for tracking prompt iterations
    prompt_version  TEXT        NOT NULL DEFAULT 'v1',

    -- Display name of the user who triggered generation (denormalized like notes.created_by)
    generated_by_name TEXT,

    created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Row Level Security
ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read screening questions"
ON public.screening_questions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert screening questions"
ON public.screening_questions FOR INSERT
TO authenticated
WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sq_application_id
    ON public.screening_questions(application_id);

CREATE INDEX IF NOT EXISTS idx_sq_created_at
    ON public.screening_questions(created_at DESC);
