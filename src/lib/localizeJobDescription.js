/**
 * Step 3: Bahasa Indonesia Localization
 *
 * Translates the structured JD + 4 formatted versions into Bahasa Indonesia.
 * Only called when job location is within Indonesia.
 *
 * Rules:
 *   - Professional HR terminology (not casual Indonesian)
 *   - Cultural appropriateness (avoid literal translations)
 *   - Preserve structured formatting exactly
 *   - Keep technical terms / brand names in English where standard in Indonesian HR
 */

import { supabase } from './supabase'

export const PROMPT_VERSION = 'v1'
export const MODEL_VERSION = 'claude-sonnet-4-6'

function buildPrompt(structuredJD, formattedVersions) {
    return `You are a professional Indonesian HR translator. Translate ALL of the following job description content from English into Bahasa Indonesia.

TRANSLATION RULES:
1. Use formal, professional Bahasa Indonesia appropriate for HR / recruitment documents.
2. Keep technical terms in English where they are standard in Indonesian business (e.g., "KPI", "SOP", "F&B", "PMS", "revenue management", "check-in/check-out").
3. Keep brand names and proper nouns in English (e.g., "Samara", "Lombok").
4. Do NOT do literal word-for-word translation — adapt idioms and phrases to sound natural in Indonesian.
5. Preserve the EXACT same JSON structure and formatting (line breaks, bullets, emoji usage in WhatsApp version, hashtags in LinkedIn version).
6. For the structured JD, maintain all field names in English (they are JSON keys) — only translate the VALUES.
7. "Nice-to-have" → "Diutamakan" or "Nilai Tambah"
8. "Must-have" / "Required" → "Wajib" or "Persyaratan"
9. Keep number formats, salary formats, and date formats in Indonesian standard.

SOURCE CONTENT:

=== STRUCTURED JD (translate values only, keep keys) ===
${JSON.stringify(structuredJD, null, 2)}

=== FORMATTED INTERNAL ===
${formattedVersions.formatted_internal}

=== FORMATTED WHATSAPP ===
${formattedVersions.formatted_whatsapp}

=== FORMATTED LINKEDIN ===
${formattedVersions.formatted_linkedin}

=== FORMATTED JOB BOARD ===
${formattedVersions.formatted_job_board}

Return ONLY a valid JSON object — no markdown fences, no explanation:
{
  "structured_jd_id": { <same structure as source, values in Bahasa Indonesia> },
  "formatted_internal_id": "<full translated internal posting>",
  "formatted_whatsapp_id": "<full translated whatsapp message>",
  "formatted_linkedin_id": "<full translated linkedin post>",
  "formatted_job_board_id": "<full translated job board listing>"
}`
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Translate JD content into Bahasa Indonesia.
 *
 * @param {object} structuredJD       Structured JD from Step 1
 * @param {object} formattedVersions  { formatted_internal, formatted_whatsapp, formatted_linkedin, formatted_job_board }
 * @returns {Promise<object>}         Bahasa Indonesia versions
 */
export async function localizeJobDescription(structuredJD, formattedVersions) {
    const { data, error } = await supabase.functions.invoke('claude-proxy', {
        body: {
            model: MODEL_VERSION,
            max_tokens: 8000,
            messages: [{ role: 'user', content: buildPrompt(structuredJD, formattedVersions) }],
        },
    })

    if (error) throw new Error(error.message || 'Claude proxy error')
    if (data?.error) throw new Error(data.error.message || 'Claude API error')
    if (!data?.content?.[0]?.text) throw new Error('Empty response from Claude')

    let raw = data.content[0].text.trim()
    // Strip markdown fences (various patterns)
    raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
    // Try to extract the outermost JSON object if there's extra text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (jsonMatch) raw = jsonMatch[0]

    let parsed
    try {
        parsed = JSON.parse(raw)
    } catch {
        throw new Error('Could not parse localization response. Try regenerating.')
    }

    return parsed
}

/**
 * Check if a location is within Indonesia (triggers Bahasa translation).
 * @param {string} location
 * @returns {boolean}
 */
export function isIndonesianLocation(location) {
    if (!location) return false
    const indonesianLocations = [
        'lombok', 'bali', 'jakarta', 'surabaya', 'other indonesia',
        'bandung', 'yogyakarta', 'medan', 'semarang', 'makassar',
    ]
    return indonesianLocations.includes(location.toLowerCase())
}
