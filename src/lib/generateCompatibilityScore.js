/**
 * AI Compatibility Score Generator — v1
 * Uses Claude Sonnet to produce a structured compatibility evaluation of a
 * candidate against a role's requirements.
 *
 * Output dimensions:
 *   overall_score          0–100  Weighted composite
 *   must_have_score        0–100  Non-negotiable requirements match
 *   nice_to_have_score     0–100  Preferred requirements match
 *   salary_alignment_score 0–100  Expected salary vs role budget/range
 *   risk_flags             Array  { flag, detail, severity: low|medium|high }
 *   executive_summary      String 3–5 lines, recruiter-ready
 *   interview_focus        Array  Strings — specific areas to probe
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v1'
export const MODEL_VERSION = 'claude-sonnet-4-6'

// ── Score helpers (shared with UI) ────────────────────────────────────────────

/**
 * Returns the CSS color variable string for a given score.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreColor(score) {
  if (score == null) return 'var(--stone)'
  if (score >= 80) return 'var(--teal)'
  if (score >= 60) return 'var(--gold)'
  return 'var(--alert)'
}

/**
 * Returns the background color variable string for a given score.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreBg(score) {
  if (score == null) return 'var(--sand)'
  if (score >= 80) return 'var(--teal-bg)'
  if (score >= 60) return 'var(--gold-bg)'
  return 'var(--alert-bg)'
}

/**
 * Returns the human label for a score range.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreLabel(score) {
  if (score == null) return 'Not Scored'
  if (score >= 80) return 'High Match'
  if (score >= 60) return 'Moderate'
  return 'Low Match'
}

/**
 * Returns severity color for a risk flag.
 * @param {'high'|'medium'|'low'} severity
 * @returns {string}
 */
export function getSeverityColor(severity) {
  if (severity === 'high') return 'var(--alert)'
  if (severity === 'medium') return 'var(--gold)'
  return 'var(--stone)'
}

export function getSeverityBg(severity) {
  if (severity === 'high') return 'var(--alert-bg)'
  if (severity === 'medium') return 'var(--gold-bg)'
  return 'var(--sand)'
}

export async function generateCompatibilityScore(applicationId) {
  // Client-Side Eviction: Scoring logic moved to backend Edge Function
  // We simply set the status back to pending, which triggers the Database Webhook
  const { error } = await supabase
    .from('applications')
    .update({ scoring_status: 'pending', scoring_error: null })
    .eq('id', applicationId)

  if (error) {
    throw new Error('Failed to trigger background scoring: ' + error.message)
  }

  // Return a dummy object to satisfy any synchronous UI expectations
  // The real score will stream in via Supabase Realtime subscriptions 
  return {
    async_trigger: true
  }
}
