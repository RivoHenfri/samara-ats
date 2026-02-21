-- ==============================================================================
-- CV SOURCES: Versioned CV Document Storage with AI Parsing Support
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- IMPORTANT: Before running this script, create the Supabase Storage bucket:
--
--   1. Go to Supabase Dashboard → Storage → New Bucket
--   2. Name: cvs
--   3. Public: NO (private — uses signed URLs for access control)
--   4. Allowed MIME types:
--        application/pdf
--        application/msword
--        application/vnd.openxmlformats-officedocument.wordprocessingml.document
--   5. Max file size: 10485760 (10MB)
--
-- Storage RLS Policies (add in Dashboard → Storage → Policies → cvs):
--   - SELECT: (auth.role() = 'authenticated')
--   - INSERT: (auth.role() = 'authenticated')
--   - UPDATE: (auth.role() = 'authenticated')
--   - DELETE: (auth.role() = 'authenticated')  -- restrict to Admin if needed
-- ──────────────────────────────────────────────────────────────────────────────


-- 1. Create cv_sources table
-- ──────────────────────────────────────────────────────────────────────────────
-- Each row represents one version of a candidate's CV.
-- Only the latest upload has is_active = true (enforced by trigger below).
-- The parsed_data JSONB column stores AI-extracted structured career data.

CREATE TABLE IF NOT EXISTS public.cv_sources (
  id            UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,

  -- Relationship
  candidate_id  UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,

  -- CV type: 'upload' (stored in Supabase Storage) OR 'link' (external URL)
  source_type   TEXT NOT NULL CHECK (source_type IN ('upload', 'link')),

  -- For uploaded files (source_type = 'upload')
  file_path     TEXT,    -- Storage path: cvs/{candidate_id}/{uuid}_{filename}
  file_name     TEXT,    -- Original filename shown to users
  file_size     INTEGER, -- In bytes
  file_type     TEXT,    -- MIME type (application/pdf, application/msword, etc.)

  -- For external links (source_type = 'link') OR cached public URL of uploaded file
  file_url      TEXT,    -- Google Drive / OneDrive / Dropbox URL, or signed URL cache

  -- Metadata
  uploaded_by   UUID REFERENCES auth.users(id),
  is_active     BOOLEAN DEFAULT true NOT NULL,  -- True = current version

  -- AI Parsing Output
  -- Stores the full structured extraction from Claude:
  -- {
  --   full_name, whatsapp, email, current_salary,
  --   current_role, skills[], experience_years,
  --   employment_history[{ company, role, start, end, duration_months }],
  --   education[{ institution, degree, field, year }],
  --   employment_gaps[{ from, to, duration_months }],
  --   average_tenure_months,
  --   flags[]   <- risk signals for recruiters
  -- }
  parsed_data   JSONB,
  parsed_at     TIMESTAMPTZ,

  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);


-- 2. Indexes for common query patterns
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cv_sources_candidate
  ON public.cv_sources(candidate_id);

CREATE INDEX IF NOT EXISTS idx_cv_sources_active
  ON public.cv_sources(candidate_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cv_sources_created_at
  ON public.cv_sources(created_at DESC);

-- GIN index for searching inside parsed_data (e.g., by skill or flag)
CREATE INDEX IF NOT EXISTS idx_cv_sources_parsed_data
  ON public.cv_sources USING GIN (parsed_data);


-- 3. Row Level Security
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cv_sources ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read CV sources (refine to role-based if needed)
CREATE POLICY "cv_sources_select_authenticated"
  ON public.cv_sources FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can insert new CV sources
CREATE POLICY "cv_sources_insert_authenticated"
  ON public.cv_sources FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Authenticated users can update (e.g., trigger deactivation via function)
CREATE POLICY "cv_sources_update_authenticated"
  ON public.cv_sources FOR UPDATE
  TO authenticated
  USING (true);

-- Only service role can delete (prevents accidental data loss from frontend)
-- Frontend uses soft-deletion via is_active = false instead
-- DELETE is not granted to public / authenticated by default


-- 4. Versioning Trigger
-- ──────────────────────────────────────────────────────────────────────────────
-- When a new cv_source row is inserted for a candidate, all other rows for that
-- candidate are automatically set to is_active = false.
-- This keeps exactly one active version per candidate at all times.

CREATE OR REPLACE FUNCTION deactivate_old_cv_versions()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cv_sources
  SET is_active = false
  WHERE candidate_id = NEW.candidate_id
    AND id != NEW.id
    AND is_active = true;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cv_versioning ON public.cv_sources;

CREATE TRIGGER trigger_cv_versioning
  AFTER INSERT ON public.cv_sources
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_cv_versions();


-- ==============================================================================
-- VERIFICATION QUERY (run after migration to confirm setup)
-- ==============================================================================
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'cv_sources'
-- ORDER BY ordinal_position;
