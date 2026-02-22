/**
 * Step 1: AI Job Description Generator
 *
 * Takes minimal recruiter input (title, department, context, location,
 * work arrangement) and produces a fully structured job description.
 *
 * Cultural DNA: "Rascal DNA + Hyatt Standards"
 *   → Pioneer Spirit (remote resilience, supply-chain adaptability, resourcefulness)
 *   → Process Compliance (international luxury standards, SOPs, brand discipline)
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v1'
export const MODEL_VERSION = 'claude-sonnet-4-6'

// ── System prompt — Samara identity hardcoded ─────────────────────────────────

const SYSTEM_PROMPT = `You are the Head of Talent at Samara Lombok — a premium hospitality, construction, and operations company based on the island of Lombok, Indonesia.

SAMARA CULTURAL DNA — "RASCAL DNA + HYATT STANDARDS"

You must write every job description to attract candidates who embody TWO forces simultaneously:

1. PIONEER SPIRIT ("Rascal DNA"):
   - Lombok is NOT Bali, NOT Jakarta. It is a developing island with limited infrastructure, unreliable supply chains, and island logistics (ferries, limited flights, monsoon disruptions).
   - Candidates MUST have extreme remote resilience. They will face power outages, delayed shipments, equipment breakdowns, and limited access to specialists.
   - Self-sufficiency is non-negotiable. The right person builds from nothing, improvises when systems fail, and thrives in ambiguity.
   - Resourcefulness over credentials. A track record of operating in constrained environments matters more than a polished CV from a 5-star city hotel.
   - Ask yourself for every requirement: "Will this person survive Month 3 on the island, or will they break when the AC goes down and the repair technician is on the next ferry?"

2. PROCESS COMPLIANCE ("Hyatt Standards"):
   - Despite the frontier environment, Samara operates at international luxury standards.
   - Rigorous SOPs, brand standards, and operational discipline are expected.
   - Quality control and guest experience consistency must be maintained WITHOUT the corporate infrastructure that normally enables it.
   - The candidate must deliver world-class service while also being able to fix the plumbing if needed.

ANTI-FILTER:
   - Do NOT write JDs that would appeal to comfortable city-based luxury hoteliers who expect established corporate systems, reliable vendors, and predictable environments.
   - Those candidates WILL FAIL within 90 days.
   - Every JD must include at least one explicit requirement about remote/island resilience, supply-chain adaptability, or frontier resourcefulness.

TONE:
   - Direct, energetic, honest about the challenges.
   - Not corporate fluff. Not startup-bro. Not generic hospitality-speak.
   - "We build beautiful things in hard places" — that's the vibe.`

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt({ title, department, jobContext, location, workArrangement }) {
  return `Generate a complete, structured job description for the following role at Samara.

ROLE INPUT:
  Title:            ${title}
  Department:       ${department}
  Location:         ${location || 'Lombok, Indonesia'}
  Work Arrangement: ${workArrangement || 'Onsite'}

RECRUITER CONTEXT (strategic notes — use these to inform tone, seniority, and specific requirements):
${jobContext?.trim() || 'No additional context provided. Infer from the role title and department.'}

OUTPUT RULES:
- Return ONLY a valid JSON object — no markdown fences, no explanation.
- Every responsibility and qualification must be contextualized to Samara's environment, not generic.
- Include at least 2 skills categorized as 'soft' that relate to remote resilience, adaptability, or resourcefulness.
- The role_summary must mention the Lombok/island context and what makes this role unique vs the same title at a city hotel or office.

Return this exact JSON structure:
{
  "role_summary": "<3–5 sentences. What this role does, why it matters at Samara, what makes it different from the same title elsewhere>",
  "key_responsibilities": [
    "<specific, actionable responsibility 1>",
    "<6–10 items total>"
  ],
  "required_qualifications": [
    "<non-negotiable qualification>"
  ],
  "preferred_qualifications": [
    "<nice-to-have qualification>"
  ],
  "required_skills": [
    { "skill": "<skill name>", "category": "technical" },
    { "skill": "<skill name>", "category": "soft" }
  ],
  "experience_level": "<e.g. 3–5 years in similar role, or Senior level>",
  "reporting_structure": "<who this role reports to and who reports to them, inferred from context>",
  "work_arrangement": "${workArrangement || 'Onsite'}",
  "compensation_placeholder": "<suggested range format, e.g. 'Competitive, commensurate with experience. Housing support available.' or leave as 'To be discussed'>"
}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a structured job description from minimal recruiter input.
 *
 * @param {object} input  { title, department, jobContext, location, workArrangement }
 * @returns {Promise<object>}  Structured JD object
 */
export async function generateJobDescription(input) {
  const { data, error } = await supabase.functions.invoke('claude-proxy', {
    body: {
      model: MODEL_VERSION,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildPrompt(input) }],
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
    throw new Error('Could not parse JD response. Try regenerating.')
  }

  // Validate required fields
  const requiredKeys = ['role_summary', 'key_responsibilities', 'required_qualifications', 'required_skills']
  for (const key of requiredKeys) {
    if (!parsed[key]) {
      throw new Error(`Generated JD is missing "${key}". Try regenerating.`)
    }
  }

  return parsed
}
