drop extension if exists "pg_net";

create schema if not exists "hr";

create schema if not exists "rbac";

create sequence "public"."interview_rounds_id_seq";


  create table "hr"."employee_records" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "candidate_id" uuid not null,
    "application_id" uuid,
    "hired_at" timestamp with time zone default now(),
    "status" text default 'Onboarding'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "first_name" text,
    "last_name" text,
    "email" text,
    "phone" text,
    "department" text,
    "role" text,
    "manager_id" uuid,
    "start_date" date
      );


alter table "hr"."employee_records" enable row level security;


  create table "hr"."employee_workflow_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "employee_workflow_id" uuid,
    "title" text not null,
    "description" text,
    "status" text default 'pending'::text,
    "is_required" boolean default true,
    "completed_by" uuid,
    "completed_at" timestamp with time zone,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "hr"."employee_workflow_tasks" enable row level security;


  create table "hr"."employee_workflows" (
    "id" uuid not null default gen_random_uuid(),
    "employee_id" uuid,
    "template_id" uuid,
    "status" text default 'Scheduled'::text,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone default now()
      );


alter table "hr"."employee_workflows" enable row level security;


  create table "hr"."workflow_template_tasks" (
    "id" uuid not null default gen_random_uuid(),
    "template_id" uuid,
    "title" text not null,
    "description" text,
    "is_required" boolean default true,
    "sort_order" integer default 0,
    "created_at" timestamp with time zone default now()
      );


alter table "hr"."workflow_template_tasks" enable row level security;


  create table "hr"."workflow_templates" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "type" text default 'Onboarding'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "hr"."workflow_templates" enable row level security;


  create table "public"."application_history" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "application_id" uuid not null,
    "candidate_id" uuid not null,
    "role_id" uuid not null,
    "actor_id" uuid,
    "action_type" text not null,
    "previous_stage" text,
    "new_stage" text not null,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "tenant_id" uuid default '00000000-0000-0000-0000-000000000001'::uuid
      );


alter table "public"."application_history" enable row level security;


  create table "public"."application_scores" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "application_id" uuid not null,
    "overall_score" integer,
    "must_have_score" integer,
    "nice_to_have_score" integer,
    "salary_alignment_score" integer,
    "risk_flags" jsonb not null default '[]'::jsonb,
    "executive_summary" text,
    "interview_focus" jsonb not null default '[]'::jsonb,
    "scored_by_name" text,
    "model_version" text not null,
    "prompt_version" text not null default 'v1'::text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."application_scores" enable row level security;


  create table "public"."applications" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "candidate_id" uuid not null,
    "role_id" uuid not null,
    "stage" text not null default 'New'::text,
    "base_salary_offer" numeric,
    "last_stage_change_at" timestamp with time zone default now(),
    "notes" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "tenant_id" uuid default '00000000-0000-0000-0000-000000000001'::uuid,
    "source" text not null default 'Manual'::text,
    "cover_letter" text,
    "rejection_reason" text,
    "rejected_at" timestamp with time zone,
    "rejected_by" uuid,
    "rejection_stage" text,
    "hired_at" timestamp with time zone,
    "hired_by" uuid
      );


alter table "public"."applications" enable row level security;


  create table "public"."audit_ledger" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "application_id" uuid not null,
    "old_stage" text,
    "new_stage" text not null,
    "changed_by" uuid,
    "changed_at" timestamp with time zone default now()
      );


alter table "public"."audit_ledger" enable row level security;


  create table "public"."candidates" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "full_name" text not null,
    "whatsapp" text,
    "email" text,
    "origin" text not null default 'Lombok Local'::text,
    "cv_url" text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "current_salary" bigint,
    "expected_salary" bigint,
    "cv_link" text,
    "tenant_id" uuid default '00000000-0000-0000-0000-000000000001'::uuid,
    "suitability_score" real,
    "availability_to_start" text
      );


alter table "public"."candidates" enable row level security;


  create table "public"."cv_sources" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "candidate_id" uuid not null,
    "source_type" text not null,
    "file_path" text,
    "file_name" text,
    "file_size" integer,
    "file_type" text,
    "file_url" text,
    "uploaded_by" uuid,
    "is_active" boolean not null default true,
    "parsed_data" jsonb,
    "parsed_at" timestamp with time zone,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."cv_sources" enable row level security;


  create table "public"."departments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."departments" enable row level security;


  create table "public"."interview_rounds" (
    "id" integer not null default nextval('public.interview_rounds_id_seq'::regclass),
    "name" text not null,
    "sort_order" integer not null default 0
      );


alter table "public"."interview_rounds" enable row level security;


  create table "public"."interviews" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "application_id" uuid not null,
    "organizer_id" uuid not null,
    "status" text default 'pending'::text,
    "scheduled_at" timestamp with time zone,
    "end_at" timestamp with time zone,
    "duration_minutes" integer default 60,
    "meeting_link" text,
    "calendar_event_id" text,
    "zoom_meeting_id" text,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "interview_type" text not null default 'Online'::text,
    "round" text,
    "interviewers" text[] default '{}'::text[],
    "location" text
      );


alter table "public"."interviews" enable row level security;


  create table "public"."job_descriptions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "role_id" uuid not null,
    "structured_jd" jsonb not null default '{}'::jsonb,
    "formatted_internal" text not null default ''::text,
    "formatted_whatsapp" text not null default ''::text,
    "formatted_linkedin" text not null default ''::text,
    "formatted_job_board" text not null default ''::text,
    "structured_jd_id" jsonb,
    "formatted_internal_id" text,
    "formatted_whatsapp_id" text,
    "formatted_linkedin_id" text,
    "formatted_job_board_id" text,
    "scoring_criteria" jsonb not null default '{}'::jsonb,
    "generation_metadata" jsonb not null default '{}'::jsonb,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."job_descriptions" enable row level security;


  create table "public"."notes" (
    "id" uuid not null default gen_random_uuid(),
    "application_id" uuid,
    "content" text not null,
    "created_by" text default 'Satya'::text,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."notes" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "email" text not null,
    "full_name" text,
    "role" text not null default 'Viewer'::text,
    "invited_by" uuid,
    "created_at" timestamp with time zone default now(),
    "tenant_id" uuid default '00000000-0000-0000-0000-000000000001'::uuid
      );


alter table "public"."profiles" enable row level security;


  create table "public"."roles" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "title" text not null,
    "department" text not null,
    "priority" text not null default 'Medium'::text,
    "status" text not null default 'Open'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "job_context" text,
    "tenant_id" uuid default '00000000-0000-0000-0000-000000000001'::uuid,
    "location" text,
    "work_arrangement" text default 'Onsite'::text,
    "scoring_weights" jsonb default '{"must_have": 0.55, "nice_to_have": 0.25, "salary_alignment": 0.20}'::jsonb,
    "role_type" text,
    "priority_level" text default 'Normal'::text
      );


alter table "public"."roles" enable row level security;


  create table "public"."screening_questions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "application_id" uuid not null,
    "questions" jsonb not null,
    "risk_areas" jsonb default '[]'::jsonb,
    "prompt_version" text not null default 'v1'::text,
    "generated_by_name" text,
    "created_at" timestamp with time zone not null default now(),
    "model_version" text
      );


alter table "public"."screening_questions" enable row level security;


  create table "public"."tenants" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "created_at" timestamp with time zone default now(),
    "slug" text not null
      );



  create table "public"."user_integrations" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid not null,
    "provider" text not null,
    "access_token" text,
    "refresh_token" text,
    "expires_at" timestamp with time zone,
    "metadata" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."user_integrations" enable row level security;


  create table "rbac"."permissions" (
    "id" uuid not null default gen_random_uuid(),
    "module" text not null,
    "action" text not null,
    "description" text,
    "created_at" timestamp with time zone default now()
      );



  create table "rbac"."role_permissions" (
    "role_id" uuid not null,
    "permission_id" uuid not null
      );



  create table "rbac"."roles" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default now()
      );



  create table "rbac"."user_roles" (
    "user_id" uuid not null,
    "role_id" uuid not null,
    "tenant_id" uuid not null
      );


alter sequence "public"."interview_rounds_id_seq" owned by "public"."interview_rounds"."id";

CREATE UNIQUE INDEX employee_records_pkey ON hr.employee_records USING btree (id);

CREATE UNIQUE INDEX employee_workflow_tasks_pkey ON hr.employee_workflow_tasks USING btree (id);

CREATE UNIQUE INDEX employee_workflows_pkey ON hr.employee_workflows USING btree (id);

CREATE INDEX idx_employee_candidate_id ON hr.employee_records USING btree (candidate_id);

CREATE UNIQUE INDEX workflow_template_tasks_pkey ON hr.workflow_template_tasks USING btree (id);

CREATE UNIQUE INDEX workflow_templates_name_key ON hr.workflow_templates USING btree (name);

CREATE UNIQUE INDEX workflow_templates_pkey ON hr.workflow_templates USING btree (id);

CREATE UNIQUE INDEX application_history_pkey ON public.application_history USING btree (id);

CREATE UNIQUE INDEX application_scores_pkey ON public.application_scores USING btree (id);

CREATE UNIQUE INDEX applications_pkey ON public.applications USING btree (id);

CREATE UNIQUE INDEX audit_ledger_pkey ON public.audit_ledger USING btree (id);

CREATE UNIQUE INDEX candidates_pkey ON public.candidates USING btree (id);

CREATE UNIQUE INDEX cv_sources_pkey ON public.cv_sources USING btree (id);

CREATE UNIQUE INDEX departments_name_key ON public.departments USING btree (name);

CREATE UNIQUE INDEX departments_pkey ON public.departments USING btree (id);

CREATE INDEX idx_app_hist_actor_id ON public.application_history USING btree (actor_id);

CREATE INDEX idx_app_hist_app_id ON public.application_history USING btree (application_id);

CREATE INDEX idx_app_hist_candidate_id ON public.application_history USING btree (candidate_id);

CREATE INDEX idx_app_hist_created_at ON public.application_history USING btree (created_at DESC);

CREATE INDEX idx_app_hist_metadata ON public.application_history USING gin (metadata);

CREATE INDEX idx_app_hist_role_id ON public.application_history USING btree (role_id);

CREATE INDEX idx_applications_candidate ON public.applications USING btree (candidate_id);

CREATE INDEX idx_applications_hired ON public.applications USING btree (hired_at DESC) WHERE (stage = 'Hired'::text);

CREATE INDEX idx_applications_rejected ON public.applications USING btree (rejected_at DESC) WHERE (stage = 'Rejected'::text);

CREATE INDEX idx_applications_rejection_reason ON public.applications USING btree (rejection_reason) WHERE (stage = 'Rejected'::text);

CREATE INDEX idx_applications_role ON public.applications USING btree (role_id);

CREATE INDEX idx_applications_stage ON public.applications USING btree (stage);

CREATE INDEX idx_as_application_created ON public.application_scores USING btree (application_id, created_at DESC);

CREATE INDEX idx_as_application_id ON public.application_scores USING btree (application_id);

CREATE INDEX idx_as_overall_score ON public.application_scores USING btree (overall_score DESC) WHERE (overall_score IS NOT NULL);

CREATE INDEX idx_as_risk_flags ON public.application_scores USING gin (risk_flags);

CREATE INDEX idx_audit_application_id ON public.audit_ledger USING btree (application_id);

CREATE INDEX idx_candidates_origin ON public.candidates USING btree (origin);

CREATE INDEX idx_cv_sources_active ON public.cv_sources USING btree (candidate_id, is_active, created_at DESC);

CREATE INDEX idx_cv_sources_candidate ON public.cv_sources USING btree (candidate_id);

CREATE INDEX idx_cv_sources_created_at ON public.cv_sources USING btree (created_at DESC);

CREATE INDEX idx_cv_sources_parsed_data ON public.cv_sources USING gin (parsed_data);

CREATE INDEX idx_jd_role_id ON public.job_descriptions USING btree (role_id);

CREATE INDEX idx_jd_role_updated ON public.job_descriptions USING btree (role_id, updated_at DESC);

CREATE INDEX idx_jd_scoring_criteria ON public.job_descriptions USING gin (scoring_criteria);

CREATE INDEX idx_roles_department ON public.roles USING btree (department);

CREATE INDEX idx_roles_status ON public.roles USING btree (status);

CREATE INDEX idx_sq_application_id ON public.screening_questions USING btree (application_id);

CREATE INDEX idx_sq_created_at ON public.screening_questions USING btree (created_at DESC);

CREATE INDEX idx_tenants_slug ON public.tenants USING btree (slug);

CREATE UNIQUE INDEX interview_rounds_name_key ON public.interview_rounds USING btree (name);

CREATE UNIQUE INDEX interview_rounds_pkey ON public.interview_rounds USING btree (id);

CREATE UNIQUE INDEX interviews_pkey ON public.interviews USING btree (id);

CREATE UNIQUE INDEX job_descriptions_pkey ON public.job_descriptions USING btree (id);

CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id);

CREATE UNIQUE INDEX screening_questions_pkey ON public.screening_questions USING btree (id);

CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id);

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);

CREATE UNIQUE INDEX user_integrations_pkey ON public.user_integrations USING btree (id);

CREATE UNIQUE INDEX user_integrations_user_id_provider_key ON public.user_integrations USING btree (user_id, provider);

CREATE UNIQUE INDEX permissions_module_action_key ON rbac.permissions USING btree (module, action);

CREATE UNIQUE INDEX permissions_pkey ON rbac.permissions USING btree (id);

CREATE UNIQUE INDEX role_permissions_pkey ON rbac.role_permissions USING btree (role_id, permission_id);

CREATE UNIQUE INDEX roles_name_key ON rbac.roles USING btree (name);

CREATE UNIQUE INDEX roles_pkey ON rbac.roles USING btree (id);

CREATE UNIQUE INDEX user_roles_pkey ON rbac.user_roles USING btree (user_id, role_id, tenant_id);

alter table "hr"."employee_records" add constraint "employee_records_pkey" PRIMARY KEY using index "employee_records_pkey";

alter table "hr"."employee_workflow_tasks" add constraint "employee_workflow_tasks_pkey" PRIMARY KEY using index "employee_workflow_tasks_pkey";

alter table "hr"."employee_workflows" add constraint "employee_workflows_pkey" PRIMARY KEY using index "employee_workflows_pkey";

alter table "hr"."workflow_template_tasks" add constraint "workflow_template_tasks_pkey" PRIMARY KEY using index "workflow_template_tasks_pkey";

alter table "hr"."workflow_templates" add constraint "workflow_templates_pkey" PRIMARY KEY using index "workflow_templates_pkey";

alter table "public"."application_history" add constraint "application_history_pkey" PRIMARY KEY using index "application_history_pkey";

alter table "public"."application_scores" add constraint "application_scores_pkey" PRIMARY KEY using index "application_scores_pkey";

alter table "public"."applications" add constraint "applications_pkey" PRIMARY KEY using index "applications_pkey";

alter table "public"."audit_ledger" add constraint "audit_ledger_pkey" PRIMARY KEY using index "audit_ledger_pkey";

alter table "public"."candidates" add constraint "candidates_pkey" PRIMARY KEY using index "candidates_pkey";

alter table "public"."cv_sources" add constraint "cv_sources_pkey" PRIMARY KEY using index "cv_sources_pkey";

alter table "public"."departments" add constraint "departments_pkey" PRIMARY KEY using index "departments_pkey";

alter table "public"."interview_rounds" add constraint "interview_rounds_pkey" PRIMARY KEY using index "interview_rounds_pkey";

alter table "public"."interviews" add constraint "interviews_pkey" PRIMARY KEY using index "interviews_pkey";

alter table "public"."job_descriptions" add constraint "job_descriptions_pkey" PRIMARY KEY using index "job_descriptions_pkey";

alter table "public"."notes" add constraint "notes_pkey" PRIMARY KEY using index "notes_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "public"."screening_questions" add constraint "screening_questions_pkey" PRIMARY KEY using index "screening_questions_pkey";

alter table "public"."tenants" add constraint "tenants_pkey" PRIMARY KEY using index "tenants_pkey";

alter table "public"."user_integrations" add constraint "user_integrations_pkey" PRIMARY KEY using index "user_integrations_pkey";

alter table "rbac"."permissions" add constraint "permissions_pkey" PRIMARY KEY using index "permissions_pkey";

alter table "rbac"."role_permissions" add constraint "role_permissions_pkey" PRIMARY KEY using index "role_permissions_pkey";

alter table "rbac"."roles" add constraint "roles_pkey" PRIMARY KEY using index "roles_pkey";

alter table "rbac"."user_roles" add constraint "user_roles_pkey" PRIMARY KEY using index "user_roles_pkey";

alter table "hr"."employee_records" add constraint "employee_records_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL not valid;

alter table "hr"."employee_records" validate constraint "employee_records_application_id_fkey";

alter table "hr"."employee_records" add constraint "employee_records_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE not valid;

alter table "hr"."employee_records" validate constraint "employee_records_candidate_id_fkey";

alter table "hr"."employee_records" add constraint "employee_records_manager_id_fkey" FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "hr"."employee_records" validate constraint "employee_records_manager_id_fkey";

alter table "hr"."employee_workflow_tasks" add constraint "employee_workflow_tasks_completed_by_fkey" FOREIGN KEY (completed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "hr"."employee_workflow_tasks" validate constraint "employee_workflow_tasks_completed_by_fkey";

alter table "hr"."employee_workflow_tasks" add constraint "employee_workflow_tasks_employee_workflow_id_fkey" FOREIGN KEY (employee_workflow_id) REFERENCES hr.employee_workflows(id) ON DELETE CASCADE not valid;

alter table "hr"."employee_workflow_tasks" validate constraint "employee_workflow_tasks_employee_workflow_id_fkey";

alter table "hr"."employee_workflows" add constraint "employee_workflows_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES hr.employee_records(id) ON DELETE CASCADE not valid;

alter table "hr"."employee_workflows" validate constraint "employee_workflows_employee_id_fkey";

alter table "hr"."employee_workflows" add constraint "employee_workflows_template_id_fkey" FOREIGN KEY (template_id) REFERENCES hr.workflow_templates(id) ON DELETE RESTRICT not valid;

alter table "hr"."employee_workflows" validate constraint "employee_workflows_template_id_fkey";

alter table "hr"."workflow_template_tasks" add constraint "workflow_template_tasks_template_id_fkey" FOREIGN KEY (template_id) REFERENCES hr.workflow_templates(id) ON DELETE CASCADE not valid;

alter table "hr"."workflow_template_tasks" validate constraint "workflow_template_tasks_template_id_fkey";

alter table "hr"."workflow_templates" add constraint "workflow_templates_name_key" UNIQUE using index "workflow_templates_name_key";

alter table "public"."application_history" add constraint "application_history_actor_id_fkey" FOREIGN KEY (actor_id) REFERENCES auth.users(id) not valid;

alter table "public"."application_history" validate constraint "application_history_actor_id_fkey";

alter table "public"."application_history" add constraint "application_history_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."application_history" validate constraint "application_history_application_id_fkey";

alter table "public"."application_history" add constraint "application_history_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."application_history" validate constraint "application_history_tenant_id_fkey";

alter table "public"."application_scores" add constraint "application_scores_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."application_scores" validate constraint "application_scores_application_id_fkey";

alter table "public"."application_scores" add constraint "application_scores_must_have_score_check" CHECK (((must_have_score >= 0) AND (must_have_score <= 100))) not valid;

alter table "public"."application_scores" validate constraint "application_scores_must_have_score_check";

alter table "public"."application_scores" add constraint "application_scores_nice_to_have_score_check" CHECK (((nice_to_have_score >= 0) AND (nice_to_have_score <= 100))) not valid;

alter table "public"."application_scores" validate constraint "application_scores_nice_to_have_score_check";

alter table "public"."application_scores" add constraint "application_scores_overall_score_check" CHECK (((overall_score >= 0) AND (overall_score <= 100))) not valid;

alter table "public"."application_scores" validate constraint "application_scores_overall_score_check";

alter table "public"."application_scores" add constraint "application_scores_salary_alignment_score_check" CHECK (((salary_alignment_score >= 0) AND (salary_alignment_score <= 100))) not valid;

alter table "public"."application_scores" validate constraint "application_scores_salary_alignment_score_check";

alter table "public"."applications" add constraint "applications_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE not valid;

alter table "public"."applications" validate constraint "applications_candidate_id_fkey";

alter table "public"."applications" add constraint "applications_hired_by_fkey" FOREIGN KEY (hired_by) REFERENCES auth.users(id) not valid;

alter table "public"."applications" validate constraint "applications_hired_by_fkey";

alter table "public"."applications" add constraint "applications_rejected_by_fkey" FOREIGN KEY (rejected_by) REFERENCES auth.users(id) not valid;

alter table "public"."applications" validate constraint "applications_rejected_by_fkey";

alter table "public"."applications" add constraint "applications_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE not valid;

alter table "public"."applications" validate constraint "applications_role_id_fkey";

alter table "public"."applications" add constraint "applications_stage_check" CHECK ((stage = ANY (ARRAY['New'::text, 'Screening'::text, 'Interview Pending'::text, 'Interview Scheduled'::text, 'Interview Completed'::text, 'Offer'::text, 'Hired'::text, 'Rejected'::text]))) not valid;

alter table "public"."applications" validate constraint "applications_stage_check";

alter table "public"."applications" add constraint "applications_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."applications" validate constraint "applications_tenant_id_fkey";

alter table "public"."applications" add constraint "chk_applications_source" CHECK ((source = ANY (ARRAY['Manual'::text, 'Career Page'::text, 'Import'::text, 'Referral'::text]))) not valid;

alter table "public"."applications" validate constraint "chk_applications_source";

alter table "public"."audit_ledger" add constraint "audit_ledger_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."audit_ledger" validate constraint "audit_ledger_application_id_fkey";

alter table "public"."audit_ledger" add constraint "audit_ledger_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL not valid;

alter table "public"."audit_ledger" validate constraint "audit_ledger_changed_by_fkey";

alter table "public"."candidates" add constraint "candidates_origin_check" CHECK ((origin = ANY (ARRAY['Lombok Local'::text, 'Indonesian (Non-Lombok)'::text, 'International'::text]))) not valid;

alter table "public"."candidates" validate constraint "candidates_origin_check";

alter table "public"."candidates" add constraint "candidates_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."candidates" validate constraint "candidates_tenant_id_fkey";

alter table "public"."cv_sources" add constraint "cv_sources_candidate_id_fkey" FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE not valid;

alter table "public"."cv_sources" validate constraint "cv_sources_candidate_id_fkey";

alter table "public"."cv_sources" add constraint "cv_sources_source_type_check" CHECK ((source_type = ANY (ARRAY['upload'::text, 'link'::text]))) not valid;

alter table "public"."cv_sources" validate constraint "cv_sources_source_type_check";

alter table "public"."cv_sources" add constraint "cv_sources_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) not valid;

alter table "public"."cv_sources" validate constraint "cv_sources_uploaded_by_fkey";

alter table "public"."departments" add constraint "departments_name_key" UNIQUE using index "departments_name_key";

alter table "public"."interview_rounds" add constraint "interview_rounds_name_key" UNIQUE using index "interview_rounds_name_key";

alter table "public"."interviews" add constraint "interviews_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."interviews" validate constraint "interviews_application_id_fkey";

alter table "public"."interviews" add constraint "interviews_location_check" CHECK (((location IS NULL) OR (location = ANY (ARRAY['Lombok'::text, 'Sumbawa'::text, 'Bali'::text, 'Jakarta'::text])))) not valid;

alter table "public"."interviews" validate constraint "interviews_location_check";

alter table "public"."interviews" add constraint "interviews_organizer_id_fkey" FOREIGN KEY (organizer_id) REFERENCES auth.users(id) not valid;

alter table "public"."interviews" validate constraint "interviews_organizer_id_fkey";

alter table "public"."interviews" add constraint "interviews_type_check" CHECK ((interview_type = ANY (ARRAY['Online'::text, 'Onsite'::text]))) not valid;

alter table "public"."interviews" validate constraint "interviews_type_check";

alter table "public"."job_descriptions" add constraint "job_descriptions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE not valid;

alter table "public"."job_descriptions" validate constraint "job_descriptions_role_id_fkey";

alter table "public"."notes" add constraint "notes_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_application_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."profiles" add constraint "profiles_invited_by_fkey" FOREIGN KEY (invited_by) REFERENCES auth.users(id) not valid;

alter table "public"."profiles" validate constraint "profiles_invited_by_fkey";

alter table "public"."profiles" add constraint "profiles_role_check" CHECK ((role = ANY (ARRAY['Admin'::text, 'Manager'::text, 'Viewer'::text]))) not valid;

alter table "public"."profiles" validate constraint "profiles_role_check";

alter table "public"."profiles" add constraint "profiles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."profiles" validate constraint "profiles_tenant_id_fkey";

alter table "public"."roles" add constraint "roles_department_check" CHECK ((department = ANY (ARRAY['Hospitality'::text, 'Operations'::text, 'Construction'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_department_check";

alter table "public"."roles" add constraint "roles_priority_check" CHECK ((priority = ANY (ARRAY['Critical'::text, 'Core'::text, 'Support'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_priority_check";

alter table "public"."roles" add constraint "roles_role_type_check" CHECK (((role_type IS NULL) OR (role_type = ANY (ARRAY['Replacement'::text, 'New Position'::text, 'Additional Headcount'::text])))) not valid;

alter table "public"."roles" validate constraint "roles_role_type_check";

alter table "public"."roles" add constraint "roles_status_check" CHECK ((status = ANY (ARRAY['Open'::text, 'Closed'::text]))) not valid;

alter table "public"."roles" validate constraint "roles_status_check";

alter table "public"."roles" add constraint "roles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) not valid;

alter table "public"."roles" validate constraint "roles_tenant_id_fkey";

alter table "public"."screening_questions" add constraint "screening_questions_application_id_fkey" FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE not valid;

alter table "public"."screening_questions" validate constraint "screening_questions_application_id_fkey";

alter table "public"."tenants" add constraint "tenants_slug_key" UNIQUE using index "tenants_slug_key";

alter table "public"."user_integrations" add constraint "user_integrations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_integrations" validate constraint "user_integrations_user_id_fkey";

alter table "public"."user_integrations" add constraint "user_integrations_user_id_provider_key" UNIQUE using index "user_integrations_user_id_provider_key";

alter table "rbac"."permissions" add constraint "permissions_module_action_key" UNIQUE using index "permissions_module_action_key";

alter table "rbac"."role_permissions" add constraint "role_permissions_permission_id_fkey" FOREIGN KEY (permission_id) REFERENCES rbac.permissions(id) ON DELETE CASCADE not valid;

alter table "rbac"."role_permissions" validate constraint "role_permissions_permission_id_fkey";

alter table "rbac"."role_permissions" add constraint "role_permissions_role_id_fkey" FOREIGN KEY (role_id) REFERENCES rbac.roles(id) ON DELETE CASCADE not valid;

alter table "rbac"."role_permissions" validate constraint "role_permissions_role_id_fkey";

alter table "rbac"."roles" add constraint "roles_name_key" UNIQUE using index "roles_name_key";

alter table "rbac"."user_roles" add constraint "user_roles_role_id_fkey" FOREIGN KEY (role_id) REFERENCES rbac.roles(id) ON DELETE CASCADE not valid;

alter table "rbac"."user_roles" validate constraint "user_roles_role_id_fkey";

alter table "rbac"."user_roles" add constraint "user_roles_tenant_id_fkey" FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE not valid;

alter table "rbac"."user_roles" validate constraint "user_roles_tenant_id_fkey";

alter table "rbac"."user_roles" add constraint "user_roles_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "rbac"."user_roles" validate constraint "user_roles_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.assign_user_role(target_user_id uuid, target_role_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Security Check
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to assign roles.';
    END IF;

    -- Upsert the user role
    INSERT INTO rbac.user_roles (user_id, role_id, tenant_id)
    VALUES (target_user_id, target_role_id, public.current_tenant_id())
    ON CONFLICT (user_id, role_id, tenant_id) 
    DO UPDATE SET role_id = EXCLUDED.role_id;

    -- Alternatively, if a user can only have ONE role per tenant in your business logic, 
    -- we should delete old roles first or rely on a unique constraint. 
    -- Since the primary key is (user_id, role_id, tenant_id), to functionally "switch" a role
    -- we delete previous roles for this tenant first.
    
    DELETE FROM rbac.user_roles 
    WHERE user_id = target_user_id 
      AND tenant_id = public.current_tenant_id()
      AND role_id != target_role_id;

    RETURN TRUE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
    SELECT (NULLIF(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id', ''))::UUID;
$function$
;

CREATE OR REPLACE FUNCTION public.deactivate_old_cv_versions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.cv_sources
  SET is_active = false
  WHERE candidate_id = NEW.candidate_id
    AND id != NEW.id
    AND is_active = true;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_interview_scheduled_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  has_scheduled BOOLEAN;
BEGIN
  -- Only fire when stage is being changed TO 'Interview Scheduled'
  IF NEW.stage = 'Interview Scheduled'
     AND (OLD.stage IS NULL OR OLD.stage IS DISTINCT FROM 'Interview Scheduled') THEN
    SELECT EXISTS (
      SELECT 1 FROM public.interviews
      WHERE application_id = NEW.id
        AND scheduled_at IS NOT NULL
    ) INTO has_scheduled;

    IF NOT has_scheduled THEN
      RAISE EXCEPTION 'Cannot move to Interview Scheduled: no interview with a scheduled date exists for this application.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
 RETURNS TABLE(id uuid, email text, full_name text, role_id uuid, role_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Security Check: Only Super Admins can list all users and their roles
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to view the user list.';
    END IF;

    RETURN QUERY
    SELECT 
        au.id,
        au.email::text,
        COALESCE(p.full_name, au.raw_user_meta_data->>'full_name', '') AS full_name,
        ur.role_id,
        COALESCE(r.name, 'Unassigned') AS role_name,
        au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON au.id = p.id
    LEFT JOIN rbac.user_roles ur ON au.id = ur.user_id AND ur.tenant_id = public.current_tenant_id()
    LEFT JOIN rbac.roles r ON ur.role_id = r.id
    ORDER BY au.created_at DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_available_roles()
 RETURNS TABLE(id uuid, name text, description text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
    -- Security Check
    IF NOT rbac.is_super_admin() THEN
        RAISE EXCEPTION 'Access Denied: You must be a Super Admin to view roles.';
    END IF;

    RETURN QUERY
    SELECT r.id, r.name, r.description
    FROM rbac.roles r
    ORDER BY r.created_at ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_permissions()
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    perms text[];
BEGIN
    SELECT array_agg(p.module || ':' || p.action) INTO perms
    FROM rbac.user_roles ur
    JOIN rbac.roles r ON ur.role_id = r.id
    JOIN rbac.role_permissions rp ON r.id = rp.role_id
    JOIN rbac.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid() 
      AND ur.tenant_id = public.current_tenant_id();
      
    RETURN COALESCE(perms, ARRAY[]::text[]);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_hire_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.stage = 'Hired' AND (OLD.stage IS NULL OR OLD.stage != 'Hired') THEN
    NEW.hired_at := NOW();
    NEW.hired_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_hired_candidate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    cand_row RECORD;
    emp_department TEXT;
    role_title TEXT;
BEGIN
    -- Only act if stage changes TO 'Hired'
    IF NEW.stage = 'Hired' AND (OLD.stage IS NULL OR OLD.stage != 'Hired') THEN

        -- Get candidate details
        SELECT * INTO cand_row FROM public.candidates WHERE id = NEW.candidate_id;

        -- Get role details for department
        SELECT title INTO role_title FROM public.roles WHERE id = NEW.role_id;
        SELECT COALESCE((SELECT department FROM public.roles WHERE id = NEW.role_id LIMIT 1), 'General')
        INTO emp_department;

        -- Insert into hr.employee_records (idempotent check)
        IF NOT EXISTS (SELECT 1 FROM hr.employee_records WHERE candidate_id = NEW.candidate_id) THEN
            INSERT INTO hr.employee_records (
                candidate_id,
                application_id,
                first_name,
                last_name,
                email,
                phone,
                department,
                role,
                status
            ) VALUES (
                cand_row.id,
                NEW.id,
                split_part(cand_row.full_name, ' ', 1),
                CASE
                    WHEN position(' ' in cand_row.full_name) > 0
                    THEN substring(cand_row.full_name from position(' ' in cand_row.full_name) + 1)
                    ELSE ''
                END,
                cand_row.email,
                cand_row.whatsapp,
                emp_department,
                role_title,
                'Pending'
            );
        ELSE
            -- If employee record already exists, update the application_id
            UPDATE hr.employee_records
            SET application_id = NEW.id
            WHERE candidate_id = NEW.candidate_id
              AND application_id IS NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Viewer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_rejection_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- When moving INTO Rejected
  IF NEW.stage = 'Rejected' AND (OLD.stage IS NULL OR OLD.stage != 'Rejected') THEN
    NEW.rejected_at    := NOW();
    NEW.rejected_by    := auth.uid();
    NEW.rejection_stage := OLD.stage;
  END IF;

  -- When reconsidered (moved OUT of Rejected)
  IF OLD.stage = 'Rejected' AND NEW.stage != 'Rejected' THEN
    NEW.rejected_at     := NULL;
    NEW.rejected_by     := NULL;
    NEW.rejection_stage := NULL;
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END;
$function$
;

create or replace view "public"."hr_employee_records" as  SELECT id,
    candidate_id,
    application_id,
    hired_at,
    status,
    created_at,
    updated_at,
    first_name,
    last_name,
    email,
    phone,
    department,
    role,
    manager_id,
    start_date
   FROM hr.employee_records;


create or replace view "public"."hr_employee_workflow_tasks" as  SELECT id,
    employee_workflow_id,
    title,
    description,
    status,
    is_required,
    completed_by,
    completed_at,
    sort_order,
    created_at
   FROM hr.employee_workflow_tasks;


create or replace view "public"."hr_employee_workflows" as  SELECT id,
    employee_id,
    template_id,
    status,
    started_at,
    completed_at,
    created_at
   FROM hr.employee_workflows;


create or replace view "public"."hr_workflow_template_tasks" as  SELECT id,
    template_id,
    title,
    description,
    is_required,
    sort_order,
    created_at
   FROM hr.workflow_template_tasks;


create or replace view "public"."hr_workflow_templates" as  SELECT id,
    name,
    description,
    type,
    created_at
   FROM hr.workflow_templates;


CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
     SELECT rbac.has_permission(auth.uid(), 'employees', 'manage')
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_application_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO public.audit_ledger (application_id, old_stage, new_stage, changed_by)
        VALUES (
            NEW.id,
            OLD.stage,
            NEW.stage,
            auth.uid() -- captures the user making the change if via Supabase API
        );
        
        -- If moving to Hired, automatically provision HR record
        IF NEW.stage = 'Hired' THEN
            -- Only insert if one doesn't already exist for this candidate/application to prevent dupes
            IF NOT EXISTS (
                SELECT 1 FROM hr.employee_records 
                WHERE application_id = NEW.id
            ) THEN
                INSERT INTO hr.employee_records (candidate_id, application_id, hired_at)
                VALUES (NEW.candidate_id, NEW.id, NOW());
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        json_build_object('tenant_id', NEW.tenant_id, 'role', NEW.role)::jsonb
    WHERE id = NEW.id;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_stage_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.last_stage_change_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION rbac.has_permission(_user_id uuid, _module text, _action text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    _has_access BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_roles ur
        JOIN rbac.role_permissions rp ON ur.role_id = rp.role_id
        JOIN rbac.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = _user_id
          AND p.module = _module
          AND p.action = _action
          AND ur.tenant_id = public.current_tenant_id()
    ) INTO _has_access;

    RETURN _has_access;
END;
$function$
;

CREATE OR REPLACE FUNCTION rbac.is_super_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
    _is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM rbac.user_roles ur
        JOIN rbac.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name = 'Super Admin'
          AND ur.tenant_id = public.current_tenant_id()
    ) INTO _is_admin;
    RETURN _is_admin;
END;
$function$
;

grant delete on table "hr"."employee_records" to "anon";

grant insert on table "hr"."employee_records" to "anon";

grant select on table "hr"."employee_records" to "anon";

grant update on table "hr"."employee_records" to "anon";

grant delete on table "hr"."employee_records" to "authenticated";

grant insert on table "hr"."employee_records" to "authenticated";

grant select on table "hr"."employee_records" to "authenticated";

grant update on table "hr"."employee_records" to "authenticated";

grant delete on table "hr"."employee_workflow_tasks" to "anon";

grant insert on table "hr"."employee_workflow_tasks" to "anon";

grant select on table "hr"."employee_workflow_tasks" to "anon";

grant update on table "hr"."employee_workflow_tasks" to "anon";

grant delete on table "hr"."employee_workflow_tasks" to "authenticated";

grant insert on table "hr"."employee_workflow_tasks" to "authenticated";

grant select on table "hr"."employee_workflow_tasks" to "authenticated";

grant update on table "hr"."employee_workflow_tasks" to "authenticated";

grant delete on table "hr"."employee_workflows" to "anon";

grant insert on table "hr"."employee_workflows" to "anon";

grant select on table "hr"."employee_workflows" to "anon";

grant update on table "hr"."employee_workflows" to "anon";

grant delete on table "hr"."employee_workflows" to "authenticated";

grant insert on table "hr"."employee_workflows" to "authenticated";

grant select on table "hr"."employee_workflows" to "authenticated";

grant update on table "hr"."employee_workflows" to "authenticated";

grant delete on table "hr"."workflow_template_tasks" to "anon";

grant insert on table "hr"."workflow_template_tasks" to "anon";

grant select on table "hr"."workflow_template_tasks" to "anon";

grant update on table "hr"."workflow_template_tasks" to "anon";

grant delete on table "hr"."workflow_template_tasks" to "authenticated";

grant insert on table "hr"."workflow_template_tasks" to "authenticated";

grant select on table "hr"."workflow_template_tasks" to "authenticated";

grant update on table "hr"."workflow_template_tasks" to "authenticated";

grant delete on table "hr"."workflow_templates" to "anon";

grant insert on table "hr"."workflow_templates" to "anon";

grant select on table "hr"."workflow_templates" to "anon";

grant update on table "hr"."workflow_templates" to "anon";

grant delete on table "hr"."workflow_templates" to "authenticated";

grant insert on table "hr"."workflow_templates" to "authenticated";

grant select on table "hr"."workflow_templates" to "authenticated";

grant update on table "hr"."workflow_templates" to "authenticated";

grant insert on table "public"."application_history" to "anon";

grant references on table "public"."application_history" to "anon";

grant select on table "public"."application_history" to "anon";

grant trigger on table "public"."application_history" to "anon";

grant truncate on table "public"."application_history" to "anon";

grant insert on table "public"."application_history" to "authenticated";

grant references on table "public"."application_history" to "authenticated";

grant select on table "public"."application_history" to "authenticated";

grant trigger on table "public"."application_history" to "authenticated";

grant truncate on table "public"."application_history" to "authenticated";

grant delete on table "public"."application_history" to "service_role";

grant insert on table "public"."application_history" to "service_role";

grant references on table "public"."application_history" to "service_role";

grant select on table "public"."application_history" to "service_role";

grant trigger on table "public"."application_history" to "service_role";

grant truncate on table "public"."application_history" to "service_role";

grant update on table "public"."application_history" to "service_role";

grant delete on table "public"."application_scores" to "anon";

grant insert on table "public"."application_scores" to "anon";

grant references on table "public"."application_scores" to "anon";

grant select on table "public"."application_scores" to "anon";

grant trigger on table "public"."application_scores" to "anon";

grant truncate on table "public"."application_scores" to "anon";

grant update on table "public"."application_scores" to "anon";

grant delete on table "public"."application_scores" to "authenticated";

grant insert on table "public"."application_scores" to "authenticated";

grant references on table "public"."application_scores" to "authenticated";

grant select on table "public"."application_scores" to "authenticated";

grant trigger on table "public"."application_scores" to "authenticated";

grant truncate on table "public"."application_scores" to "authenticated";

grant update on table "public"."application_scores" to "authenticated";

grant delete on table "public"."application_scores" to "service_role";

grant insert on table "public"."application_scores" to "service_role";

grant references on table "public"."application_scores" to "service_role";

grant select on table "public"."application_scores" to "service_role";

grant trigger on table "public"."application_scores" to "service_role";

grant truncate on table "public"."application_scores" to "service_role";

grant update on table "public"."application_scores" to "service_role";

grant delete on table "public"."applications" to "anon";

grant insert on table "public"."applications" to "anon";

grant references on table "public"."applications" to "anon";

grant select on table "public"."applications" to "anon";

grant trigger on table "public"."applications" to "anon";

grant truncate on table "public"."applications" to "anon";

grant update on table "public"."applications" to "anon";

grant delete on table "public"."applications" to "authenticated";

grant insert on table "public"."applications" to "authenticated";

grant references on table "public"."applications" to "authenticated";

grant select on table "public"."applications" to "authenticated";

grant trigger on table "public"."applications" to "authenticated";

grant truncate on table "public"."applications" to "authenticated";

grant update on table "public"."applications" to "authenticated";

grant delete on table "public"."applications" to "service_role";

grant insert on table "public"."applications" to "service_role";

grant references on table "public"."applications" to "service_role";

grant select on table "public"."applications" to "service_role";

grant trigger on table "public"."applications" to "service_role";

grant truncate on table "public"."applications" to "service_role";

grant update on table "public"."applications" to "service_role";

grant delete on table "public"."audit_ledger" to "anon";

grant insert on table "public"."audit_ledger" to "anon";

grant references on table "public"."audit_ledger" to "anon";

grant select on table "public"."audit_ledger" to "anon";

grant trigger on table "public"."audit_ledger" to "anon";

grant truncate on table "public"."audit_ledger" to "anon";

grant update on table "public"."audit_ledger" to "anon";

grant delete on table "public"."audit_ledger" to "authenticated";

grant insert on table "public"."audit_ledger" to "authenticated";

grant references on table "public"."audit_ledger" to "authenticated";

grant select on table "public"."audit_ledger" to "authenticated";

grant trigger on table "public"."audit_ledger" to "authenticated";

grant truncate on table "public"."audit_ledger" to "authenticated";

grant update on table "public"."audit_ledger" to "authenticated";

grant delete on table "public"."audit_ledger" to "service_role";

grant insert on table "public"."audit_ledger" to "service_role";

grant references on table "public"."audit_ledger" to "service_role";

grant select on table "public"."audit_ledger" to "service_role";

grant trigger on table "public"."audit_ledger" to "service_role";

grant truncate on table "public"."audit_ledger" to "service_role";

grant update on table "public"."audit_ledger" to "service_role";

grant delete on table "public"."candidates" to "anon";

grant insert on table "public"."candidates" to "anon";

grant references on table "public"."candidates" to "anon";

grant select on table "public"."candidates" to "anon";

grant trigger on table "public"."candidates" to "anon";

grant truncate on table "public"."candidates" to "anon";

grant update on table "public"."candidates" to "anon";

grant delete on table "public"."candidates" to "authenticated";

grant insert on table "public"."candidates" to "authenticated";

grant references on table "public"."candidates" to "authenticated";

grant select on table "public"."candidates" to "authenticated";

grant trigger on table "public"."candidates" to "authenticated";

grant truncate on table "public"."candidates" to "authenticated";

grant update on table "public"."candidates" to "authenticated";

grant delete on table "public"."candidates" to "service_role";

grant insert on table "public"."candidates" to "service_role";

grant references on table "public"."candidates" to "service_role";

grant select on table "public"."candidates" to "service_role";

grant trigger on table "public"."candidates" to "service_role";

grant truncate on table "public"."candidates" to "service_role";

grant update on table "public"."candidates" to "service_role";

grant delete on table "public"."cv_sources" to "anon";

grant insert on table "public"."cv_sources" to "anon";

grant references on table "public"."cv_sources" to "anon";

grant select on table "public"."cv_sources" to "anon";

grant trigger on table "public"."cv_sources" to "anon";

grant truncate on table "public"."cv_sources" to "anon";

grant update on table "public"."cv_sources" to "anon";

grant delete on table "public"."cv_sources" to "authenticated";

grant insert on table "public"."cv_sources" to "authenticated";

grant references on table "public"."cv_sources" to "authenticated";

grant select on table "public"."cv_sources" to "authenticated";

grant trigger on table "public"."cv_sources" to "authenticated";

grant truncate on table "public"."cv_sources" to "authenticated";

grant update on table "public"."cv_sources" to "authenticated";

grant delete on table "public"."cv_sources" to "service_role";

grant insert on table "public"."cv_sources" to "service_role";

grant references on table "public"."cv_sources" to "service_role";

grant select on table "public"."cv_sources" to "service_role";

grant trigger on table "public"."cv_sources" to "service_role";

grant truncate on table "public"."cv_sources" to "service_role";

grant update on table "public"."cv_sources" to "service_role";

grant delete on table "public"."departments" to "anon";

grant insert on table "public"."departments" to "anon";

grant references on table "public"."departments" to "anon";

grant select on table "public"."departments" to "anon";

grant trigger on table "public"."departments" to "anon";

grant truncate on table "public"."departments" to "anon";

grant update on table "public"."departments" to "anon";

grant delete on table "public"."departments" to "authenticated";

grant insert on table "public"."departments" to "authenticated";

grant references on table "public"."departments" to "authenticated";

grant select on table "public"."departments" to "authenticated";

grant trigger on table "public"."departments" to "authenticated";

grant truncate on table "public"."departments" to "authenticated";

grant update on table "public"."departments" to "authenticated";

grant delete on table "public"."departments" to "service_role";

grant insert on table "public"."departments" to "service_role";

grant references on table "public"."departments" to "service_role";

grant select on table "public"."departments" to "service_role";

grant trigger on table "public"."departments" to "service_role";

grant truncate on table "public"."departments" to "service_role";

grant update on table "public"."departments" to "service_role";

grant delete on table "public"."interview_rounds" to "anon";

grant insert on table "public"."interview_rounds" to "anon";

grant references on table "public"."interview_rounds" to "anon";

grant select on table "public"."interview_rounds" to "anon";

grant trigger on table "public"."interview_rounds" to "anon";

grant truncate on table "public"."interview_rounds" to "anon";

grant update on table "public"."interview_rounds" to "anon";

grant delete on table "public"."interview_rounds" to "authenticated";

grant insert on table "public"."interview_rounds" to "authenticated";

grant references on table "public"."interview_rounds" to "authenticated";

grant select on table "public"."interview_rounds" to "authenticated";

grant trigger on table "public"."interview_rounds" to "authenticated";

grant truncate on table "public"."interview_rounds" to "authenticated";

grant update on table "public"."interview_rounds" to "authenticated";

grant delete on table "public"."interview_rounds" to "service_role";

grant insert on table "public"."interview_rounds" to "service_role";

grant references on table "public"."interview_rounds" to "service_role";

grant select on table "public"."interview_rounds" to "service_role";

grant trigger on table "public"."interview_rounds" to "service_role";

grant truncate on table "public"."interview_rounds" to "service_role";

grant update on table "public"."interview_rounds" to "service_role";

grant delete on table "public"."interviews" to "anon";

grant insert on table "public"."interviews" to "anon";

grant references on table "public"."interviews" to "anon";

grant select on table "public"."interviews" to "anon";

grant trigger on table "public"."interviews" to "anon";

grant truncate on table "public"."interviews" to "anon";

grant update on table "public"."interviews" to "anon";

grant delete on table "public"."interviews" to "authenticated";

grant insert on table "public"."interviews" to "authenticated";

grant references on table "public"."interviews" to "authenticated";

grant select on table "public"."interviews" to "authenticated";

grant trigger on table "public"."interviews" to "authenticated";

grant truncate on table "public"."interviews" to "authenticated";

grant update on table "public"."interviews" to "authenticated";

grant delete on table "public"."interviews" to "service_role";

grant insert on table "public"."interviews" to "service_role";

grant references on table "public"."interviews" to "service_role";

grant select on table "public"."interviews" to "service_role";

grant trigger on table "public"."interviews" to "service_role";

grant truncate on table "public"."interviews" to "service_role";

grant update on table "public"."interviews" to "service_role";

grant delete on table "public"."job_descriptions" to "anon";

grant insert on table "public"."job_descriptions" to "anon";

grant references on table "public"."job_descriptions" to "anon";

grant select on table "public"."job_descriptions" to "anon";

grant trigger on table "public"."job_descriptions" to "anon";

grant truncate on table "public"."job_descriptions" to "anon";

grant update on table "public"."job_descriptions" to "anon";

grant delete on table "public"."job_descriptions" to "authenticated";

grant insert on table "public"."job_descriptions" to "authenticated";

grant references on table "public"."job_descriptions" to "authenticated";

grant select on table "public"."job_descriptions" to "authenticated";

grant trigger on table "public"."job_descriptions" to "authenticated";

grant truncate on table "public"."job_descriptions" to "authenticated";

grant update on table "public"."job_descriptions" to "authenticated";

grant delete on table "public"."job_descriptions" to "service_role";

grant insert on table "public"."job_descriptions" to "service_role";

grant references on table "public"."job_descriptions" to "service_role";

grant select on table "public"."job_descriptions" to "service_role";

grant trigger on table "public"."job_descriptions" to "service_role";

grant truncate on table "public"."job_descriptions" to "service_role";

grant update on table "public"."job_descriptions" to "service_role";

grant delete on table "public"."notes" to "anon";

grant insert on table "public"."notes" to "anon";

grant references on table "public"."notes" to "anon";

grant select on table "public"."notes" to "anon";

grant trigger on table "public"."notes" to "anon";

grant truncate on table "public"."notes" to "anon";

grant update on table "public"."notes" to "anon";

grant delete on table "public"."notes" to "authenticated";

grant insert on table "public"."notes" to "authenticated";

grant references on table "public"."notes" to "authenticated";

grant select on table "public"."notes" to "authenticated";

grant trigger on table "public"."notes" to "authenticated";

grant truncate on table "public"."notes" to "authenticated";

grant update on table "public"."notes" to "authenticated";

grant delete on table "public"."notes" to "service_role";

grant insert on table "public"."notes" to "service_role";

grant references on table "public"."notes" to "service_role";

grant select on table "public"."notes" to "service_role";

grant trigger on table "public"."notes" to "service_role";

grant truncate on table "public"."notes" to "service_role";

grant update on table "public"."notes" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."roles" to "anon";

grant insert on table "public"."roles" to "anon";

grant references on table "public"."roles" to "anon";

grant select on table "public"."roles" to "anon";

grant trigger on table "public"."roles" to "anon";

grant truncate on table "public"."roles" to "anon";

grant update on table "public"."roles" to "anon";

grant delete on table "public"."roles" to "authenticated";

grant insert on table "public"."roles" to "authenticated";

grant references on table "public"."roles" to "authenticated";

grant select on table "public"."roles" to "authenticated";

grant trigger on table "public"."roles" to "authenticated";

grant truncate on table "public"."roles" to "authenticated";

grant update on table "public"."roles" to "authenticated";

grant delete on table "public"."roles" to "service_role";

grant insert on table "public"."roles" to "service_role";

grant references on table "public"."roles" to "service_role";

grant select on table "public"."roles" to "service_role";

grant trigger on table "public"."roles" to "service_role";

grant truncate on table "public"."roles" to "service_role";

grant update on table "public"."roles" to "service_role";

grant delete on table "public"."screening_questions" to "anon";

grant insert on table "public"."screening_questions" to "anon";

grant references on table "public"."screening_questions" to "anon";

grant select on table "public"."screening_questions" to "anon";

grant trigger on table "public"."screening_questions" to "anon";

grant truncate on table "public"."screening_questions" to "anon";

grant update on table "public"."screening_questions" to "anon";

grant delete on table "public"."screening_questions" to "authenticated";

grant insert on table "public"."screening_questions" to "authenticated";

grant references on table "public"."screening_questions" to "authenticated";

grant select on table "public"."screening_questions" to "authenticated";

grant trigger on table "public"."screening_questions" to "authenticated";

grant truncate on table "public"."screening_questions" to "authenticated";

grant update on table "public"."screening_questions" to "authenticated";

grant delete on table "public"."screening_questions" to "service_role";

grant insert on table "public"."screening_questions" to "service_role";

grant references on table "public"."screening_questions" to "service_role";

grant select on table "public"."screening_questions" to "service_role";

grant trigger on table "public"."screening_questions" to "service_role";

grant truncate on table "public"."screening_questions" to "service_role";

grant update on table "public"."screening_questions" to "service_role";

grant delete on table "public"."tenants" to "anon";

grant insert on table "public"."tenants" to "anon";

grant references on table "public"."tenants" to "anon";

grant select on table "public"."tenants" to "anon";

grant trigger on table "public"."tenants" to "anon";

grant truncate on table "public"."tenants" to "anon";

grant update on table "public"."tenants" to "anon";

grant delete on table "public"."tenants" to "authenticated";

grant insert on table "public"."tenants" to "authenticated";

grant references on table "public"."tenants" to "authenticated";

grant select on table "public"."tenants" to "authenticated";

grant trigger on table "public"."tenants" to "authenticated";

grant truncate on table "public"."tenants" to "authenticated";

grant update on table "public"."tenants" to "authenticated";

grant delete on table "public"."tenants" to "service_role";

grant insert on table "public"."tenants" to "service_role";

grant references on table "public"."tenants" to "service_role";

grant select on table "public"."tenants" to "service_role";

grant trigger on table "public"."tenants" to "service_role";

grant truncate on table "public"."tenants" to "service_role";

grant update on table "public"."tenants" to "service_role";

grant delete on table "public"."user_integrations" to "anon";

grant insert on table "public"."user_integrations" to "anon";

grant references on table "public"."user_integrations" to "anon";

grant select on table "public"."user_integrations" to "anon";

grant trigger on table "public"."user_integrations" to "anon";

grant truncate on table "public"."user_integrations" to "anon";

grant update on table "public"."user_integrations" to "anon";

grant delete on table "public"."user_integrations" to "authenticated";

grant insert on table "public"."user_integrations" to "authenticated";

grant references on table "public"."user_integrations" to "authenticated";

grant select on table "public"."user_integrations" to "authenticated";

grant trigger on table "public"."user_integrations" to "authenticated";

grant truncate on table "public"."user_integrations" to "authenticated";

grant update on table "public"."user_integrations" to "authenticated";

grant delete on table "public"."user_integrations" to "service_role";

grant insert on table "public"."user_integrations" to "service_role";

grant references on table "public"."user_integrations" to "service_role";

grant select on table "public"."user_integrations" to "service_role";

grant trigger on table "public"."user_integrations" to "service_role";

grant truncate on table "public"."user_integrations" to "service_role";

grant update on table "public"."user_integrations" to "service_role";


  create policy "Admins have full access to employee_records"
  on "hr"."employee_records"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Allow authenticated full access to hr.employee_records"
  on "hr"."employee_records"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Hiring Managers can update their direct reports"
  on "hr"."employee_records"
  as permissive
  for update
  to public
using ((manager_id = auth.uid()));



  create policy "Hiring Managers can view their direct reports"
  on "hr"."employee_records"
  as permissive
  for select
  to public
using ((manager_id = auth.uid()));



  create policy "Admins have full access to employee_workflow_tasks"
  on "hr"."employee_workflow_tasks"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Hiring Managers can update workflow tasks of direct reports"
  on "hr"."employee_workflow_tasks"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM (hr.employee_workflows ew
     JOIN hr.employee_records er ON ((ew.employee_id = er.id)))
  WHERE ((ew.id = employee_workflow_tasks.employee_workflow_id) AND (er.manager_id = auth.uid())))));



  create policy "Hiring Managers can view workflow tasks of direct reports"
  on "hr"."employee_workflow_tasks"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (hr.employee_workflows ew
     JOIN hr.employee_records er ON ((ew.employee_id = er.id)))
  WHERE ((ew.id = employee_workflow_tasks.employee_workflow_id) AND (er.manager_id = auth.uid())))));



  create policy "Admins have full access to employee_workflows"
  on "hr"."employee_workflows"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Hiring Managers can view workflows of direct reports"
  on "hr"."employee_workflows"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM hr.employee_records er
  WHERE ((er.id = employee_workflows.employee_id) AND (er.manager_id = auth.uid())))));



  create policy "Admins have full access to workflow_template_tasks"
  on "hr"."workflow_template_tasks"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Everyone can read workflow_template_tasks"
  on "hr"."workflow_template_tasks"
  as permissive
  for select
  to public
using (true);



  create policy "Admins have full access to workflow_templates"
  on "hr"."workflow_templates"
  as permissive
  for all
  to public
using (public.is_admin());



  create policy "Everyone can read workflow_templates"
  on "hr"."workflow_templates"
  as permissive
  for select
  to public
using (true);



  create policy "Tenant History Read"
  on "public"."application_history"
  as permissive
  for select
  to authenticated
using ((tenant_id = public.current_tenant_id()));



  create policy "Users can insert history"
  on "public"."application_history"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can read history"
  on "public"."application_history"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can insert application scores"
  on "public"."application_scores"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can read application scores"
  on "public"."application_scores"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Allow all for authenticated users on applications"
  on "public"."applications"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated users can do everything on applications"
  on "public"."applications"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "Tenant Applications Delete"
  on "public"."applications"
  as permissive
  for delete
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'applications'::text, 'delete'::text)));



  create policy "Tenant Applications Insert"
  on "public"."applications"
  as permissive
  for insert
  to authenticated
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'applications'::text, 'insert'::text)));



  create policy "Tenant Applications Read"
  on "public"."applications"
  as permissive
  for select
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'applications'::text, 'read'::text)));



  create policy "Tenant Applications Update"
  on "public"."applications"
  as permissive
  for update
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'applications'::text, 'update'::text)))
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'applications'::text, 'update'::text)));



  create policy "Allow authenticated insert on audit_ledger"
  on "public"."audit_ledger"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Allow authenticated select on audit_ledger"
  on "public"."audit_ledger"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Allow all for authenticated users on candidates"
  on "public"."candidates"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated users can do everything on candidates"
  on "public"."candidates"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "Tenant Candidates Delete"
  on "public"."candidates"
  as permissive
  for delete
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'candidates'::text, 'delete'::text)));



  create policy "Tenant Candidates Insert"
  on "public"."candidates"
  as permissive
  for insert
  to authenticated
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'candidates'::text, 'insert'::text)));



  create policy "Tenant Candidates Read"
  on "public"."candidates"
  as permissive
  for select
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'candidates'::text, 'read'::text)));



  create policy "Tenant Candidates Update"
  on "public"."candidates"
  as permissive
  for update
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'candidates'::text, 'update'::text)))
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'candidates'::text, 'update'::text)));



  create policy "cv_sources_insert_authenticated"
  on "public"."cv_sources"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "cv_sources_select_authenticated"
  on "public"."cv_sources"
  as permissive
  for select
  to authenticated
using (true);



  create policy "cv_sources_update_authenticated"
  on "public"."cv_sources"
  as permissive
  for update
  to authenticated
using (true);



  create policy "Authenticated users can delete departments"
  on "public"."departments"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Authenticated users can insert departments"
  on "public"."departments"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read departments"
  on "public"."departments"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update departments"
  on "public"."departments"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Anyone can read rounds"
  on "public"."interview_rounds"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users insert/update interviews"
  on "public"."interviews"
  as permissive
  for all
  to authenticated
using (true);



  create policy "Users read all interviews"
  on "public"."interviews"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can delete job descriptions"
  on "public"."job_descriptions"
  as permissive
  for delete
  to authenticated
using (true);



  create policy "Authenticated users can insert job descriptions"
  on "public"."job_descriptions"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Authenticated users can read job descriptions"
  on "public"."job_descriptions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Authenticated users can update job descriptions"
  on "public"."job_descriptions"
  as permissive
  for update
  to authenticated
using (true)
with check (true);



  create policy "Allow all for authenticated users"
  on "public"."notes"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Admins can update any profile"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((( SELECT profiles_1.role
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid())) = 'Admin'::text));



  create policy "Authenticated users can view profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Tenant Profiles Read"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((tenant_id = public.current_tenant_id()));



  create policy "Tenant Profiles Update"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((tenant_id = public.current_tenant_id()))
with check ((tenant_id = public.current_tenant_id()));



  create policy "Users can update own name"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((id = auth.uid()))
with check ((role = ( SELECT profiles_1.role
   FROM public.profiles profiles_1
  WHERE (profiles_1.id = auth.uid()))));



  create policy "Allow all for authenticated users on roles"
  on "public"."roles"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Authenticated users can do everything on roles"
  on "public"."roles"
  as permissive
  for all
  to public
using ((auth.role() = 'authenticated'::text))
with check ((auth.role() = 'authenticated'::text));



  create policy "Public open roles read"
  on "public"."roles"
  as permissive
  for select
  to anon
using ((status = 'Open'::text));



  create policy "Tenant Roles Delete"
  on "public"."roles"
  as permissive
  for delete
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'roles'::text, 'delete'::text)));



  create policy "Tenant Roles Insert"
  on "public"."roles"
  as permissive
  for insert
  to authenticated
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'roles'::text, 'insert'::text)));



  create policy "Tenant Roles Read"
  on "public"."roles"
  as permissive
  for select
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'roles'::text, 'read'::text)));



  create policy "Tenant Roles Update"
  on "public"."roles"
  as permissive
  for update
  to authenticated
using (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'roles'::text, 'update'::text)))
with check (((tenant_id = public.current_tenant_id()) AND rbac.has_permission(auth.uid(), 'roles'::text, 'update'::text)));



  create policy "Users can insert screening questions"
  on "public"."screening_questions"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Users can read screening questions"
  on "public"."screening_questions"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Public tenant slug lookup"
  on "public"."tenants"
  as permissive
  for select
  to anon
using (true);



  create policy "Users manage own integrations"
  on "public"."user_integrations"
  as permissive
  for all
  to authenticated
using ((user_id = auth.uid()));


CREATE TRIGGER applications_stage_change BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_stage_timestamp();

CREATE TRIGGER applications_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_hire_metadata BEFORE UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_hire_metadata();

CREATE TRIGGER trg_hired_to_onboarding AFTER UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_hired_candidate();

CREATE TRIGGER trg_log_stage_change AFTER UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.log_application_stage_change();

CREATE TRIGGER trg_rejection_metadata BEFORE UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.handle_rejection_metadata();

CREATE TRIGGER trigger_enforce_interview_scheduled BEFORE UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.enforce_interview_scheduled_stage();

CREATE TRIGGER trigger_log_app_stage AFTER INSERT OR UPDATE OF stage ON public.applications FOR EACH ROW EXECUTE FUNCTION public.log_application_stage_change();

CREATE TRIGGER candidates_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_cv_versioning AFTER INSERT ON public.cv_sources FOR EACH ROW EXECUTE FUNCTION public.deactivate_old_cv_versions();

CREATE TRIGGER trigger_interviews_updated_at BEFORE UPDATE ON public.interviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_jd_updated_at BEFORE UPDATE ON public.job_descriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trigger_sync_profile_to_auth AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_auth();

CREATE TRIGGER roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_user_integrations_updated_at BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Anyone can view resumes"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'resumes'::text));



  create policy "Authenticated users can delete resumes"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can update resumes"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "Authenticated users can upload resumes"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'resumes'::text) AND (auth.role() = 'authenticated'::text)));



  create policy "cvs_delete_authenticated 24bk_0"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using ((bucket_id = 'cvs'::text));



  create policy "cvs_delete_authenticated 24bk_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'cvs'::text));



  create policy "cvs_insert_authenticated 24bk_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'cvs'::text));



  create policy "cvs_select_authenticated 24bk_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'cvs'::text));



  create policy "cvs_update_authenticated 24bk_0"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using ((bucket_id = 'cvs'::text));



  create policy "cvs_update_authenticated 24bk_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'cvs'::text));



