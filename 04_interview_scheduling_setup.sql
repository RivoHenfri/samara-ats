-- ==============================================================================
-- INTERVIEW SCHEDULING INFRASTRUCTURE
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Store OAuth tokens securely per recruiter
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'microsoft', 'zoom'
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Row Level Security: Users can only see/update their own integrations
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations" 
ON public.user_integrations 
FOR ALL 
TO authenticated 
USING (user_id = auth.uid());

-- 2. Store specific interview events and their state
CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE NOT NULL,
  organizer_id UUID REFERENCES auth.users(id) NOT NULL, -- The recruiter/interviewer
  status TEXT DEFAULT 'pending', -- pending, scheduled, completed, cancelled
  scheduled_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  duration_minutes INT DEFAULT 60,
  meeting_link TEXT,
  calendar_event_id TEXT,
  zoom_meeting_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for interviews
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read all interviews" 
ON public.interviews 
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Users insert/update interviews" 
ON public.interviews 
FOR ALL 
TO authenticated 
USING (true);

-- 3. Trigger to auto-update 'updated_at' on user_integrations
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_user_integrations_updated_at ON public.user_integrations;
CREATE TRIGGER trigger_user_integrations_updated_at
BEFORE UPDATE ON public.user_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-update 'updated_at' on interviews
DROP TRIGGER IF EXISTS trigger_interviews_updated_at ON public.interviews;
CREATE TRIGGER trigger_interviews_updated_at
BEFORE UPDATE ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
