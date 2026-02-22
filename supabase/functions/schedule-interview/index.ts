import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const {
            interview_id,
            user_id,
            selected_date,
            selected_slot,
            interview_type,
            round,
            interviewers,
        } = await req.json()

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // 1. Fetch interview details
        const { data: interview, error: intError } = await supabase
            .from('interviews')
            .select('*, applications(id, candidate_id, role_id, candidates(full_name, whatsapp), roles(title))')
            .eq('id', interview_id)
            .single()

        if (intError || !interview) throw new Error('Interview not found')

        // 2. Parse scheduled time
        const [hours, minutes] = selected_slot.split(':')
        const scheduledAt = new Date(selected_date)
        scheduledAt.setHours(parseInt(hours), parseInt(minutes), 0, 0)
        const endAt = new Date(scheduledAt.getTime() + (interview.duration_minutes * 60000))

        const warnings: string[] = []
        let meetingLink = interview.meeting_link || null
        let calendarEventId = interview.calendar_event_id || null
        let zoomMeetingId = interview.zoom_meeting_id || null

        const effectiveType = interview_type || interview.interview_type || 'Online'

        // 3. Zoom meeting creation (only for Online interviews)
        if (effectiveType === 'Online' && !meetingLink) {
            try {
                const { data: zoomIntegration } = await supabase
                    .from('user_integrations')
                    .select('access_token, refresh_token, expires_at')
                    .eq('user_id', user_id || interview.organizer_id)
                    .eq('provider', 'zoom')
                    .single()

                if (zoomIntegration?.access_token) {
                    let accessToken = zoomIntegration.access_token

                    // Check if token is expired, refresh if needed
                    if (zoomIntegration.expires_at && new Date(zoomIntegration.expires_at) < new Date()) {
                        const clientId = Deno.env.get('ZOOM_CLIENT_ID')
                        const clientSecret = Deno.env.get('ZOOM_CLIENT_SECRET')
                        const basicAuth = btoa(`${clientId}:${clientSecret}`)

                        const refreshResp = await fetch('https://zoom.us/oauth/token', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Basic ${basicAuth}`,
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: new URLSearchParams({
                                grant_type: 'refresh_token',
                                refresh_token: zoomIntegration.refresh_token,
                            }),
                        })

                        if (refreshResp.ok) {
                            const refreshData = await refreshResp.json()
                            accessToken = refreshData.access_token
                            // Update stored tokens
                            await supabase.from('user_integrations').update({
                                access_token: refreshData.access_token,
                                refresh_token: refreshData.refresh_token || zoomIntegration.refresh_token,
                                expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                            }).eq('user_id', interview.organizer_id).eq('provider', 'zoom')
                        } else {
                            warnings.push('zoom_token_refresh_failed')
                        }
                    }

                    // Create Zoom meeting
                    if (accessToken && !warnings.includes('zoom_token_refresh_failed')) {
                        const roleTitle = interview.applications?.roles?.title || 'Interview'
                        const roundLabel = round || interview.round || ''
                        const topic = `${roleTitle}${roundLabel ? ' — ' + roundLabel + ' Round' : ''}`

                        const zoomResp = await fetch('https://api.zoom.us/v2/users/me/meetings', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                topic,
                                type: 2, // Scheduled meeting
                                start_time: scheduledAt.toISOString(),
                                duration: interview.duration_minutes,
                                timezone: 'Asia/Makassar',
                                settings: {
                                    join_before_host: true,
                                    waiting_room: false,
                                },
                            }),
                        })

                        if (zoomResp.ok) {
                            const zoomData = await zoomResp.json()
                            meetingLink = zoomData.join_url
                            zoomMeetingId = String(zoomData.id)
                        } else {
                            warnings.push('zoom_meeting_creation_failed')
                            console.error('Zoom API error:', await zoomResp.text())
                        }
                    }
                } else {
                    warnings.push('zoom_not_connected')
                }
            } catch (zoomErr) {
                console.error('Zoom integration error:', zoomErr)
                warnings.push('zoom_error')
            }
        }

        // 4. Outlook calendar event creation
        try {
            const { data: msIntegration } = await supabase
                .from('user_integrations')
                .select('access_token, refresh_token, expires_at')
                .eq('user_id', interview.organizer_id)
                .eq('provider', 'microsoft')
                .single()

            if (msIntegration?.access_token) {
                let accessToken = msIntegration.access_token

                // Refresh if expired
                if (msIntegration.expires_at && new Date(msIntegration.expires_at) < new Date()) {
                    const clientId = Deno.env.get('MS_CLIENT_ID')
                    const clientSecret = Deno.env.get('MS_CLIENT_SECRET')

                    const refreshResp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            client_id: clientId!,
                            client_secret: clientSecret!,
                            grant_type: 'refresh_token',
                            refresh_token: msIntegration.refresh_token,
                        }),
                    })

                    if (refreshResp.ok) {
                        const refreshData = await refreshResp.json()
                        accessToken = refreshData.access_token
                        await supabase.from('user_integrations').update({
                            access_token: refreshData.access_token,
                            refresh_token: refreshData.refresh_token || msIntegration.refresh_token,
                            expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
                        }).eq('user_id', interview.organizer_id).eq('provider', 'microsoft')
                    } else {
                        warnings.push('microsoft_token_refresh_failed')
                    }
                }

                if (accessToken && !warnings.includes('microsoft_token_refresh_failed')) {
                    const roleTitle = interview.applications?.roles?.title || 'Interview'
                    const roundLabel = round || interview.round || ''
                    const candidateName = interview.applications?.candidates?.full_name || 'Candidate'
                    const subject = `Interview: ${candidateName} — ${roleTitle}${roundLabel ? ' (' + roundLabel + ')' : ''}`

                    const interviewersList = interviewers || interview.interviewers || []
                    const attendees = interviewersList
                        .filter((i: string) => i.includes('@'))
                        .map((email: string) => ({
                            emailAddress: { address: email, name: email },
                            type: 'required',
                        }))

                    const eventBody: Record<string, unknown> = {
                        subject,
                        body: {
                            contentType: 'HTML',
                            content: `<p>Interview for <strong>${roleTitle}</strong>${roundLabel ? ' — ' + roundLabel + ' Round' : ''}</p>${meetingLink ? `<p><a href="${meetingLink}">Join Zoom Meeting</a></p>` : ''}`,
                        },
                        start: { dateTime: scheduledAt.toISOString(), timeZone: 'Asia/Makassar' },
                        end: { dateTime: endAt.toISOString(), timeZone: 'Asia/Makassar' },
                        attendees,
                    }

                    const calResp = await fetch('https://graph.microsoft.com/v1.0/me/events', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(eventBody),
                    })

                    if (calResp.ok) {
                        const calData = await calResp.json()
                        calendarEventId = calData.id
                    } else {
                        warnings.push('outlook_event_creation_failed')
                        console.error('MS Graph error:', await calResp.text())
                    }
                }
            } else {
                warnings.push('microsoft_not_connected')
            }
        } catch (msErr) {
            console.error('Microsoft integration error:', msErr)
            warnings.push('microsoft_error')
        }

        // 5. Update interview record with Zoom meeting link
        const { error: updateErr } = await supabase
            .from('interviews')
            .update({ meeting_link: meetingLink })
            .eq('id', interview_id)

        if (updateErr) {
            console.error('Failed to save meeting_link:', updateErr.message)
            warnings.push('meeting_link_save_failed')
        }

        // 6. Update application stage
        await supabase
            .from('applications')
            .update({ stage: 'Interview Scheduled' })
            .eq('id', interview.application_id)

        // 7. Log to audit ledger
        await supabase.from('application_history').insert({
            application_id: interview.application_id,
            candidate_id: interview.applications?.candidate_id,
            role_id: interview.applications?.role_id,
            actor_id: interview.organizer_id,
            action_type: 'INTERVIEW_SCHEDULED_VIA_PORTAL',
            previous_stage: 'Interview Pending',
            new_stage: 'Interview Scheduled',
            metadata: {
                interview_id,
                round: round || interview.round,
                interview_type: effectiveType,
                scheduled_at: scheduledAt.toISOString(),
                meeting_link: meetingLink,
                warnings,
            },
        })

        return new Response(JSON.stringify({
            success: true,
            meeting_link: meetingLink,
            calendar_event_id: calendarEventId,
            warnings,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('Schedule interview error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
