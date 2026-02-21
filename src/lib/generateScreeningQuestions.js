/**
 * AI Screening Question Generator — v2
 * Uses Claude Sonnet to generate tailored interview questions from the
 * role's job_context (if set) and the candidate's profile.
 *
 * v2 changes vs v1:
 *  - Uses job_context for role-specific, non-generic questions
 *  - Adds scorecard criteria linked to job requirements
 *  - Replaces generic situational questions with gap-probing questions
 *  - Must-have vs nice-to-have prioritisation in scorecard
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v2'
export const MODEL_VERSION = 'claude-sonnet-4-6'

// ── Risk detection ────────────────────────────────────────────────────────────

function detectRisks(candidate, role) {
  const risks = []

  // Large salary jump (> 30%)
  const curr = parseInt(candidate.current_salary)
  const exp = parseInt(candidate.expected_salary)
  if (curr > 0 && exp > 0) {
    const pct = Math.round(((exp - curr) / curr) * 100)
    if (pct > 30) {
      risks.push(
        `High salary increase requested: ${pct}% jump ` +
        `(Rp ${curr.toLocaleString('id-ID')} → Rp ${exp.toLocaleString('id-ID')} IDR/month)`
      )
    }
  }

  // Relocation risk
  if (candidate.origin === 'International') {
    risks.push(
      'International candidate: verify relocation readiness, work permit eligibility, ' +
      'and long-term commitment to Lombok'
    )
  } else if (candidate.origin === 'Indonesian (Non-Lombok)') {
    risks.push(
      'Indonesian (Non-Lombok): confirm willingness to relocate to Lombok and familiarity ' +
      'with local market conditions'
    )
  }

  // No CV on file
  if (!candidate.cv_link) {
    risks.push(
      'No CV provided: probe for detailed employment history and verifiable credentials'
    )
  }

  return risks
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(app) {
  const candidate = app.candidates
  const role = app.roles

  const salaryLine = (() => {
    const curr = candidate.current_salary
    const exp = candidate.expected_salary
    if (curr && exp)
      return `Current Rp ${parseInt(curr).toLocaleString('id-ID')}/mo → Expected Rp ${parseInt(exp).toLocaleString('id-ID')}/mo`
    if (exp)
      return `Expected Rp ${parseInt(exp).toLocaleString('id-ID')}/mo (current undisclosed)`
    return 'Not provided'
  })()

  const risks = detectRisks(candidate, role)
  const riskSection = risks.length > 0
    ? `\nIDENTIFIED RISK AREAS — generate at least one probing question per risk:\n` +
    risks.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
    : '\nNo specific risk areas flagged. Generate one general verification question.'

  const jobContextSection = role.job_context?.trim()
    ? `\nDETAILED JOB REQUIREMENTS (use this as the primary source for all questions):\n${role.job_context.trim()}`
    : `\nNo detailed job context provided — infer requirements from the role title and department.`

  return `You are a senior HR screening specialist for Samara Lombok, a premium hospitality, construction, and operations company in Lombok, Indonesia.

Your job is to produce highly targeted, enterprise-grade interview questions and a scoring scorecard. Avoid generic questions — every question must map directly to a specific competency or gap identified below.

ROLE:
  Title:      ${role.title}
  Department: ${role.department}
  Priority:   ${role.priority}
${jobContextSection}

CANDIDATE:
  Name:    ${candidate.full_name}
  Origin:  ${candidate.origin}
  Salary:  ${salaryLine}
  Stage:   ${app.stage}
${riskSection}

Return ONLY a valid JSON object — no explanation, no markdown — with this exact structure:
{
  "technical": [
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "specific requirement from job context" },
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "..." },
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "..." }
  ],
  "behavioral": [
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "..." },
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "..." },
    { "question": "...", "rationale": "...", "follow_up": "...", "maps_to": "..." }
  ],
  "gap_probes": [
    { "question": "...", "rationale": "...", "follow_up": "...", "gap": "specific gap or non-negotiable being tested" },
    { "question": "...", "rationale": "...", "follow_up": "...", "gap": "..." },
    { "question": "...", "rationale": "...", "follow_up": "...", "gap": "..." }
  ],
  "risk_probes": [
    { "risk": "brief risk label", "question": "...", "follow_up": "..." }
  ],
  "scorecard": [
    { "criterion": "...", "weight": "High", "must_have": true, "what_to_look_for": "observable signal or answer quality" },
    { "criterion": "...", "weight": "Medium", "must_have": false, "what_to_look_for": "..." },
    { "criterion": "...", "weight": "High", "must_have": true, "what_to_look_for": "..." },
    { "criterion": "...", "weight": "Low", "must_have": false, "what_to_look_for": "..." }
  ]
}

Rules:
- technical:   role-specific tools, domain knowledge, and hard skills from the job requirements
- behavioral:  STAR-format questions based on past experience that predict future performance
- gap_probes:  hypothetical or probing questions targeting gaps between the candidate profile and must-have requirements; set in Samara Lombok's operational context
- risk_probes: one question per identified risk area above
- scorecard:   4-6 criteria derived from must-have and nice-to-have requirements; weight = High/Medium/Low; must_have = true only for non-negotiables
- maps_to:     quote or paraphrase the specific requirement this question tests (use "Inferred from role" if no job context)
- rationale:   one sentence on what insight this question surfaces for this specific candidate/role
- All questions must be professional, non-discriminatory, and legally appropriate`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate AI screening questions for a candidate+role application.
 * Returns the parsed JSONB object to store in screening_questions.questions.
 *
 * @param {object} app  Full application record with app.candidates and app.roles joined
 * @returns {Promise<object>} questions JSONB
 */
export async function generateScreeningQuestions(app) {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: {
      model: MODEL_VERSION,
      max_tokens: 3000,
      messages: [{ role: 'user', content: buildPrompt(app) }],
    },
  })

  if (error) throw new Error(error.message || 'Claude proxy error')
  if (data?.error) throw new Error(data.error.message || 'Claude API error')
  if (!data?.content?.[0]?.text) throw new Error('Empty response from Claude')

  const raw = data.content[0].text.trim().replace(/^```json\n?|```$/g, '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Could not parse generated questions. Try regenerating.')
  }
}

/**
 * Returns the detected risk labels for a given application (for display only).
 */
export function getApplicationRisks(app) {
  return detectRisks(app.candidates, app.roles)
}
