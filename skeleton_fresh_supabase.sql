-- ==============================================================================
-- SAMARA ATS — FULL SKELETON FOR FRESH SUPABASE PROJECT
-- Account: wowilingrivo@gmail.com
-- Generated: 2026-03-05
--
-- INSTRUCTIONS:
--   1. Create a new Supabase project at https://supabase.com/dashboard
--   2. Go to SQL Editor → New query
--   3. Paste this ENTIRE file and run it
--   4. Then follow SETUP_NEW_SUPABASE.md for env + secrets + edge functions
-- ==============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 0: EXTENSIONS & SCHEMAS                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS rbac;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 1: CORE TABLES (public schema)                                    │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 1a. Tenants (multi-tenancy)
CREATE TABLE IF NOT EXISTS public.tenants (
    id         UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.tenants (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Samara Lombok', 'samara-lombok')
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);

-- 1b. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    full_name  TEXT,
    role       TEXT NOT NULL DEFAULT 'Viewer'
               CHECK (role IN ('Admin', 'Manager', 'Viewer')),
    invited_by UUID REFERENCES auth.users(id),
    tenant_id  UUID REFERENCES public.tenants(id)
               DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 1c. Departments
CREATE TABLE IF NOT EXISTS public.departments (
    id         UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.departments (name) VALUES
    ('Hospitality'), ('Operations'), ('Construction')
ON CONFLICT (name) DO NOTHING;

-- 1d. Roles (job openings)
CREATE TABLE IF NOT EXISTS public.roles (
    id               UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    title            TEXT NOT NULL,
    department       TEXT NOT NULL
                     CHECK (department IN ('Hospitality', 'Operations', 'Construction')),
    priority         TEXT NOT NULL DEFAULT 'Medium'
                     CHECK (priority IN ('Critical', 'Core', 'Support')),
    status           TEXT NOT NULL DEFAULT 'Open'
                     CHECK (status IN ('Open', 'Closed')),
    job_context      TEXT,
    location         TEXT,
    work_arrangement TEXT DEFAULT 'Onsite',
    scoring_weights  JSONB DEFAULT '{"must_have": 0.55, "nice_to_have": 0.25, "salary_alignment": 0.20}'::jsonb,
    role_type        TEXT CHECK (role_type IS NULL OR role_type IN ('Replacement', 'New Position', 'Additional Headcount')),
    priority_level   TEXT DEFAULT 'Normal',
    tenant_id        UUID REFERENCES public.tenants(id)
                     DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_department ON public.roles(department);
CREATE INDEX IF NOT EXISTS idx_roles_status ON public.roles(status);

-- 1e. Candidates
CREATE TABLE IF NOT EXISTS public.candidates (
    id                    UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    full_name             TEXT NOT NULL,
    whatsapp              TEXT,
    email                 TEXT,
    origin                TEXT NOT NULL DEFAULT 'Lombok Local'
                          CHECK (origin IN ('Lombok Local', 'Indonesian (Non-Lombok)', 'International')),
    cv_url                TEXT,
    cv_link               TEXT,
    current_salary        BIGINT,
    expected_salary       BIGINT,
    suitability_score     REAL,
    availability_to_start TEXT,
    tenant_id             UUID REFERENCES public.tenants(id)
                          DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_candidates_origin ON public.candidates(origin);

-- 1f. Applications
CREATE TABLE IF NOT EXISTS public.applications (
    id                    UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    candidate_id          UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    role_id               UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    stage                 TEXT NOT NULL DEFAULT 'New'
                          CHECK (stage IN ('New','Screening','Interview Pending','Interview Scheduled','Interview Completed','Offer','Hired','Rejected')),
    source                TEXT NOT NULL DEFAULT 'Manual'
                          CHECK (source IN ('Manual', 'Career Page', 'Import', 'Referral')),
    base_salary_offer     NUMERIC,
    cover_letter          TEXT,
    notes                 TEXT,
    last_stage_change_at  TIMESTAMPTZ DEFAULT now(),
    rejection_reason      TEXT,
    rejected_at           TIMESTAMPTZ,
    rejected_by           UUID REFERENCES auth.users(id),
    rejection_stage       TEXT,
    hired_at              TIMESTAMPTZ,
    hired_by              UUID REFERENCES auth.users(id),
    screening_verdict     TEXT CHECK (screening_verdict IS NULL OR screening_verdict IN ('passed', 'failed', 'passed_with_concern')),
    screening_comment     TEXT,
    prescreening_status   TEXT DEFAULT 'not_sent'
                          CHECK (prescreening_status IN ('not_sent', 'sent', 'started', 'completed', 'expired')),
    tenant_id             UUID REFERENCES public.tenants(id)
                          DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at            TIMESTAMPTZ DEFAULT now(),
    updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_applications_candidate ON public.applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_role ON public.applications(role_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage ON public.applications(stage);
CREATE INDEX IF NOT EXISTS idx_applications_screening_verdict ON public.applications(screening_verdict) WHERE screening_verdict IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_rejected ON public.applications(rejected_at DESC) WHERE stage = 'Rejected';
CREATE INDEX IF NOT EXISTS idx_applications_rejection_reason ON public.applications(rejection_reason) WHERE stage = 'Rejected';
CREATE INDEX IF NOT EXISTS idx_applications_hired ON public.applications(hired_at DESC) WHERE stage = 'Hired';
CREATE INDEX IF NOT EXISTS idx_applications_prescreening_status ON public.applications(prescreening_status);

-- 1g. Notes
CREATE TABLE IF NOT EXISTS public.notes (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    content        TEXT NOT NULL,
    created_by     TEXT DEFAULT 'System',
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- 1h. Audit Ledger (legacy)
CREATE TABLE IF NOT EXISTS public.audit_ledger (
    id             UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    old_stage      TEXT,
    new_stage      TEXT NOT NULL,
    changed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_application_id ON public.audit_ledger(application_id);

-- 1i. Application History (enterprise audit)
CREATE TABLE IF NOT EXISTS public.application_history (
    id             UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    candidate_id   UUID NOT NULL,
    role_id        UUID NOT NULL,
    actor_id       UUID REFERENCES auth.users(id),
    action_type    TEXT NOT NULL,
    previous_stage TEXT,
    new_stage      TEXT NOT NULL,
    metadata       JSONB DEFAULT '{}'::jsonb,
    tenant_id      UUID REFERENCES public.tenants(id)
                   DEFAULT '00000000-0000-0000-0000-000000000001',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE UPDATE, DELETE ON public.application_history FROM PUBLIC, authenticated, anon;

CREATE INDEX IF NOT EXISTS idx_app_hist_app_id ON public.application_history(application_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_candidate_id ON public.application_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_role_id ON public.application_history(role_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_actor_id ON public.application_history(actor_id);
CREATE INDEX IF NOT EXISTS idx_app_hist_created_at ON public.application_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_hist_metadata ON public.application_history USING GIN (metadata);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 2: JOB DESCRIPTIONS & SCORING                                     │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 2a. Job Descriptions
CREATE TABLE IF NOT EXISTS public.job_descriptions (
    id                  UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    role_id             UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    structured_jd       JSONB NOT NULL DEFAULT '{}'::jsonb,
    formatted_internal  TEXT NOT NULL DEFAULT '',
    formatted_whatsapp  TEXT NOT NULL DEFAULT '',
    formatted_linkedin  TEXT NOT NULL DEFAULT '',
    formatted_job_board TEXT NOT NULL DEFAULT '',
    structured_jd_id    JSONB,
    formatted_internal_id  TEXT,
    formatted_whatsapp_id  TEXT,
    formatted_linkedin_id  TEXT,
    formatted_job_board_id TEXT,
    scoring_criteria    JSONB NOT NULL DEFAULT '{}'::jsonb,
    generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jd_role_id ON public.job_descriptions(role_id);
CREATE INDEX IF NOT EXISTS idx_jd_role_updated ON public.job_descriptions(role_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_jd_scoring_criteria ON public.job_descriptions USING GIN (scoring_criteria);

-- 2b. Application Scores (AI compatibility)
CREATE TABLE IF NOT EXISTS public.application_scores (
    id                     UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id         UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    overall_score          INTEGER CHECK (overall_score BETWEEN 0 AND 100),
    must_have_score        INTEGER CHECK (must_have_score BETWEEN 0 AND 100),
    nice_to_have_score     INTEGER CHECK (nice_to_have_score BETWEEN 0 AND 100),
    salary_alignment_score INTEGER CHECK (salary_alignment_score BETWEEN 0 AND 100),
    risk_flags             JSONB NOT NULL DEFAULT '[]'::jsonb,
    executive_summary      TEXT,
    interview_focus        JSONB NOT NULL DEFAULT '[]'::jsonb,
    scored_by_name         TEXT,
    model_version          TEXT NOT NULL,
    prompt_version         TEXT NOT NULL DEFAULT 'v1',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_as_application_id ON public.application_scores(application_id);
CREATE INDEX IF NOT EXISTS idx_as_application_created ON public.application_scores(application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_as_overall_score ON public.application_scores(overall_score DESC) WHERE overall_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_as_risk_flags ON public.application_scores USING GIN (risk_flags);

-- 2c. Screening Questions
CREATE TABLE IF NOT EXISTS public.screening_questions (
    id                UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    questions         JSONB NOT NULL,
    risk_areas        JSONB DEFAULT '[]'::jsonb,
    prompt_version    TEXT NOT NULL DEFAULT 'v1',
    generated_by_name TEXT,
    model_version     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sq_application_id ON public.screening_questions(application_id);
CREATE INDEX IF NOT EXISTS idx_sq_created_at ON public.screening_questions(created_at DESC);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 3: INTERVIEW SCHEDULING                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 3a. User Integrations (OAuth tokens)
CREATE TABLE IF NOT EXISTS public.user_integrations (
    id            UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider      TEXT NOT NULL,
    access_token  TEXT,
    refresh_token TEXT,
    expires_at    TIMESTAMPTZ,
    metadata      JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, provider)
);

-- 3b. Interview Rounds
CREATE TABLE IF NOT EXISTS public.interview_rounds (
    id         SERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO public.interview_rounds (name, sort_order)
VALUES ('HR', 1), ('Technical', 2), ('Final', 3)
ON CONFLICT (name) DO NOTHING;

-- 3c. Interviews
CREATE TABLE IF NOT EXISTS public.interviews (
    id                UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    organizer_id      UUID NOT NULL REFERENCES auth.users(id),
    status            TEXT DEFAULT 'pending',
    scheduled_at      TIMESTAMPTZ,
    end_at            TIMESTAMPTZ,
    duration_minutes  INT DEFAULT 60,
    meeting_link      TEXT,
    calendar_event_id TEXT,
    zoom_meeting_id   TEXT,
    interview_type    TEXT NOT NULL DEFAULT 'Online'
                      CHECK (interview_type IN ('Online', 'Onsite')),
    round             TEXT,
    interviewers      TEXT[] DEFAULT '{}',
    location          TEXT CHECK (location IS NULL OR location IN ('Lombok', 'Sumbawa', 'Bali', 'Jakarta')),
    metadata          JSONB DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 4: CV SOURCES                                                     │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.cv_sources (
    id           UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    source_type  TEXT NOT NULL CHECK (source_type IN ('upload', 'link')),
    file_path    TEXT,
    file_name    TEXT,
    file_size    INTEGER,
    file_type    TEXT,
    file_url     TEXT,
    uploaded_by  UUID REFERENCES auth.users(id),
    is_active    BOOLEAN NOT NULL DEFAULT true,
    parsed_data  JSONB,
    parsed_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cv_sources_candidate ON public.cv_sources(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cv_sources_active ON public.cv_sources(candidate_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_sources_created_at ON public.cv_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_sources_parsed_data ON public.cv_sources USING GIN (parsed_data);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 5: PRESCREENING                                                   │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 5a. Prescreening Templates
CREATE TABLE IF NOT EXISTS public.prescreening_templates (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id          UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id        UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    name             TEXT NOT NULL DEFAULT 'Default',
    is_active        BOOLEAN NOT NULL DEFAULT true,
    fixed_fields     JSONB NOT NULL DEFAULT '[
        {"field_key":"current_salary","label":"Current Monthly Salary (IDR)","type":"currency","required":true},
        {"field_key":"expected_salary","label":"Expected Monthly Salary (IDR)","type":"currency","required":true},
        {"field_key":"notice_period","label":"Notice Period","type":"select","required":true,"options":["Immediately","2 weeks","1 month","2 months","3+ months"]},
        {"field_key":"availability_date","label":"Earliest Available Start Date","type":"date","required":true},
        {"field_key":"certifications","label":"Relevant Certifications / Licenses","type":"textarea","required":false},
        {"field_key":"previously_applied","label":"Have you previously applied to Samara?","type":"yes_no_detail","required":true,"detail_prompt":"Which role and when?"},
        {"field_key":"relatives_at_company","label":"Do you have friends or relatives working at Samara?","type":"yes_no_detail","required":true,"detail_prompt":"Please provide their name(s) and position(s)."},
        {"field_key":"mbti_type","label":"MBTI Personality Type","type":"mbti","required":false}
    ]'::jsonb,
    custom_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by       UUID REFERENCES auth.users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pst_role_id ON public.prescreening_templates(role_id);
CREATE INDEX IF NOT EXISTS idx_pst_role_active ON public.prescreening_templates(role_id, is_active, updated_at DESC);

-- 5b. Prescreening Responses
CREATE TABLE IF NOT EXISTS public.prescreening_responses (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id    UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
    template_id       UUID REFERENCES public.prescreening_templates(id) ON DELETE SET NULL,
    responses         JSONB NOT NULL DEFAULT '{}'::jsonb,
    template_snapshot JSONB,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'sent', 'started', 'completed', 'expired')),
    access_token      TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    sent_at           TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    expires_at        TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psr_application_id ON public.prescreening_responses(application_id);
CREATE INDEX IF NOT EXISTS idx_psr_access_token ON public.prescreening_responses(access_token);
CREATE INDEX IF NOT EXISTS idx_psr_status ON public.prescreening_responses(status);

-- 5c. Notification Log
CREATE TABLE IF NOT EXISTS public.notification_log (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id    UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
    channel           TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'manual')),
    notification_type TEXT NOT NULL,
    recipient         TEXT,
    message_preview   TEXT,
    status            TEXT NOT NULL DEFAULT 'sent'
                      CHECK (status IN ('pending', 'sent', 'opened', 'failed')),
    metadata          JSONB DEFAULT '{}'::jsonb,
    sent_by           UUID REFERENCES auth.users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_application_id ON public.notification_log(application_id);
CREATE INDEX IF NOT EXISTS idx_notif_created_at ON public.notification_log(created_at DESC);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 6: HR / ONBOARDING (hr schema)                                    │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS hr.workflow_templates (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    type        TEXT DEFAULT 'Onboarding',
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr.workflow_template_tasks (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES hr.workflow_templates(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT true,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr.employee_records (
    id             UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    candidate_id   UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
    application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
    hired_at       TIMESTAMPTZ DEFAULT now(),
    status         TEXT DEFAULT 'Onboarding',
    first_name     TEXT,
    last_name      TEXT,
    email          TEXT,
    phone          TEXT,
    department     TEXT,
    role           TEXT,
    manager_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    start_date     DATE,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_candidate_id ON hr.employee_records(candidate_id);

CREATE TABLE IF NOT EXISTS hr.employee_workflows (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id  UUID REFERENCES hr.employee_records(id) ON DELETE CASCADE,
    template_id  UUID REFERENCES hr.workflow_templates(id) ON DELETE RESTRICT,
    status       TEXT DEFAULT 'Scheduled',
    started_at   TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hr.employee_workflow_tasks (
    id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_workflow_id UUID REFERENCES hr.employee_workflows(id) ON DELETE CASCADE,
    title                TEXT NOT NULL,
    description          TEXT,
    status               TEXT DEFAULT 'pending',
    is_required          BOOLEAN DEFAULT true,
    completed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at         TIMESTAMPTZ,
    sort_order           INTEGER DEFAULT 0,
    created_at           TIMESTAMPTZ DEFAULT now()
);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 7: RBAC (rbac schema)                                             │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS rbac.roles (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac.permissions (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module      TEXT NOT NULL,
    action      TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(module, action)
);

CREATE TABLE IF NOT EXISTS rbac.role_permissions (
    role_id       UUID NOT NULL REFERENCES rbac.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES rbac.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS rbac.user_roles (
    user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id   UUID NOT NULL REFERENCES rbac.roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id, tenant_id)
);

-- Seed RBAC roles
INSERT INTO rbac.roles (name, description) VALUES
    ('Super Admin', 'Full system access'),
    ('Admin', 'Tenant admin'),
    ('Manager', 'Hiring manager'),
    ('Viewer', 'Read-only access')
ON CONFLICT (name) DO NOTHING;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 8: ROW LEVEL SECURITY                                             │
-- └──────────────────────────────────────────────────────────────────────────┘

ALTER TABLE public.tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_descriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screening_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_rounds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cv_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescreening_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescreening_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_workflows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.employee_workflow_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.workflow_templates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr.workflow_template_tasks ENABLE ROW LEVEL SECURITY;

-- ── Tenants ──
CREATE POLICY "Public tenant slug lookup" ON public.tenants FOR SELECT TO anon USING (true);
CREATE POLICY "Tenant read for auth" ON public.tenants FOR SELECT TO authenticated USING (true);

-- ── Profiles ──
CREATE POLICY "Profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- ── Departments ──
CREATE POLICY "Dept read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Dept insert" ON public.departments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Dept update" ON public.departments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Dept delete" ON public.departments FOR DELETE TO authenticated USING (true);

-- ── Roles (jobs) ──
CREATE POLICY "Roles read" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Roles insert" ON public.roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Roles update" ON public.roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Roles delete" ON public.roles FOR DELETE TO authenticated USING (true);
CREATE POLICY "Public open roles" ON public.roles FOR SELECT TO anon USING (status = 'Open');

-- ── Candidates ──
CREATE POLICY "Candidates read" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Candidates insert" ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Candidates update" ON public.candidates FOR UPDATE TO authenticated USING (true);

-- ── Applications ──
CREATE POLICY "Apps read" ON public.applications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apps insert" ON public.applications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Apps update" ON public.applications FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Apps delete" ON public.applications FOR DELETE TO authenticated USING (true);

-- ── Notes ──
CREATE POLICY "Notes read" ON public.notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Notes insert" ON public.notes FOR INSERT TO authenticated WITH CHECK (true);

-- ── Audit/History ──
CREATE POLICY "Ledger read" ON public.audit_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "History read" ON public.application_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "History insert" ON public.application_history FOR INSERT TO authenticated WITH CHECK (true);

-- ── Job Descriptions ──
CREATE POLICY "JD read" ON public.job_descriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "JD insert" ON public.job_descriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "JD update" ON public.job_descriptions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "JD delete" ON public.job_descriptions FOR DELETE TO authenticated USING (true);

-- ── Scores ──
CREATE POLICY "Scores read" ON public.application_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Scores insert" ON public.application_scores FOR INSERT TO authenticated WITH CHECK (true);

-- ── Screening Questions ──
CREATE POLICY "SQ read" ON public.screening_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "SQ insert" ON public.screening_questions FOR INSERT TO authenticated WITH CHECK (true);

-- ── User Integrations ──
CREATE POLICY "Integrations own" ON public.user_integrations FOR ALL TO authenticated USING (user_id = auth.uid());

-- ── Interview Rounds ──
CREATE POLICY "Rounds read" ON public.interview_rounds FOR SELECT TO authenticated USING (true);

-- ── Interviews ──
CREATE POLICY "Interviews read" ON public.interviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Interviews manage" ON public.interviews FOR ALL TO authenticated USING (true);

-- ── CV Sources ──
CREATE POLICY "CV read" ON public.cv_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "CV insert" ON public.cv_sources FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CV update" ON public.cv_sources FOR UPDATE TO authenticated USING (true);

-- ── Prescreening Templates ──
CREATE POLICY "PST read" ON public.prescreening_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "PST insert" ON public.prescreening_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "PST update" ON public.prescreening_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "PST delete" ON public.prescreening_templates FOR DELETE TO authenticated USING (true);

-- ── Prescreening Responses ──
CREATE POLICY "PSR read auth" ON public.prescreening_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "PSR insert" ON public.prescreening_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "PSR update" ON public.prescreening_responses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "PSR read anon" ON public.prescreening_responses FOR SELECT TO anon USING (true);

-- ── Notification Log ──
CREATE POLICY "Notif read" ON public.notification_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Notif insert" ON public.notification_log FOR INSERT TO authenticated WITH CHECK (true);

-- ── HR tables ──
CREATE POLICY "HR records read" ON hr.employee_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR records insert" ON hr.employee_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "HR records update" ON hr.employee_records FOR UPDATE TO authenticated USING (true);
CREATE POLICY "HR workflows read" ON hr.employee_workflows FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR workflows insert" ON hr.employee_workflows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "HR tasks read" ON hr.employee_workflow_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR tasks insert" ON hr.employee_workflow_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "HR tasks update" ON hr.employee_workflow_tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "HR templates read" ON hr.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR templates insert" ON hr.workflow_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "HR template tasks read" ON hr.workflow_template_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "HR template tasks insert" ON hr.workflow_template_tasks FOR INSERT TO authenticated WITH CHECK (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 9: FUNCTIONS & TRIGGERS                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

-- 9a. Helper: current tenant from JWT
CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
    SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id', ''))::UUID;
$$ LANGUAGE SQL STABLE;

-- 9b. Sync profile to auth metadata
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS trigger AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data =
        COALESCE(raw_app_meta_data, '{}'::jsonb) ||
        json_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role)::jsonb
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER trigger_sync_profile_to_auth
AFTER INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth();

-- 9c. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, tenant_id)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
        'Viewer',
        '00000000-0000-0000-0000-000000000001'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9d. Updated_at helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_jd_updated_at ON public.job_descriptions;
CREATE TRIGGER trg_jd_updated_at BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trigger_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER trigger_user_integrations_updated_at BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_interviews_updated_at ON public.interviews;
CREATE TRIGGER trigger_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_prescreening_templates_updated_at ON public.prescreening_templates;
CREATE TRIGGER trg_prescreening_templates_updated_at BEFORE UPDATE ON public.prescreening_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prescreening_responses_updated_at ON public.prescreening_responses;
CREATE TRIGGER trg_prescreening_responses_updated_at BEFORE UPDATE ON public.prescreening_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9e. Stage change timestamp
CREATE OR REPLACE FUNCTION public.update_stage_timestamp()
RETURNS trigger AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        NEW.last_stage_change_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_stage_timestamp ON public.applications;
CREATE TRIGGER trigger_stage_timestamp BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_stage_timestamp();

-- 9f. Audit log trigger (NULL-safe version)
CREATE OR REPLACE FUNCTION log_application_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage) THEN
        IF NEW.candidate_id IS NOT NULL AND NEW.role_id IS NOT NULL THEN
            INSERT INTO public.application_history (
                application_id, candidate_id, role_id, actor_id,
                action_type, previous_stage, new_stage, metadata
            ) VALUES (
                NEW.id, NEW.candidate_id, NEW.role_id, auth.uid(),
                'STAGE_MOVED', OLD.stage, NEW.stage,
                jsonb_build_object('updated_via', 'trigger_update')
            );
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW.candidate_id IS NOT NULL AND NEW.role_id IS NOT NULL THEN
            INSERT INTO public.application_history (
                application_id, candidate_id, role_id, actor_id,
                action_type, previous_stage, new_stage, metadata
            ) VALUES (
                NEW.id, NEW.candidate_id, NEW.role_id, auth.uid(),
                'CREATED', NULL, NEW.stage,
                jsonb_build_object('source', 'creation_event')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_app_stage ON public.applications;
CREATE TRIGGER trigger_log_app_stage
AFTER INSERT OR UPDATE OF stage ON public.applications
FOR EACH ROW EXECUTE FUNCTION log_application_stage_change();

-- 9g. Interview stage enforcement
CREATE OR REPLACE FUNCTION enforce_interview_scheduled_stage()
RETURNS TRIGGER AS $$
DECLARE has_scheduled BOOLEAN;
BEGIN
    IF NEW.stage = 'Interview Scheduled'
       AND (OLD.stage IS NULL OR OLD.stage IS DISTINCT FROM 'Interview Scheduled') THEN
        SELECT EXISTS (
            SELECT 1 FROM public.interviews
            WHERE application_id = NEW.id AND scheduled_at IS NOT NULL
        ) INTO has_scheduled;
        IF NOT has_scheduled THEN
            RAISE EXCEPTION 'Cannot move to Interview Scheduled: no interview with a scheduled date.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_enforce_interview_scheduled ON public.applications;
CREATE TRIGGER trigger_enforce_interview_scheduled
BEFORE UPDATE OF stage ON public.applications
FOR EACH ROW EXECUTE FUNCTION enforce_interview_scheduled_stage();

-- 9h. CV versioning
CREATE OR REPLACE FUNCTION deactivate_old_cv_versions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.cv_sources SET is_active = false
    WHERE candidate_id = NEW.candidate_id AND id != NEW.id AND is_active = true;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cv_versioning ON public.cv_sources;
CREATE TRIGGER trigger_cv_versioning AFTER INSERT ON public.cv_sources FOR EACH ROW EXECUTE FUNCTION deactivate_old_cv_versions();

-- 9i. Rejection metadata
CREATE OR REPLACE FUNCTION public.handle_rejection_metadata()
RETURNS trigger AS $$
BEGIN
    IF NEW.stage = 'Rejected' AND (OLD.stage IS DISTINCT FROM 'Rejected') THEN
        NEW.rejected_at = now();
        NEW.rejected_by = auth.uid();
        NEW.rejection_stage = OLD.stage;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_rejection_metadata ON public.applications;
CREATE TRIGGER trigger_rejection_metadata BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_rejection_metadata();

-- 9j. Hire metadata
CREATE OR REPLACE FUNCTION public.handle_hire_metadata()
RETURNS trigger AS $$
BEGIN
    IF NEW.stage = 'Hired' AND (OLD.stage IS DISTINCT FROM 'Hired') THEN
        NEW.hired_at = now();
        NEW.hired_by = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_hire_metadata ON public.applications;
CREATE TRIGGER trigger_hire_metadata BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_hire_metadata();

-- 9k. Auto-create employee record on hire
CREATE OR REPLACE FUNCTION public.handle_hired_candidate()
RETURNS trigger AS $$
BEGIN
    IF NEW.stage = 'Hired' AND (OLD.stage IS DISTINCT FROM 'Hired') THEN
        INSERT INTO hr.employee_records (candidate_id, application_id, hired_at)
        VALUES (NEW.candidate_id, NEW.id, now())
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_handle_hired ON public.applications;
CREATE TRIGGER trigger_handle_hired AFTER UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_hired_candidate();

-- 9l. is_admin helper
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9m. RBAC helpers
CREATE OR REPLACE FUNCTION rbac.is_super_admin() RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM rbac.user_roles ur
        JOIN rbac.roles r ON r.id = ur.role_id
        WHERE ur.user_id = auth.uid() AND r.name = 'Super Admin'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION rbac.has_permission(p_module text, p_action text) RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM rbac.user_roles ur
        JOIN rbac.role_permissions rp ON rp.role_id = ur.role_id
        JOIN rbac.permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = auth.uid()
          AND p.module = p_module
          AND p.action = p_action
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_permissions() RETURNS text[] AS $$
DECLARE perms text[];
BEGIN
    SELECT array_agg(p.module || ':' || p.action)
    INTO perms
    FROM rbac.user_roles ur
    JOIN rbac.role_permissions rp ON rp.role_id = ur.role_id
    JOIN rbac.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid();
    RETURN COALESCE(perms, '{}');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_available_roles()
RETURNS TABLE(id uuid, name text, description text) AS $$
BEGIN
    RETURN QUERY SELECT r.id, r.name, r.description FROM rbac.roles r ORDER BY r.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE(user_id uuid, email text, full_name text, legacy_role text, rbac_role_name text, rbac_role_id uuid) AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role,
           r.name AS rbac_role_name, r.id AS rbac_role_id
    FROM public.profiles p
    LEFT JOIN rbac.user_roles ur ON ur.user_id = p.id
    LEFT JOIN rbac.roles r ON r.id = ur.role_id
    ORDER BY p.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id uuid, target_role_id uuid) RETURNS boolean AS $$
BEGIN
    DELETE FROM rbac.user_roles WHERE user_id = target_user_id;
    INSERT INTO rbac.user_roles (user_id, role_id, tenant_id)
    VALUES (target_user_id, target_role_id, '00000000-0000-0000-0000-000000000001');
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 10: AI SCORING TRACKING (optional — needs pg_cron)                │
-- └──────────────────────────────────────────────────────────────────────────┘

-- NOTE: Uncomment below if your Supabase plan supports pg_cron
-- CREATE TYPE IF NOT EXISTS public.scoring_status_enum AS ENUM (
--     'pending', 'processing', 'completed', 'failed', 'fatal_error'
-- );
-- ALTER TABLE public.applications
--   ADD COLUMN IF NOT EXISTS scoring_status public.scoring_status_enum DEFAULT 'pending',
--   ADD COLUMN IF NOT EXISTS scoring_error text,
--   ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
--   ADD COLUMN IF NOT EXISTS score_completed_at timestamptz;
-- CREATE INDEX IF NOT EXISTS idx_applications_failed_scoring
--   ON public.applications(scoring_status) WHERE scoring_status = 'failed';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  PART 11: HR VIEWS (convenience)                                        │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW public.hr_employee_records AS SELECT * FROM hr.employee_records;
CREATE OR REPLACE VIEW public.hr_employee_workflows AS SELECT * FROM hr.employee_workflows;
CREATE OR REPLACE VIEW public.hr_employee_workflow_tasks AS SELECT * FROM hr.employee_workflow_tasks;
CREATE OR REPLACE VIEW public.hr_workflow_templates AS SELECT * FROM hr.workflow_templates;
CREATE OR REPLACE VIEW public.hr_workflow_template_tasks AS SELECT * FROM hr.workflow_template_tasks;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  DONE! Now follow SETUP_NEW_SUPABASE.md                                 │
-- └──────────────────────────────────────────────────────────────────────────┘
