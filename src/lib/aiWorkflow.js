/**
 * AI Workflow Orchestrator
 *
 * Handles automatic, event-driven AI triggers embedded in the recruitment
 * pipeline. All functions are fire-and-forget — they run in the background
 * and fail silently so they never block or break the recruiter's UI.
 *
 * Triggers:
 *   autoScore(applicationId)            → fired when candidate → Screening
 *   autoGenerateQuestions(applicationId) → fired when candidate → Interview
 *   autoPreparePrescreen(applicationId) → fired when candidate → Screening
 *                                         (returns form URL for notification modal)
 */

import { supabase } from './supabase'
import {
  generateCompatibilityScore,
  PROMPT_VERSION as SCORE_PROMPT_V,
  MODEL_VERSION as SCORE_MODEL,
} from './generateCompatibilityScore'
import {
  generateScreeningQuestions,
  getApplicationRisks,
  PROMPT_VERSION as SQ_PROMPT_V,
  MODEL_VERSION as SQ_MODEL,
} from './generateScreeningQuestions'

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchFullApp(applicationId) {
  const { data } = await supabase
    .from('applications')
    .select('*, candidates!inner(*), roles!inner(*)')
    .eq('id', applicationId)
    .maybeSingle()
  return data
}

async function fetchScoringCriteria(roleId) {
  const { data } = await supabase
    .from('job_descriptions')
    .select('scoring_criteria')
    .eq('role_id', roleId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.scoring_criteria || null
}

async function fetchParsedCV(candidateId) {
  const { data } = await supabase
    .from('cv_sources')
    .select('parsed_data')
    .eq('candidate_id', candidateId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.parsed_data ?? null
}

// ── Guard: check if score already exists ─────────────────────────────────────

async function hasScore(applicationId) {
  const { count } = await supabase
    .from('application_scores')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId)
  return (count ?? 0) > 0
}

async function hasQuestions(applicationId) {
  const { count } = await supabase
    .from('screening_questions')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId)
  return (count ?? 0) > 0
}

async function hasPrescreen(applicationId) {
  const { count } = await supabase
    .from('prescreening_responses')
    .select('*', { count: 'exact', head: true })
    .eq('application_id', applicationId)
  return (count ?? 0) > 0
}

// ── Auto-score ────────────────────────────────────────────────────────────────

/**
 * Automatically score a candidate when they enter the Screening stage.
 * No-ops silently if a score already exists (avoids re-scoring on every move).
 * Safe to call without awaiting — failures are caught and logged.
 *
 * @param {string} applicationId
 */
export async function autoScore(applicationId) {
  try {
    if (await hasScore(applicationId)) return

    const app = await fetchFullApp(applicationId)
    if (!app) return

    // Trigger the backend Edge Function via database webhook
    await generateCompatibilityScore(applicationId)
  } catch (err) {
    // Auto-scoring is non-fatal — recruiter can manually trigger from the tab
    console.warn('[aiWorkflow] autoScore failed silently:', err?.message)
  }
}

// ── Auto-generate screening questions ─────────────────────────────────────────

/**
 * Automatically generate screening questions when a candidate enters Interview.
 * No-ops silently if questions already exist.
 * Safe to call without awaiting.
 *
 * @param {string} applicationId
 */
export async function autoGenerateQuestions(applicationId) {
  try {
    if (await hasQuestions(applicationId)) return

    const app = await fetchFullApp(applicationId)
    if (!app) return

    const questions = await generateScreeningQuestions(app)
    const risks = getApplicationRisks(app)

    await supabase.from('screening_questions').insert({
      application_id: applicationId,
      questions,
      risk_areas: risks.map(r => ({ label: r })),
      prompt_version: `${SQ_PROMPT_V} · auto`,
      model_version: SQ_MODEL,
      generated_by_name: 'System (Auto)',
    })
  } catch (err) {
    console.warn('[aiWorkflow] autoGenerateQuestions failed silently:', err?.message)
  }
}

// ── Auto-prepare prescreening form ──────────────────────────────────────────

/**
 * Automatically create a prescreening form for a candidate entering Screening.
 * Unlike autoScore/autoGenerateQuestions, this RETURNS data (the form URL)
 * so the caller can show the notification modal.
 *
 * No-ops if a prescreening_response already exists for this application.
 *
 * @param {string} applicationId
 * @returns {Promise<{token: string, formUrl: string} | null>}
 */
export async function autoPreparePrescreen(applicationId) {
  try {
    if (await hasPrescreen(applicationId)) return null

    const app = await fetchFullApp(applicationId)
    if (!app) return null

    // Find active prescreening template for this role
    const { data: template } = await supabase
      .from('prescreening_templates')
      .select('*')
      .eq('role_id', app.roles.id)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Create prescreening_response record (token auto-generated by DB default)
    const { data: response, error } = await supabase
      .from('prescreening_responses')
      .insert({
        application_id: applicationId,
        template_id: template?.id || null,
        template_snapshot: template ? {
          fixed_fields: template.fixed_fields,
          custom_questions: template.custom_questions,
        } : null,
        status: 'pending',
      })
      .select('access_token')
      .single()

    if (error || !response) {
      console.warn('[aiWorkflow] autoPreparePrescreen insert failed:', error?.message)
      return null
    }

    const formUrl = `${window.location.origin}/prescreening/${response.access_token}`
    return { token: response.access_token, formUrl }
  } catch (err) {
    console.warn('[aiWorkflow] autoPreparePrescreen failed silently:', err?.message)
    return null
  }
}
