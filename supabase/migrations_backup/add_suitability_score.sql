-- Migration: Add suitability_score and availability_to_start to candidates
-- Run this in Supabase SQL Editor before deploying the form-submit Edge Function

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS suitability_score real;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS availability_to_start text;

-- Optional: add a comment for documentation
COMMENT ON COLUMN candidates.suitability_score IS 'Auto-calculated suitability score from Power Automate keyword matching (uncapped float)';
COMMENT ON COLUMN candidates.availability_to_start IS 'Free-text availability e.g. "Immediately", "2 weeks notice", "1 March 2026"';
