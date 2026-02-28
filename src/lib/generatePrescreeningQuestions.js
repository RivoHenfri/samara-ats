/**
 * generatePrescreeningQuestions.js
 *
 * AI-powered prescreening question generation.
 * Suggests role-specific technical and case-study questions based on
 * job context and scoring criteria, for use in the prescreening form.
 *
 * Uses claude-proxy Edge Function (same pattern as CV parsing).
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'prescreen-v1'
export const MODEL_VERSION = 'claude-sonnet-4-6-20250514'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

/**
 * Suggest prescreening questions for a role using AI.
 *
 * @param {object} role - Role object with title, department, job_context
 * @param {object|null} scoringCriteria - From job_descriptions.scoring_criteria
 * @param {Array} existingQuestions - Already-added custom questions (to avoid duplicates)
 * @returns {Promise<Array<{question: string, type: string, required: boolean, rationale: string, source: string}>>}
 */
export async function suggestPrescreeningQuestions(role, scoringCriteria, existingQuestions = []) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const existingList = existingQuestions.map(q => q.question).join('\n- ')

  const prompt = `You are an expert recruiter designing a prescreening questionnaire for candidates applying to the role of "${role.title}" in the ${role.department} department at Samara Lombok, a luxury hospitality development.

${role.job_context ? `## Role Context\n${role.job_context}\n` : ''}
${scoringCriteria ? `## Scoring Criteria\n${JSON.stringify(scoringCriteria, null, 2)}\n` : ''}
${existingList ? `## Already Added Questions (DO NOT duplicate these)\n- ${existingList}\n` : ''}

Generate 3-5 prescreening questions that:
1. Test practical, role-specific technical knowledge or problem-solving
2. Can be answered in writing (not requiring live demonstration)
3. Help differentiate strong candidates from average ones
4. Are concise but require thoughtful answers (not yes/no)
5. Mix question types: some short-answer, some scenario-based

For each question, specify:
- question: the question text
- type: "textarea" for scenario/case-study questions, "text" for short-answer
- required: true for must-answer questions, false for bonus questions
- rationale: brief explanation of what this question reveals about the candidate

Return ONLY a valid JSON array. No markdown fences, no explanation.

Example format:
[
  {
    "question": "Describe how you would handle a VIP guest complaint about room service delays during peak season.",
    "type": "textarea",
    "required": true,
    "rationale": "Tests service recovery skills and ability to handle pressure in luxury hospitality."
  }
]`

  const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      model: MODEL_VERSION,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Claude proxy returned ${res.status}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text || ''

  // Parse JSON from response (strip markdown fences if present)
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const questions = JSON.parse(cleaned)

  if (!Array.isArray(questions)) throw new Error('AI response is not an array')

  // Tag each question with source: 'ai'
  return questions.map(q => ({
    question: q.question || '',
    type: q.type || 'textarea',
    required: q.required ?? true,
    rationale: q.rationale || '',
    source: 'ai',
  }))
}
