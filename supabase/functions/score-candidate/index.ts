/**
 * score-candidate — Supabase Edge Function
 *
 * Event-driven function triggered by a webhook (AFTER INSERT on public.applications).
 * Evaluates the application using Anthropic Claude Sonnet and saves the results.
 * 
 * Deploy:
 *   supabase functions deploy score-candidate --no-verify-jwt
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Anthropic details
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const MODEL_VERSION = 'claude-sonnet-4-6' // Latest available in the workspace

// Build prompt (ported from original frontend logic)
function buildPrompt(app: any, parsedCV: any = null, scoringCriteria: any = null, weights: any = null) {
  const candidate = app.candidates || {}
  const role = app.roles || {}

  // 1. Salary section
  const curr = parseInt(candidate.current_salary) || 0
  const exp = parseInt(candidate.expected_salary) || 0
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

  // 2. CV / parsed data section
  const cvSection = parsedCV
    ? `
PARSED CV DATA:
  Current Role:       ${parsedCV.current_role || 'Unknown'}
  Experience:         ${parsedCV.experience_years != null ? `${parsedCV.experience_years} years` : 'Unknown'}
  Skills:             ${(parsedCV.skills || []).join(', ') || 'Not listed'}
  Avg Tenure:         ${parsedCV.average_tenure_months != null ? `${parsedCV.average_tenure_months} months per role` : 'Unknown'}
  Employment Gaps:    ${(parsedCV.employment_gaps || []).join('; ') || 'None detected'}
  CV Flags:           ${(parsedCV.flags || []).join('; ') || 'None'}
  Education:          ${(parsedCV.education || []).map((e: any) => e.degree ? `${e.degree}${e.institution ? ' @ ' + e.institution : ''}` : e).join('; ') || 'Not listed'}
  Recent Employers:   ${(parsedCV.employment_history || []).slice(0, 3).map((e: any) => e.company || e).join('; ') || 'Not listed'}`
    : `
NO PARSED CV AVAILABLE — evaluate based on profile fields only.
Flag "No CV on file" as a risk when scoring.`

  // 3. Job context section
  const jobContextSection = role.job_context?.trim()
    ? `
DETAILED JOB REQUIREMENTS:
${role.job_context.trim()}`
    : `
NO DETAILED JOB CONTEXT — infer requirements from role title "${role.title || 'Unknown'}" and department "${role.department || 'Unknown'}".`

  // 4. Structured scoring criteria section
  const mustHave = scoringCriteria?.must_have_criteria || []
  const niceToHave = scoringCriteria?.nice_to_have_criteria || []

  const structuredCriteriaSection = mustHave.length > 0
    ? `
STRUCTURED SCORING CRITERIA:
MUST-HAVE CRITERIA:
${mustHave.map((c: any) => `  - [${c.type?.toUpperCase()}] ${c.criterion} (threshold: ${c.threshold})`).join('\n')}
NICE-TO-HAVE CRITERIA:
${niceToHave.map((c: any) => `  - [${c.type?.toUpperCase()}] ${c.criterion} (threshold: ${c.threshold})`).join('\n')}
` : ''

  // 5. Dynamic weights
  const w = weights || { must_have: 0.55, nice_to_have: 0.25, salary_alignment: 0.20 }

  return `You are a senior talent assessment AI for Samara Lombok, a premium hospitality, construction, and operations company in Lombok, Indonesia.

Your task is to produce a structured compatibility evaluation of the candidate against the role. You must:
1. Parse the job requirements to separate must-have (non-negotiable) from nice-to-have (preferred) criteria
2. Score the candidate on each dimension using concrete evidence from their profile
3. Detect risk signals (salary mismatch, instability, missing credentials, relocation concerns, etc.)
4. Write a 3–5 line executive summary that a recruiter can read in 10 seconds
5. List specific interview focus areas based on gaps and risks

ROLE:
  Title:      ${role.title || 'Unknown'}
  Department: ${role.department || 'Unknown'}
  Priority:   ${role.priority || 'Unknown'}
${jobContextSection}
${structuredCriteriaSection}

CANDIDATE:
  Name:       ${candidate.full_name || 'Unknown'}
  Origin:     ${candidate.origin || 'Unknown'}
  Salary:     ${salaryLine}
  Stage:      ${app.stage || 'New'}
${cvSection}

SCORING RULES:
- overall_score: weighted average — must_have_score × ${w.must_have} + nice_to_have_score × ${w.nice_to_have} + salary_alignment_score × ${w.salary_alignment}
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
- executive_summary: focus on top strength, top gap, and clear recommendation.
- interview_focus: 3–5 specific items.
- risk_flags: Empty array if genuinely no risks.`
}

let applicationId: string | null = null
let supabaseAdmin: any = null
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()

    // Webhook delivers {"type": "INSERT", "record": {...}}
    const record = payload.record || payload
    applicationId = record.id
    const candidateId = record.candidate_id
    const tenantId = record.tenant_id
    const roleId = record.role_id

    if (!applicationId) {
      return new Response(JSON.stringify({ error: 'Missing logic application id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Immediately acknowledge and mark "processing"
    await supabaseAdmin
      .from('applications')
      .update({ scoring_status: 'processing', scoring_error: null })
      .eq('id', applicationId)

    // 2. Fetch full context to generate prompt
    const { data: fullApp, error: appErr } = await supabaseAdmin
      .from('applications')
      .select(`
        id, stage,
        candidates!inner(*),
        roles!inner(*)
      `)
      .eq('id', applicationId)
      .single()

    if (appErr || !fullApp) throw new Error('Could not fetch application context')

    // 2.1 Fetch active CV data if available
    const { data: cvSource } = await supabaseAdmin
      .from('cv_sources')
      .select('parsed_data')
      .eq('candidate_id', candidateId)
      .eq('is_active', true)
      .maybeSingle()

    const parsedCV = cvSource?.parsed_data || null

    // 2.2 Fetch scoring requirements if they exist in a separate table or roles
    // (Existing logic check)
    let structuredCriteria = null
    const rawCriteriaInfo = (fullApp.roles as any).scoring_requirements
    if (rawCriteriaInfo && typeof rawCriteriaInfo === 'object') {
      structuredCriteria = rawCriteriaInfo
    }

    // 3. Build the prompt
    const promptString = buildPrompt(fullApp, parsedCV, structuredCriteria, (fullApp.roles as any).scoring_weights)

    // 4. Call Anthropic API
    if (!ANTHROPIC_KEY) throw new Error('Anthropic API key is missing on the server')

    const anthropicRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL_VERSION,
        max_tokens: 1500,
        messages: [{ role: 'user', content: promptString }],
      }),
    })

    if (!anthropicRes.ok) {
      const e = await anthropicRes.text()
      throw new Error(`Anthropic API failed: ${anthropicRes.status} ${e}`)
    }

    const anthropicData = await anthropicRes.json()
    let scoreObj
    try {
      let rawText: string = anthropicData.content[0].text.trim()

      // Strategy 1: Strip markdown code fences (```json ... ``` or ``` ... ```)
      rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

      // Strategy 2: Extract first JSON object from the text if still not valid
      // This handles cases where the model adds prose before/after the JSON
      if (!rawText.startsWith('{')) {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        if (jsonMatch) rawText = jsonMatch[0]
      }

      scoreObj = JSON.parse(rawText)

      // Ensure overall_score consistency
      if (scoreObj.must_have_score != null && scoreObj.nice_to_have_score != null) {
        const w = (fullApp.roles as any).scoring_weights || { must_have: 0.55, nice_to_have: 0.25, salary_alignment: 0.20 }
        scoreObj.overall_score = Math.round(
          scoreObj.must_have_score * w.must_have +
          scoreObj.nice_to_have_score * w.nice_to_have +
          (scoreObj.salary_alignment_score || 0) * w.salary_alignment
        )
      }
    } catch (err: any) {
      throw new Error(`Failed to parse Claude output: ${err?.message || err}. Raw: ${anthropicData?.content?.[0]?.text?.substring(0, 500)}`)
    }

    // 5. Persist the score back — delete any existing row, then insert fresh
    await supabaseAdmin
      .from('application_scores')
      .delete()
      .eq('application_id', applicationId)

    const { error: scoreErr } = await supabaseAdmin
      .from('application_scores')
      .insert({
        application_id: applicationId,
        overall_score: scoreObj.overall_score,
        must_have_score: scoreObj.must_have_score,
        nice_to_have_score: scoreObj.nice_to_have_score,
        salary_alignment_score: scoreObj.salary_alignment_score,
        risk_flags: scoreObj.risk_flags || [],
        executive_summary: scoreObj.executive_summary,
        interview_focus: scoreObj.interview_focus || [],
        model_version: MODEL_VERSION,
        prompt_version: 'v1',
        scored_by_name: 'Samara AI'
      })

    if (scoreErr) throw new Error(`Failed to save score db: ${scoreErr.message}`)

    // 6. Complete lifecycle
    await supabaseAdmin
      .from('applications')
      .update({ scoring_status: 'completed' })
      .eq('id', applicationId)

    return new Response(JSON.stringify({ success: true, applicationId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)

    // Explicit Fallback & Dead Letter Queue (DLQ)
    try {
      if (applicationId && supabaseAdmin) {
        let finalStatus = 'failed'
        const errMsg = String(error.message).toLowerCase()

        // Smart Failure Classification
        if (
          errMsg.includes('400') ||
          errMsg.includes('401') ||
          errMsg.includes('403') ||
          errMsg.includes('404') ||
          errMsg.includes('parse claude') ||
          errMsg.includes('could not fetch application') ||
          errMsg.includes('missing on the server') ||
          errMsg.includes('invalid')
        ) {
          finalStatus = 'fatal_error'
        }

        await supabaseAdmin
          .from('applications')
          .update({
            scoring_status: finalStatus,
            scoring_error: String(error.message)
          })
          .eq('id', applicationId)
      }
    } catch (e) {
      console.error('CRITICAL: Failed to update DLQ status in database', e)
    }

    return new Response(JSON.stringify({ error: String(error.message) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
