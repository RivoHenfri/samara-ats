/**
 * claude-proxy — Supabase Edge Function
 *
 * Proxies requests from the browser to the Anthropic API.
 * The ANTHROPIC_KEY secret lives here on the server; it is
 * never exposed to the browser bundle.
 *
 * Deploy:
 *   supabase secrets set ANTHROPIC_KEY=sk-ant-...
 *   supabase functions deploy claude-proxy --no-verify-jwt
 *
 * Note: --no-verify-jwt is used so the function handles JWT
 * validation itself and can return a proper 401 JSON response.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY')
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

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

  // Only allow POST
  if (req.method !== 'POST') {
    return json({ error: { message: 'Method not allowed' } }, 405)
  }

  // Verify the caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: { message: 'Missing Authorization header' } }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return json({ error: { message: 'Unauthorized' } }, 401)
  }

  if (!ANTHROPIC_KEY) {
    return json({ error: { message: 'Anthropic API key is not configured on the server.' } }, 500)
  }

  // Parse and forward the request
  let body: { model: string; max_tokens: number; messages: unknown[]; beta?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: { message: 'Invalid JSON body' } }, 400)
  }

  const { model, max_tokens, messages, beta } = body

  if (!model || !max_tokens || !messages) {
    return json({ error: { message: 'Missing required fields: model, max_tokens, messages' } }, 400)
  }

  const anthropicHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
  }
  if (beta) {
    anthropicHeaders['anthropic-beta'] = beta
  }

  const upstream = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: anthropicHeaders,
    body: JSON.stringify({ model, max_tokens, messages }),
  })

  const data = await upstream.json()
  return json(data, upstream.status)
})
