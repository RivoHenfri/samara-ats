/**
 * Step 2: Multi-Channel Job Description Formatter
 *
 * Takes a structured JD (from Step 1) and produces 4 optimized versions:
 *   - Internal Posting: concise, bullet-format, clear requirements
 *   - WhatsApp Outreach: 5–8 line short-form with CTA
 *   - LinkedIn Post: engaging hook, branded tone, hashtags
 *   - Job Board: SEO-optimized, structured headings, clean formatting
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v1'
export const MODEL_VERSION = 'claude-sonnet-4-6'

function buildPrompt(structuredJD, roleTitle, department) {
    const jdText = JSON.stringify(structuredJD, null, 2)

    return `You are formatting a job description for Samara Lombok into 4 distribution channels.

SOURCE JD (structured):
${jdText}

ROLE: ${roleTitle} — ${department}

Generate ALL FOUR versions below. Return ONLY a valid JSON object — no markdown fences, no explanation.

FORMATTING RULES PER CHANNEL:

1. INTERNAL POSTING (formatted_internal):
   - Concise, structured bullet format
   - Focus on clarity: what the role does, what's required, what's preferred
   - Include an "Internal Notes" section with: reporting line, priority level, key traits to screen for
   - Professional but direct — this is for internal recruiters, not candidates
   - Plain text with line breaks (no markdown)

2. WHATSAPP OUTREACH (formatted_whatsapp):
   - Maximum 5–8 lines total (WhatsApp messages get ignored if too long)
   - Opening line: clear value proposition ("We're hiring a [title] to [one-line impact]")
   - 3–4 key highlights only (salary hint if appropriate, location, unique perks)
   - End with a direct CTA: "Interested? Send your CV to [placeholder] or reply here"
   - Casual but professional — WhatsApp tone, not corporate email tone
   - Use line breaks between items, optional emojis (sparingly)

3. LINKEDIN POST (formatted_linkedin):
   - Opening hook (first 2 lines visible before "see more" — make them count)
   - Branded, energetic tone that reflects Samara's pioneer spirit
   - Scannable: short paragraphs, line breaks, optional bullet points
   - Include the "why this role is different" angle (island life, building something new)
   - Strategic keyword inclusion for LinkedIn search (hospitality, Lombok, the role's core skills)
   - End with 5–8 relevant hashtags (e.g. #HospitalityJobs #LombokLife #HiringNow)
   - Plain text (LinkedIn doesn't support markdown)

4. JOB BOARD (formatted_job_board):
   - SEO-optimized: include role title, location, and department in the first paragraph
   - Structured with clear headings (use **bold** for section headers)
   - Sections: About Samara | The Role | Key Responsibilities | Requirements | Nice-to-Have | What We Offer | How to Apply
   - Clean, scannable formatting
   - Clear separation of must-have vs nice-to-have criteria
   - Professional but with personality — not a wall of corporate text

{
  "formatted_internal": "<full internal posting text>",
  "formatted_whatsapp": "<full whatsapp message>",
  "formatted_linkedin": "<full linkedin post>",
  "formatted_job_board": "<full job board listing>"
}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Format a structured JD into 4 channel-optimized versions.
 *
 * @param {object} structuredJD  The structured JD from Step 1
 * @param {string} roleTitle     Role title for context
 * @param {string} department    Department for context
 * @returns {Promise<object>}    { formatted_internal, formatted_whatsapp, formatted_linkedin, formatted_job_board }
 */
export async function formatJobDescription(structuredJD, roleTitle, department) {
    const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: {
            model: MODEL_VERSION,
            max_tokens: 3000,
            messages: [{ role: 'user', content: buildPrompt(structuredJD, roleTitle, department) }],
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
        throw new Error('Could not parse formatting response. Try regenerating.')
    }

    const requiredKeys = ['formatted_internal', 'formatted_whatsapp', 'formatted_linkedin', 'formatted_job_board']
    for (const key of requiredKeys) {
        if (!parsed[key]) {
            throw new Error(`Formatted output missing "${key}". Try regenerating.`)
        }
    }

    return parsed
}
