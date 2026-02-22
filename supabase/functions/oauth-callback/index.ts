import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { provider, code, redirectUri } = await req.json()

        // Validate request
        if (!provider || !code || !redirectUri) {
            throw new Error('Missing required fields')
        }

        // Get Auth token from headers to know who the user is
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        // Create Supabase client and get user
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')
        const supabaseServerKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const userClient = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) throw new Error('Unauthorized')

        let accessToken, refreshToken, expiresAt

        if (provider === 'zoom') {
            const clientId = Deno.env.get('ZOOM_CLIENT_ID')
            const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')

            const basicAuth = btoa(`${clientId}:${clientSecret}`)
            const params = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })

            const response = await fetch(`https://zoom.us/oauth/token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            })

            // Zoom returns error info differently if unauthorized
            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Zoom API Error: ${errorText}`)
            }

            const tokenData = await response.json()
            accessToken = tokenData.access_token
            refreshToken = tokenData.refresh_token
            expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        }
        else if (provider === 'microsoft') {
            const clientId = Deno.env.get('MS_CLIENT_ID')
            const clientSecret = Deno.env.get('MS_CLIENT_SECRET')

            const params = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })

            // Since Entra could be multi-tenant, we hit the common endpoint
            const response = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Microsoft API Error: ${errorText}`)
            }

            const tokenData = await response.json()
            accessToken = tokenData.access_token
            refreshToken = tokenData.refresh_token
            expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        } else {
            throw new Error(`Unknown provider: ${provider}`)
        }

        // Use service role to completely bypass RLS when performing background inserts/updates
        const adminClient = createClient(supabaseUrl, supabaseServerKey)

        // Upsert integration into user_integrations table
        const { error: upsertError } = await adminClient
            .from('user_integrations')
            .upsert({
                user_id: user.id,
                provider: provider,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: expiresAt,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id, provider'
            })

        if (upsertError) throw upsertError

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Callback error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
