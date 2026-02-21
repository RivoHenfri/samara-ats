/**
 * AI Screening Question Generator
 * Uses Claude Sonnet to generate tailored interview questions from the
 * application's role requirements and candidate profile.
 */

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY

// Increment this when the prompt template changes to track quality versions.
export const PROMPT_VERSION = 'v1'

// ── Risk detection ────────────────────────────────────────────────────────────

function detectRisks(candidate, role) {
  const risks = []

  // Large salary jump (> 30% increase)
  const curr = parseInt(candidate.current_salary)
  const exp  = parseInt(candidate.expected_salary)
  if (curr > 0 && exp > 0) {
    const pct = Math.round(((exp - curr) / curr) * 100)
    if (pct > 30) {
      risks.push(
        `High salary increase requested: ${pct}% jump ` +
        `(Rp ${curr.toLocaleString('id-ID')} → Rp ${exp.toLocaleString('id-ID')} IDR/month)`
      )
    }
  }

  // International/expat candidate — relocation & visa considerations
  if (candidate.origin === 'International') {
    risks.push(
      'International candidate: verify relocation readiness, work permit eligibility, ' +
      'and commitment to long-term placement in Lombok'
    )
  } else if (candidate.origin === 'Indonesian Expat') {
    risks.push(
      'Candidate is an Indonesian expat: confirm willingness to relocate to Lombok ' +
      'and familiarity with local market conditions'
    )
  }

  // No CV on file
  if (!candidate.cv_link) {
    risks.push(
      'No CV link provided: limited background information available — ' +
      'probe for detailed employment history and verifiable credentials'
    )
  }

  return risks
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(app) {
  const candidate = app.candidates
  const role      = app.roles

  const salaryLine = (() => {
    const curr = candidate.current_salary
    const exp  = candidate.expected_salary
    if (curr && exp)
      return `Current Rp ${parseInt(curr).toLocaleString('id-ID')}/mo → Expected Rp ${parseInt(exp).toLocaleString('id-ID')}/mo`
    if (exp)
      return `Expected Rp ${parseInt(exp).toLocaleString('id-ID')}/mo (current not disclosed)`
    return 'Not provided'
  })()

  const risks      = detectRisks(candidate, role)
  const riskSection = risks.length > 0
    ? `\nIDENTIFIED RISK AREAS — generate at least one probing question per risk:\n` +
      risks.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
    : '\nNo specific risk areas flagged. Generate one general verification question.'

  return `You are a senior HR screening specialist for Samara Lombok, a premium hospitality, construction, and operations company in Lombok, Indonesia.

Analyze this job application and produce targeted, high-signal interview questions tailored to both the role and this specific candidate.

ROLE:
  Title:      ${role.title}
  Department: ${role.department}
  Priority:   ${role.priority}

CANDIDATE:
  Name:    ${candidate.full_name}
  Origin:  ${candidate.origin}
  Salary:  ${salaryLine}
  Stage:   ${app.stage}
${riskSection}

Return ONLY a valid JSON object — no explanation, no markdown fences — matching this exact structure:
{
  "technical": [
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." }
  ],
  "behavioral": [
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." }
  ],
  "situational": [
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." },
    { "question": "...", "rationale": "...", "follow_up": "..." }
  ],
  "risk_probes": [
    { "risk": "brief risk label", "question": "...", "follow_up": "..." }
  ]
}

Rules:
- technical:   domain-specific skills and tools required for ${role.title} in ${role.department}
- behavioral:  STAR-format past-experience questions predicting future performance
- situational: realistic hypothetical scenarios set in the Lombok hospitality/operations context
- risk_probes: directly address each identified risk area above; one entry per risk
- rationale:   one sentence explaining what insight each question reveals for this role/candidate
- All questions must be professional, non-discriminatory, and legally appropriate`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate AI screening questions for a candidate+role application.
 * Returns the parsed JSONB object to store in screening_questions.questions.
 *
 * @param {object} app  - Full application record with app.candidates and app.roles joined
 * @returns {Promise<object>} questions JSONB
 */
export async function generateScreeningQuestions(app) {
  if (!ANTHROPIC_KEY) {
    throw new Error('VITE_ANTHROPIC_KEY is not configured. Add it to your .env file.')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: buildPrompt(app) }],
    }),
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'Claude API error')
  if (!data.content?.[0]?.text) throw new Error('Empty response from Claude')

  const raw = data.content[0].text.trim().replace(/^```json\n?|```$/g, '').trim()
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Could not parse generated questions. Try regenerating.')
  }
}

/**
 * Returns the detected risk labels for a given application (for display only).
 * Uses the same logic as the prompt builder so UI matches what AI received.
 */
export function getApplicationRisks(app) {
  return detectRisks(app.candidates, app.roles)
}
