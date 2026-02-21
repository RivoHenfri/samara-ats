-- ==============================================================================
-- JOB CONTEXT MIGRATION
-- Run this in Supabase SQL Editor AFTER screening_questions_setup.sql
-- ==============================================================================

-- 1. Add job_context to roles table
--    Recruiters paste detailed job info here (skills, KPIs, seniority, culture,
--    non-negotiables) so the AI generates role-specific, not generic, questions.
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS job_context TEXT;

-- 2. Add model_version to screening_questions
--    Tracks which exact AI model generated each version (for audit & quality).
ALTER TABLE public.screening_questions
  ADD COLUMN IF NOT EXISTS model_version TEXT;
