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
export const MODEL_VERSION  = 'claude-sonnet-4-6'

// ── Score helpers (shared with UI) ────────────────────────────────────────────

/**
 * Returns the CSS color variable string for a given score.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreColor(score) {
  if (score == null) return 'var(--stone)'
  if (score >= 80)   return 'var(--teal)'
  if (score >= 60)   return 'var(--gold)'
  return 'var(--alert)'
}

/**
 * Returns the background color variable string for a given score.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreBg(score) {
  if (score == null) return 'var(--sand)'
  if (score >= 80)   return 'var(--teal-bg)'
  if (score >= 60)   return 'var(--gold-bg)'
  return 'var(--alert-bg)'
}

/**
 * Returns the human label for a score range.
 * @param {number|null} score
 * @returns {string}
 */
export function getScoreLabel(score) {
  if (score == null) return 'Not Scored'
  if (score >= 80)   return 'High Match'
  if (score >= 60)   return 'Moderate'
  return 'Low Match'
}

/**
 * Returns severity color for a risk flag.
 * @param {'high'|'medium'|'low'} severity
 * @returns {string}
 */
export function getSeverityColor(severity) {
  if (severity === 'high')   return 'var(--alert)'
  if (severity === 'medium') return 'var(--gold)'
  return 'var(--stone)'
}

export function getSeverityBg(severity) {
  if (severity === 'high')   return 'var(--alert-bg)'
  if (severity === 'medium') return 'var(--gold-bg)'
  return 'var(--sand)'
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(app, parsedCV) {
  const candidate = app.candidates
  const role      = app.roles

  // ── Salary section ──
  const curr = parseInt(candidate.current_salary) || 0
  const exp  = parseInt(candidate.expected_salary) || 0
  const salaryPct = (curr > 0 && exp > 0)
    ? Math.round(((exp - curr) / curr) * 100)
    : null

  const salaryLine = (() => {
    if (curr && exp)
      return `Current Rp ${curr.toLocaleString('id-ID')}/mo → Expected Rp ${exp.toLocaleString('id-ID')}/mo` +
             (salaryPct != null ? ` (${salaryPct > 0 ? '+' : ''}${salaryPct}% change)` : '')
    if (exp)
      return `Expected Rp ${exp.toLocaleString('id-ID')}/mo (current undisclosed)`
    return 'Not provided'
  })()

  // ── CV / parsed data section ──
  const cvSection = parsedCV
    ? `
PARSED CV DATA (use this as primary evidence of qualifications):
  Current Role:       ${parsedCV.current_role || 'Unknown'}
  Experience:         ${parsedCV.experience_years != null ? `${parsedCV.experience_years} years` : 'Unknown'}
  Skills:             ${(parsedCV.skills || []).join(', ') || 'Not listed'}
  Avg Tenure:         ${parsedCV.average_tenure_months != null ? `${parsedCV.average_tenure_months} months per role` : 'Unknown'}
  Employment Gaps:    ${(parsedCV.employment_gaps || []).join('; ') || 'None detected'}
  CV Flags:           ${(parsedCV.flags || []).join('; ') || 'None'}
  Education:          ${(parsedCV.education || []).map(e => e.degree ? `${e.degree}${e.institution ? ' @ ' + e.institution : ''}` : e).join('; ') || 'Not listed'}
  Recent Employers:   ${(parsedCV.employment_history || []).slice(0, 3).map(e => e.company || e).join('; ') || 'Not listed'}`
    : `
NO PARSED CV AVAILABLE — evaluate based on profile fields only.
Flag "No CV on file" as a risk when scoring.`

  // ── Job context section ──
  const jobContextSection = role.job_context?.trim()
    ? `
DETAILED JOB REQUIREMENTS (this is your primary scoring rubric — extract must-have vs nice-to-have from this text):
${role.job_context.trim()}`
    : `
NO DETAILED JOB CONTEXT — infer requirements from role title "${role.title}" and department "${role.department}".`

  return `You are a senior talent assessment AI for Samara Lombok, a premium hospitality, construction, and operations company in Lombok, Indonesia.

Your task is to produce a structured compatibility evaluation of the candidate against the role. You must:
1. Parse the job requirements to separate must-have (non-negotiable) from nice-to-have (preferred) criteria
2. Score the candidate on each dimension using concrete evidence from their profile
3. Detect risk signals (salary mismatch, instability, missing credentials, relocation concerns, etc.)
4. Write a 3–5 line executive summary that a recruiter can read in 10 seconds
5. List specific interview focus areas based on gaps and risks

ROLE:
  Title:      ${role.title}
  Department: ${role.department}
  Priority:   ${role.priority}
${jobContextSection}

CANDIDATE:
  Name:       ${candidate.full_name}
  Origin:     ${candidate.origin}
  Salary:     ${salaryLine}
  Stage:      ${app.stage}
${cvSection}

SCORING RULES:
- overall_score: weighted average — must_have_score × 0.55 + nice_to_have_score × 0.25 + salary_alignment_score × 0.20
- must_have_score: 0 if any hard non-negotiable is completely absent; scale 60–100 otherwise
- nice_to_have_score: proportion of preferred criteria evidenced in profile
- salary_alignment_score:
    100 = expected salary is within the stated range or below
    80  = up to 10% above stated range (or range unknown but jump ≤ 15%)
    60  = 10–25% above range or jump
    40  = 25–40% above range or jump
    20  = > 40% above, or salary data entirely missing
- Salary jump > 30% from current is always a MEDIUM risk flag regardless of range
- International origin = HIGH risk flag (visa/relocation)
- Indonesian (Non-Lombok) origin = LOW risk flag (relocation)
- Average tenure < 12 months = MEDIUM risk flag (instability)
- Employment gaps > 6 months = LOW risk flag
- Missing CV = MEDIUM risk flag
- Overqualified by 2+ seniority levels = LOW risk flag

SEVERITY SCALE:
  "high"   — deal-breaker or major concern requiring immediate resolution
  "medium" — significant concern, must be probed in interview
  "low"    — minor flag, worth noting but not disqualifying

Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "overall_score": <integer 0–100>,
  "must_have_score": <integer 0–100>,
  "nice_to_have_score": <integer 0–100>,
  "salary_alignment_score": <integer 0–100>,
  "risk_flags": [
    { "flag": "<short label>", "detail": "<one sentence>", "severity": "high|medium|low" }
  ],
  "executive_summary": "<3–5 sentence recruiter-facing summary covering fit, gaps, and recommendation>",
  "interview_focus": [
    "<specific action: verify / probe / confirm / clarify + what>"
  ]
}

Rules:
- executive_summary: write for a recruiter who has 10 seconds. Start with overall fit, name the top strength, name the top gap, give a clear recommendation.
- interview_focus: 3–5 specific items (not generic). Each must reference an actual gap or risk identified above.
- risk_flags: only include real, evidence-based flags. Empty array if genuinely no risks.
- All scores must be integers between 0 and 100.
- overall_score must equal: round(must_have_score × 0.55 + nice_to_have_score × 0.25 + salary_alignment_score × 0.20)`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an AI compatibility score for a candidate+role application.
 *
 * @param {object} app          Full application record with app.candidates and app.roles joined
 * @param {object|null} parsedCV  Parsed CV data from cv_sources.parsed_data (or null)
 * @returns {Promise<object>}   Score JSONB object to store in application_scores
 */
export async function generateCompatibilityScore(app, parsedCV = null) {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: {
      model:      MODEL_VERSION,
      max_tokens: 1500,
      messages:   [{ role: 'user', content: buildPrompt(app, parsedCV) }],
    },
  })

  if (error) throw new Error(error.message || 'Claude proxy error')
  if (data?.error) throw new Error(data.error.message || 'Claude API error')
  if (!data?.content?.[0]?.text) throw new Error('Empty response from Claude')

  const raw = data.content[0].text.trim().replace(/^```json\n?|```$/g, '').trim()
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Could not parse score response. Try re-scoring.')
  }

  // Enforce overall_score matches the weighting formula (in case Claude drifts)
  if (
    parsed.must_have_score != null &&
    parsed.nice_to_have_score != null &&
    parsed.salary_alignment_score != null
  ) {
    parsed.overall_score = Math.round(
      parsed.must_have_score        * 0.55 +
      parsed.nice_to_have_score     * 0.25 +
      parsed.salary_alignment_score * 0.20
    )
  }

  return parsed
}
