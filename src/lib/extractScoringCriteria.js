/**
 * Step 4: Scoring Criteria Extraction
 *
 * Takes the structured JD + original free-text job context and extracts
 * structured must-have / nice-to-have criteria for the scoring engine.
 *
 * AUGMENT MODE: The extracted structured criteria are used as a baseline
 * checklist, while the free-text job_context is preserved for Claude to
 * scan for harder-to-define traits (remote resilience, behavioral
 * competencies, cultural fit indicators).
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v1'
export const MODEL_VERSION = 'claude-sonnet-4-6'

function buildPrompt(structuredJD, jobContext) {
  return `You are a recruitment scoring architect. Analyze the following job description and extract structured scoring criteria.

STRUCTURED JD:
${JSON.stringify(structuredJD, null, 2)}

RECRUITER FREE-TEXT NOTES (scan these for behavioral traits, cultural fit indicators, and non-obvious requirements that aren't in the structured JD):
${jobContext?.trim() || 'No additional notes.'}

YOUR TASK:
1. Extract all MUST-HAVE criteria (non-negotiable — if a candidate lacks ANY of these, they should score ≤ 40 on must_have_score)
2. Extract all NICE-TO-HAVE criteria (preferred but not disqualifying if absent)
3. For each criterion, classify its type and set a threshold

CLASSIFICATION TYPES:
- "skill" — a specific technical or soft skill (e.g., "PMS software proficiency", "crisis management")
- "experience" — years or type of experience (e.g., "3+ years F&B management")
- "education" — degree or formal training (e.g., "Diploma in Hospitality Management")
- "certification" — professional certification (e.g., "Food Safety Certificate")
- "behavioral" — behavioral competency or cultural trait (e.g., "remote resilience", "resourcefulness under constraint")

IMPORTANT:
- Include at least 1–2 "behavioral" type criteria in must_haves (remote resilience, adaptability, pioneer mentality)
- Extract criteria from BOTH the structured JD AND the free-text notes
- Thresholds should be specific and measurable where possible
- Do NOT be generic — every criterion should feel specific to THIS role at Samara

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "must_have_criteria": [
    {
      "criterion": "<specific requirement>",
      "type": "skill|experience|education|certification|behavioral",
      "threshold": "<measurable threshold, e.g. '3+ years', 'Proficient', 'Required', 'Demonstrated track record'>"
    }
  ],
  "nice_to_have_criteria": [
    {
      "criterion": "<preferred requirement>",
      "type": "skill|experience|education|certification|behavioral",
      "threshold": "<threshold>"
    }
  ],
  "default_weights": {
    "must_have": 0.55,
    "nice_to_have": 0.25,
    "salary_alignment": 0.20
  }
}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Extract structured scoring criteria from a JD + free-text context.
 *
 * @param {object} structuredJD  The structured JD from Step 1
 * @param {string} jobContext    Original free-text job context from the recruiter
 * @returns {Promise<object>}    { must_have_criteria, nice_to_have_criteria, default_weights }
 */
export async function extractScoringCriteria(structuredJD, jobContext) {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: {
      model: MODEL_VERSION,
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(structuredJD, jobContext) }],
    },
  })

  if (error) throw new Error(error.message || 'Claude proxy error')
  if (data?.error) throw new Error(data.error.message || 'Claude API error')
  if (!data?.content?.[0]?.text) throw new Error('Empty response from Claude')

  let raw = data.content[0].text.trim()
  // Strip markdown fences
  raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
  // Extract outermost JSON object
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) raw = jsonMatch[0]

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Could not parse scoring criteria response. Try regenerating.')
  }

  // Validate structure
  if (!Array.isArray(parsed.must_have_criteria) || !Array.isArray(parsed.nice_to_have_criteria)) {
    throw new Error('Scoring criteria missing must_have or nice_to_have arrays.')
  }

  // Ensure default_weights exist
  if (!parsed.default_weights) {
    parsed.default_weights = { must_have: 0.55, nice_to_have: 0.25, salary_alignment: 0.20 }
  }

  return parsed
}
