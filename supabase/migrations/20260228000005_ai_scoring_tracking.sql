-- Migration: Add AI Scoring Tracking to applications table
-- Includes Smart Failure Classification (DLQ Sweeper)

-- 1. Create the ENUM type for scoring state
CREATE TYPE public.scoring_status_enum AS ENUM (
    'pending', 
    'processing', 
    'completed', 
    'failed', 
    'fatal_error'
);

-- 2. Add the state tracking columns to the applications table
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS scoring_status public.scoring_status_enum DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS scoring_error text,
ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
ADD COLUMN IF NOT EXISTS score_completed_at timestamptz;

-- 3. Add a partial index to optimize the pg_cron sweeper query
-- We only need to optimize searches for the 'failed' status
CREATE INDEX IF NOT EXISTS idx_applications_failed_scoring 
ON public.applications(scoring_status) 
WHERE scoring_status = 'failed';

-- 4. Enable the pg_cron extension (often already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 5. Create the pg_cron sweeper job
-- Runs every 5 minutes. 
-- Will sweep ONLY 'failed' jobs (transient errors) with retries remaining.
-- Safely ignores 'fatal_error' completely so human intervention is required.
SELECT cron.schedule(
    'sweep-failed-ai-scoring', 
    '*/5 * * * *', 
    $$
    UPDATE public.applications 
    SET scoring_status = 'pending' 
    WHERE scoring_status = 'failed' 
      AND retry_count < 3;
    $$
);
