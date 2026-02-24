/**
 * form-submit — Supabase Edge Function
 *
 * Dedicated endpoint for Power Automate / MS Forms candidate submissions.
 * Secured with the service role key (Authorization: Bearer <key>).
 *
 * Accepts pre-cleaned data from Power Automate including a suitability score
 * calculated in the flow, and inserts the candidate + application into the ATS.
 *
 * Deploy:
 *   supabase functions deploy form-submit --no-verify-jwt
 *
 * Note: --no-verify-jwt is used because we validate the service role key
 * manually in the handler (not via Supabase's built-in JWT check).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

const VALID_ORIGINS = ['Lombok Local', 'Indonesian (Non-Lombok)', 'International'] as const

serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405)
    }

    // ── Auth: require service role key ────────────────────────────────────────
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')

    if (!token || token !== serviceRoleKey) {
        return json({ error: 'Unauthorized — valid service role key required' }, 401)
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: {
        role_id?: string
        tenant_id?: string
        full_name?: string
        email?: string
        whatsapp?: string
        origin?: string
        current_salary?: number | null
        expected_salary?: number | null
        availability_to_start?: string
        document_readiness?: boolean
        technical_notes?: string
        suitability_score?: number | null
    }

    try {
        body = await req.json()
    } catch {
        return json({ error: 'Invalid JSON body' }, 400)
    }

    const {
        role_id,
        tenant_id,
        full_name,
        email,
        whatsapp,
        origin,
        current_salary,
        expected_salary,
        availability_to_start,
        document_readiness,
        technical_notes,
        suitability_score,
    } = body

    // ── Validation ────────────────────────────────────────────────────────────
    if (!role_id || !tenant_id || !full_name?.trim() || !origin) {
        return json({ error: 'Missing required fields: role_id, tenant_id, full_name, origin' }, 400)
    }
    if (!VALID_ORIGINS.includes(origin as typeof VALID_ORIGINS[number])) {
        return json({ error: `Invalid origin. Must be one of: ${VALID_ORIGINS.join(', ')}` }, 400)
    }
    if (email && !isValidEmail(email)) {
        return json({ error: 'Invalid email format' }, 400)
    }
    if (full_name.trim().length > 200) {
        return json({ error: 'Full name must be 200 characters or fewer' }, 400)
    }

    // ── Admin client (bypasses RLS) ───────────────────────────────────────────
    const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        serviceRoleKey,
    )

    // ── Validate role exists and belongs to the given tenant ──────────────────
    const { data: role, error: roleErr } = await supabaseAdmin
        .from('roles')
        .select('id, tenant_id, status')
        .eq('id', role_id)
        .single()

    if (roleErr || !role) {
        return json({ error: 'Role not found' }, 404)
    }
    if (role.tenant_id !== tenant_id) {
        return json({ error: 'Role does not belong to the specified tenant' }, 403)
    }
    if (role.status !== 'Open') {
        return json({ error: 'This position is no longer accepting applications' }, 409)
    }

    // ── Candidate deduplication (by email within tenant) ─────────────────────
    let candidateId: string | null = null
    let isExistingCandidate = false

    if (email) {
        const { data: existing } = await supabaseAdmin
            .from('candidates')
            .select('id')
            .eq('email', email)
            .eq('tenant_id', tenant_id)
            .maybeSingle()

        if (existing) {
            candidateId = existing.id
            isExistingCandidate = true

            // Update suitability_score on the existing candidate if provided
            if (suitability_score != null) {
                await supabaseAdmin
                    .from('candidates')
                    .update({
                        suitability_score,
                        ...(availability_to_start ? { availability_to_start } : {}),
                        ...(current_salary != null ? { current_salary } : {}),
                        ...(expected_salary != null ? { expected_salary } : {}),
                    })
                    .eq('id', candidateId)
            }
        }
    }

    // ── Insert candidate if no duplicate ─────────────────────────────────────
    if (!candidateId) {
        const { data: candidate, error: candErr } = await supabaseAdmin
            .from('candidates')
            .insert({
                full_name: full_name.trim(),
                email: email || null,
                whatsapp: whatsapp || null,
                origin,
                current_salary: current_salary ?? null,
                expected_salary: expected_salary ?? null,
                availability_to_start: availability_to_start || null,
                suitability_score: suitability_score ?? null,
                tenant_id,
            })
            .select('id')
            .single()

        if (candErr || !candidate) {
            console.error('candidate insert error:', candErr)
            return json({ error: 'Failed to create candidate record' }, 500)
        }
        candidateId = candidate.id
    }

    // ── Insert application ────────────────────────────────────────────────────
    const { data: application, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
            candidate_id: candidateId,
            role_id: role.id,
            stage: 'New',
            source: 'MS Form',
            cover_letter: technical_notes || null,
            tenant_id,
        })
        .select('id')
        .single()

    if (appErr || !application) {
        console.error('application insert error:', appErr)
        return json({ error: 'Failed to submit application' }, 500)
    }

    // ── Insert application_history (non-fatal) ────────────────────────────────
    try {
        await supabaseAdmin.from('application_history').insert({
            application_id: application.id,
            action_type: 'applied',
            metadata: {
                source: 'MS Form',
                document_readiness: document_readiness ?? null,
                suitability_score: suitability_score ?? null,
                availability_to_start: availability_to_start || null,
                submitted_at: new Date().toISOString(),
            },
            tenant_id,
        })
    } catch (histErr) {
        // Non-fatal — application is already created successfully
        console.warn('application_history insert failed (non-fatal):', histErr)
    }

    return json({
        success: true,
        application_id: application.id,
        candidate_id: candidateId,
        is_existing_candidate: isExistingCandidate,
    }, 201)
})
