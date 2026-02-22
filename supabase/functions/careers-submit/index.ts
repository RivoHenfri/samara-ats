/**
 * careers-submit — Supabase Edge Function
 *
 * Public endpoint (no JWT required) that handles job applications submitted
 * from the /apply/:roleId page. Uses the service role key to bypass RLS and
 * resolves tenant_id server-side from the role row — the client never supplies
 * the tenant, preventing cross-tenant pollution.
 *
 * Deploy:
 *   supabase functions deploy careers-submit --no-verify-jwt
 *
 * Note: --no-verify-jwt is intentional — this is a public form endpoint.
 * Input validation and server-side tenant resolution provide the security
 * boundary in place of JWT auth.
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

function isValidUrl(url: string): boolean {
  try { new URL(url); return true } catch { return false }
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

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    role_id?: string
    full_name?: string
    email?: string
    whatsapp?: string
    origin?: string
    expected_salary?: number | null
    cover_letter?: string
    cv_link?: string
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const {
    role_id,
    full_name,
    email,
    whatsapp,
    origin,
    expected_salary,
    cover_letter,
    cv_link,
  } = body

  // ── Validation ────────────────────────────────────────────────────────────
  if (!role_id || !full_name?.trim() || !origin) {
    return json({ error: 'Missing required fields: role_id, full_name, origin' }, 400)
  }
  if (!VALID_ORIGINS.includes(origin as typeof VALID_ORIGINS[number])) {
    return json({ error: `Invalid origin. Must be one of: ${VALID_ORIGINS.join(', ')}` }, 400)
  }
  if (email && !isValidEmail(email)) {
    return json({ error: 'Invalid email format' }, 400)
  }
  if (cv_link && !isValidUrl(cv_link)) {
    return json({ error: 'Invalid CV link — must be a full URL (https://...)' }, 400)
  }
  if (cover_letter && cover_letter.length > 5000) {
    return json({ error: 'Cover letter must be 5 000 characters or fewer' }, 400)
  }
  if (full_name.trim().length > 200) {
    return json({ error: 'Full name must be 200 characters or fewer' }, 400)
  }

  // ── Admin client (bypasses RLS) ───────────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // ── Fetch & validate role ─────────────────────────────────────────────────
  const { data: role, error: roleErr } = await supabaseAdmin
    .from('roles')
    .select('id, tenant_id, status')
    .eq('id', role_id)
    .single()

  if (roleErr || !role) {
    return json({ error: 'Role not found' }, 404)
  }
  if (role.status !== 'Open') {
    return json({ error: 'This position is no longer accepting applications' }, 409)
  }

  const tenantId: string = role.tenant_id

  // ── Candidate deduplication (by email within tenant) ─────────────────────
  let candidateId: string | null = null

  if (email) {
    const { data: existing } = await supabaseAdmin
      .from('candidates')
      .select('id')
      .eq('email', email)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) candidateId = existing.id
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
        expected_salary: expected_salary ?? null,
        cv_link: cv_link || null,
        tenant_id: tenantId,
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
      source: 'Career Page',
      cover_letter: cover_letter || null,
      tenant_id: tenantId,
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
        source: 'Career Page',
        cv_link: cv_link || null,
        submitted_at: new Date().toISOString(),
      },
      tenant_id: tenantId,
    })
  } catch (histErr) {
    // Non-fatal — application is already created successfully
    console.warn('application_history insert failed (non-fatal):', histErr)
  }

  return json({ success: true, application_id: application.id }, 201)
})
