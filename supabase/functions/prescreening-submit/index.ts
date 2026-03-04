/**
 * prescreening-submit — Supabase Edge Function
 *
 * Public endpoint (no JWT required) for the candidate-facing prescreening form.
 * Candidates access the form via /prescreening/:token — the token maps to a
 * prescreening_responses record.
 *
 * Two operations:
 *   action: 'load'   — Returns template + candidate info for rendering the form
 *   action: 'submit' — Validates and saves candidate responses
 *
 * Deploy:
 *   supabase functions deploy prescreening-submit --no-verify-jwt
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

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: {
    action: 'load' | 'submit'
    access_token: string
    responses?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { action, access_token, responses: submittedResponses } = body

  if (!access_token) {
    return json({ error: 'Missing access_token' }, 400)
  }
  if (!action || !['load', 'submit'].includes(action)) {
    return json({ error: 'Invalid action. Must be "load" or "submit"' }, 400)
  }

  // ── Admin client (bypasses RLS) ─────────────────────────────────────────
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // ── Fetch prescreening response by token ────────────────────────────────
  const { data: prescreen, error: psErr } = await supabaseAdmin
    .from('prescreening_responses')
    .select(`
      *,
      applications!inner(
        id, role_id, stage,
        candidates!inner(id, full_name, email, whatsapp)
      )
    `)
    .eq('access_token', access_token)
    .maybeSingle()

  if (psErr || !prescreen) {
    return json({ error: 'Invalid or expired prescreening link' }, 404)
  }

  // ── Check status ────────────────────────────────────────────────────────
  if (prescreen.status === 'completed') {
    return json({ error: 'This form has already been submitted', already_completed: true }, 409)
  }
  if (prescreen.status === 'expired' || (prescreen.expires_at && new Date(prescreen.expires_at) < new Date())) {
    return json({ error: 'This form has expired. Please contact the recruiter.' }, 410)
  }

  // ── Fetch role info ─────────────────────────────────────────────────────
  const { data: role } = await supabaseAdmin
    .from('roles')
    .select('id, title, department')
    .eq('id', prescreen.applications.role_id)
    .single()

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: LOAD
  // ══════════════════════════════════════════════════════════════════════════
  if (action === 'load') {
    // Mark as started on first load
    if (prescreen.status === 'pending' || prescreen.status === 'sent') {
      await supabaseAdmin
        .from('prescreening_responses')
        .update({
          status: 'started',
          started_at: new Date().toISOString(),
        })
        .eq('id', prescreen.id)
    }

    return json({
      template: prescreen.template_snapshot || {
        fixed_fields: [],
        custom_questions: [],
      },
      candidate_name: prescreen.applications.candidates.full_name,
      role_title: role?.title || 'the position',
      department: role?.department || '',
      existing_responses: prescreen.responses || {},
      status: prescreen.status,
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTION: SUBMIT
  // ══════════════════════════════════════════════════════════════════════════
  if (action === 'submit') {
    if (!submittedResponses || typeof submittedResponses !== 'object') {
      return json({ error: 'Missing responses object' }, 400)
    }

    // Validate required fields from template
    const template = prescreen.template_snapshot || { fixed_fields: [], custom_questions: [] }
    const missingFields: string[] = []

    for (const field of (template.fixed_fields || [])) {
      if (field.enabled === false) continue
      if (!field.required) continue

      const val = submittedResponses[field.field_key]
      if (val === undefined || val === null || val === '') {
        missingFields.push(field.label)
      }
      // For yes_no_detail, check if detail is provided when answer is 'yes'
      if (field.type === 'yes_no_detail' && val === 'yes') {
        const detail = submittedResponses[`${field.field_key}_detail`]
        if (!detail || detail === '') {
          missingFields.push(`${field.label} (details)`)
        }
      }
    }

    for (let i = 0; i < (template.custom_questions || []).length; i++) {
      const q = template.custom_questions[i]
      if (!q.required) continue
      const val = submittedResponses[`custom_q_${i}`]
      if (val === undefined || val === null || val === '') {
        missingFields.push(`Question ${i + 1}`)
      }
    }

    if (missingFields.length > 0) {
      return json({ error: `Missing required fields: ${missingFields.join(', ')}` }, 400)
    }

    // Save responses
    const { error: updateErr } = await supabaseAdmin
      .from('prescreening_responses')
      .update({
        responses: submittedResponses,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', prescreen.id)

    if (updateErr) {
      console.error('prescreening_responses update error:', updateErr)
      return json({ error: 'Failed to save responses' }, 500)
    }

    // Sync salary fields back to candidates table (only if provided and currently empty)
    const candidateId = prescreen.applications.candidates.id
    const syncUpdates: Record<string, unknown> = {}

    if (submittedResponses.current_salary) {
      syncUpdates.current_salary = parseInt(String(submittedResponses.current_salary).replace(/\D/g, '')) || null
    }
    if (submittedResponses.expected_salary) {
      syncUpdates.expected_salary = parseInt(String(submittedResponses.expected_salary).replace(/\D/g, '')) || null
    }
    if (submittedResponses.availability_date) {
      syncUpdates.availability_to_start = submittedResponses.availability_date
    }

    if (Object.keys(syncUpdates).length > 0) {
      // Only update empty fields (don't overwrite existing data)
      const { data: existingCandidate } = await supabaseAdmin
        .from('candidates')
        .select('current_salary, expected_salary, availability_to_start')
        .eq('id', candidateId)
        .single()

      const filteredUpdates: Record<string, unknown> = {}
      if (!existingCandidate?.current_salary && syncUpdates.current_salary) {
        filteredUpdates.current_salary = syncUpdates.current_salary
      }
      if (!existingCandidate?.expected_salary && syncUpdates.expected_salary) {
        filteredUpdates.expected_salary = syncUpdates.expected_salary
      }
      if (!existingCandidate?.availability_to_start && syncUpdates.availability_to_start) {
        filteredUpdates.availability_to_start = syncUpdates.availability_to_start
      }

      if (Object.keys(filteredUpdates).length > 0) {
        await supabaseAdmin
          .from('candidates')
          .update(filteredUpdates)
          .eq('id', candidateId)
      }
    }

    return json({ success: true }, 200)
  }

  return json({ error: 'Unknown action' }, 400)
})
