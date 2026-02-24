# Pipeline + Onboarding Architecture Recommendation

## Goals

1. Isolate terminal outcomes (`Rejected`, `Hired`) from active pipeline flow for cleaner recruiter operations.
2. Preserve auditability and analytics continuity as candidates move through lifecycle stages.
3. Enable a future onboarding module without duplicating candidate/application data.

## Current-state Constraints to Preserve

- Existing stage system includes both active and terminal states in one enum/check constraint.
- Velocity and stagnation logic already treat `Hired` and `Rejected` as terminal and exclude them from active-stage health checks.
- An immutable `application_history` trigger-based ledger already captures stage transitions.

These are good foundations; the redesign should build on them rather than replace them.

---

## Recommended Target Architecture

## 1) Split pipeline semantics into **Lifecycle State** + **Workspace View**

Instead of one overloaded `stage`, model two concepts:

- `lifecycle_state` (system truth):
  - `active`, `hired`, `rejected`, `withdrawn`, etc.
- `pipeline_stage` (active workflow only):
  - `New`, `Screening`, `Interview Pending`, `Interview Scheduled`, `Interview Completed`, `Offer`

### Why

- Recruiters stop dragging cards across terminal columns inside the same board.
- Analytics become cleaner: active velocity is always computed on active stages only.
- Future states (e.g., `Onboarding`, `No Show`, `Offer Declined`) can be introduced without exploding board complexity.

### DB Pattern

- Keep `applications` as source of truth.
- Add nullable `closed_reason`, `closed_at`, `closed_by`.
- Enforce rule: if `lifecycle_state != 'active'`, then `pipeline_stage` is frozen (or nullable).

---

## 2) Introduce Dedicated Outcome Records

Create outcome detail tables to avoid stuffing JSON into one field:

- `application_rejections`
  - `application_id`, `reason_code`, `reason_notes`, `rejected_at`, `rejected_by`
- `application_hires`
  - `application_id`, `offer_id`, `accepted_at`, `start_date`, `location`, `employment_type`

### Why

- Rich reporting by rejection reasons and hire cohorts.
- Cleaner integration contracts with BI/payroll/HRIS.
- Easier policy enforcement and permissions (sensitive hiring data).

---

## 3) Add Onboarding as a Separate Bounded Context

Create an `onboarding` module that references hires, not raw applications:

- `onboarding_profiles`
  - FK to `application_hires` (or directly to candidate + hire event)
- `onboarding_tasks`
  - templated checklists (documents, training, payroll setup, equipment)
- `onboarding_task_events`
  - immutable event log for status changes

### Design Principle

- ATS decides *who got hired*.
- Onboarding decides *how we operationalize day-0 to day-30*.
- Keep module boundaries explicit, connected via IDs/events.

---

## 4) Event + Audit Strategy

Keep the existing immutable `application_history` and extend with standardized event taxonomy:

- `APPLICATION_STAGE_MOVED`
- `APPLICATION_REJECTED`
- `APPLICATION_HIRED`
- `ONBOARDING_STARTED`
- `ONBOARDING_TASK_COMPLETED`

Also add:

- `correlation_id` for multi-step automations.
- `actor_type` (`user`, `system`, `integration`) for clearer compliance trails.

This will let you rebuild timelines across ATS + onboarding without joining brittle ad-hoc notes.

---

## 5) Recruiter Workflow UX

### Active Board

- Show only active stages.
- Add quick actions from each card:
  - **Reject** (requires reason)
  - **Mark Hired** (requires accepted offer metadata)

### Outcome Queues

Create separate views:

- **Rejected Queue**
  - grouped by reason and date
  - reopen action with guardrails
- **Hired Queue**
  - “Start onboarding” CTA
  - onboarding progress badge

### Hand-off Pattern

When hire is confirmed:

1. Write `application_hires` record.
2. Emit `APPLICATION_HIRED` event.
3. Auto-create `onboarding_profile` from template.
4. Notify assignees (HR, hiring manager).

---

## 6) Scalability and Performance

## Storage/indexing

- Keep narrow transactional tables (`applications`, outcomes, onboarding tasks).
- Index by `updated_at`, `lifecycle_state`, and common queue filters (`reason_code`, `start_date`, `assignee_id`).
- Partition event/audit tables by month once volume grows.

## Read models

- Build materialized views for dashboards:
  - stage aging
  - rejection reason trend
  - hire-to-onboarding-start SLA
- Refresh asynchronously (e.g., every few minutes) instead of heavy live joins.

## Automation

- Use idempotent background jobs for onboarding creation and reminders.
- Track retries and dead-letter failures so recruiter UI stays responsive.

---

## 7) Suggested Migration Plan (Low Risk)

1. **Phase 1 (Schema extension):** add `lifecycle_state` and outcome tables; backfill from existing terminal stages.
2. **Phase 2 (Dual-write):** UI still uses old stage, backend writes both old + new fields.
3. **Phase 3 (UI split):** launch Active Board + Rejected Queue + Hired Queue.
4. **Phase 4 (Onboarding MVP):** create onboarding profile + checklist from hired records.
5. **Phase 5 (Cutover):** deprecate terminal stages in active board logic.

---

## 8) KPI Framework to Validate the New Design

Track these metrics before/after rollout:

- Time-in-stage (active stages only)
- Rejection reason distribution and reversal rate
- Offer acceptance → onboarding start lag
- Onboarding completion rate by day 7/14/30
- Recruiter actions per candidate (workflow friction indicator)

---

## Practical Notes for This Codebase

Given your current implementation:

- Keep existing stage constants for now, but create `ACTIVE_STAGES` as the only source for board rendering.
- Keep trigger-driven audit logging and extend metadata/events instead of shifting audit responsibility to frontend.
- Preserve current stagnation and velocity logic assumptions that terminal states are excluded; these map naturally to the proposed `lifecycle_state` split.

