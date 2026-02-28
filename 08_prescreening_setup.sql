/**
 * 08_prescreening_setup.sql
 *
 * Creates tables for the prescreening workflow:
 *   - prescreening_templates: reusable question templates per role
 *   - prescreening_responses: candidate answers to prescreening forms
 *   - notification_log: tracks outbound notifications (WhatsApp, email)
 *
 * Also adds prescreening_status column to applications table.
 *
 * Run in Supabase SQL Editor.
 */

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. prescreening_templates
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prescreening_templates (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    role_id         UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    name            TEXT NOT NULL DEFAULT 'Default',
    is_active       BOOLEAN NOT NULL DEFAULT true,

    -- Standard fields config — array of { field_key, label, type, required, options?, detail_prompt? }
    fixed_fields    JSONB NOT NULL DEFAULT '[
        {"field_key": "current_salary",      "label": "Current Monthly Salary (IDR)",                      "type": "currency",       "required": true},
        {"field_key": "expected_salary",     "label": "Expected Monthly Salary (IDR)",                     "type": "currency",       "required": true},
        {"field_key": "notice_period",       "label": "Notice Period",                                     "type": "select",         "required": true, "options": ["Immediately", "2 weeks", "1 month", "2 months", "3+ months"]},
        {"field_key": "availability_date",   "label": "Earliest Available Start Date",                     "type": "date",           "required": true},
        {"field_key": "certifications",      "label": "Relevant Certifications / Licenses",                "type": "textarea",       "required": false},
        {"field_key": "previously_applied",  "label": "Have you previously applied to Samara?",            "type": "yes_no_detail",  "required": true, "detail_prompt": "Which role and when?"},
        {"field_key": "relatives_at_company","label": "Do you have friends or relatives working at Samara?","type": "yes_no_detail",  "required": true, "detail_prompt": "Please provide their name(s) and position(s)."},
        {"field_key": "mbti_type",           "label": "MBTI Personality Type",                             "type": "mbti",           "required": false}
    ]'::jsonb,

    -- Custom technical / case-study questions — array of { question, type, required, options?, source, rationale? }
    custom_questions JSONB NOT NULL DEFAULT '[]'::jsonb,

    created_by      UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescreening_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prescreening templates"
    ON public.prescreening_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert prescreening templates"
    ON public.prescreening_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update prescreening templates"
    ON public.prescreening_templates FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete prescreening templates"
    ON public.prescreening_templates FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pst_role_id
    ON public.prescreening_templates(role_id);

CREATE INDEX IF NOT EXISTS idx_pst_role_active
    ON public.prescreening_templates(role_id, is_active, updated_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. prescreening_responses
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.prescreening_responses (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    application_id   UUID NOT NULL UNIQUE REFERENCES public.applications(id) ON DELETE CASCADE,
    template_id      UUID REFERENCES public.prescreening_templates(id) ON DELETE SET NULL,

    -- Candidate answers: { field_key: value, custom_q_0: "answer", ... }
    responses        JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Frozen copy of the template at send time (template may change later)
    template_snapshot JSONB,

    -- Workflow status
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'sent', 'started', 'completed', 'expired')),

    -- Token-based access (candidate accesses form via /prescreening/:token)
    access_token     TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

    sent_at          TIMESTAMPTZ,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescreening_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prescreening responses"
    ON public.prescreening_responses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert prescreening responses"
    ON public.prescreening_responses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update prescreening responses"
    ON public.prescreening_responses FOR UPDATE TO authenticated USING (true);

-- Anon read needed for the public form Edge Function (service role bypasses anyway,
-- but this ensures the edge function works when using anon key for initial load)
CREATE POLICY "Anon can read prescreening responses"
    ON public.prescreening_responses FOR SELECT TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_psr_application_id
    ON public.prescreening_responses(application_id);

CREATE INDEX IF NOT EXISTS idx_psr_access_token
    ON public.prescreening_responses(access_token);

CREATE INDEX IF NOT EXISTS idx_psr_status
    ON public.prescreening_responses(status);


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. notification_log
-- ══════════════════════════════════════════════════════════════════════════════

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

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read notification log"
    ON public.notification_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert notification log"
    ON public.notification_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_application_id
    ON public.notification_log(application_id);

CREATE INDEX IF NOT EXISTS idx_notif_created_at
    ON public.notification_log(created_at DESC);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Add prescreening_status to applications
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS prescreening_status TEXT DEFAULT 'not_sent'
    CHECK (prescreening_status IN ('not_sent', 'sent', 'started', 'completed', 'expired'));


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Triggers for updated_at
-- ══════════════════════════════════════════════════════════════════════════════

-- Reuse the existing set_updated_at function if it exists, otherwise create it
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prescreening_templates_updated_at
    BEFORE UPDATE ON public.prescreening_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_prescreening_responses_updated_at
    BEFORE UPDATE ON public.prescreening_responses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
