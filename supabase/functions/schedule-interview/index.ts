import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { interview_id, selected_date, selected_slot } = await req.json()

        // Setup Supabase admin client to bypass RLS for this backend operation
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Fetch interview details
        const { data: interview, error: intError } = await supabase
            .from('interviews')
            .select('*, applications(id, candidates(full_name, whatsapp), roles(title))')
            .eq('id', interview_id)
            .single()

        if (intError || !interview) throw new Error('Interview not found')

        // 2. Parse date
        const [hours, minutes] = selected_slot.split(':')
        const scheduledAt = new Date(selected_date)
        scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0)
        const endAt = new Date(scheduledAt.getTime() + (interview.duration_minutes * 60000))

        // 3. (Mock) Call Zoom API to get meeting link
        const meetingLink = `https://zoom.us/j/${Math.floor(Math.random() * 1000000000)}`

        // 4. (Mock) Call Microsoft Graph API to create calendar event for organizer

        // 5. Update Interview record
        await supabase
            .from('interviews')
            .update({
                status: 'scheduled',
                scheduled_at: scheduledAt.toISOString(),
                end_at: endAt.toISOString(),
                meeting_link: meetingLink
            })
            .eq('id', interview_id)

        // 6. Update Application Stage
        await supabase
            .from('applications')
            .update({ stage: 'Interview Scheduled' })
            .eq('id', interview.application_id)

        // 7. (Mock) Call WhatsApp Business API to send confirmation
        console.log(`Sending WhatsApp to ${interview.applications.candidates.whatsapp} with meeting link ${meetingLink}`)

        return new Response(JSON.stringify({ success: true, meeting_link: meetingLink }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
