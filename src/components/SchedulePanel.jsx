import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Clock, Video, Send } from 'lucide-react'

export default function SchedulePanel({ app }) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [interviews, setInterviews] = useState([])
    const [duration, setDuration] = useState(60)

    useEffect(() => {
        fetchInterviews()
    }, [])

    const fetchInterviews = async () => {
        const { data } = await supabase
            .from('interviews')
            .select('*')
            .eq('application_id', app.id)
            .order('created_at', { ascending: false })

        setInterviews(data || [])
    }

    const generateInvite = async () => {
        setLoading(true)

        // Create interview record
        const { data: interview, error } = await supabase
            .from('interviews')
            .insert({
                application_id: app.id,
                organizer_id: user.id,
                status: 'pending',
                duration_minutes: duration
            })
            .select()
            .single()

        if (error) {
            console.error(error)
            setLoading(false)
            return
        }

        // Move to Interview Pending (using the base string 'Interview Pending' to easily trace)
        await supabase.from('applications').update({ stage: 'Interview Pending' }).eq('id', app.id)

        // Generate WhatsApp link (Mocking the WhatsApp Business API push for now)
        const raw = app.candidates?.whatsapp || ''
        let number = raw.replace(/[\s\-\(\)]/g, '')
        if (number.startsWith('0')) number = '62' + number.slice(1)
        if (number.startsWith('+')) number = number.slice(1)

        const schedulingLink = `${window.location.origin}/schedule/${interview.id}`
        const message = `Hi ${app.candidates.full_name}, we'd like to invite you to an interview for ${app.roles.title}. Please select a time that works for you here: ${schedulingLink}`

        window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')

        setSuccess(true)
        setLoading(false)
        fetchInterviews()
    }

    return (
        <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
            <p style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--stone)',
                marginBottom: 16,
            }}>
                Interview Scheduling
            </p>

            {/* Existing interviews list */}
            {interviews.length > 0 && (
                <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {interviews.map(inv => (
                        <div key={inv.id} style={{
                            padding: 16, border: '1px solid var(--sand-dark)', borderRadius: 8, background: 'var(--sand-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <span className={`tag ${inv.status === 'pending' ? 'tag-src' :
                                        inv.status === 'scheduled' ? 'tag-ops' :
                                            inv.status === 'completed' ? 'tag-hosp' : 'tag-const'
                                    }`}>
                                    {inv.status.toUpperCase()}
                                </span>
                                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {inv.scheduled_at ? (
                                        <>
                                            <Calendar size={14} color="var(--stone)" />
                                            {new Date(inv.scheduled_at).toLocaleDateString()} at {new Date(inv.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </>
                                    ) : 'Waiting for candidate to select time'}
                                </div>
                            </div>

                            {inv.meeting_link && (
                                <a href={inv.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost" style={{ display: 'flex', gap: 6 }}>
                                    <Video size={14} /> Join Now
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* New Invite Form */}
            <div style={{ padding: 16, border: '1px solid var(--sand-dark)', borderRadius: 12, background: 'white' }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 12 }}>Generate New Invite</h4>

                <div className="form-group">
                    <label className="form-label">Interview Duration</label>
                    <select
                        className="form-control"
                        value={duration}
                        onChange={e => setDuration(parseInt(e.target.value))}
                    >
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                        <option value={60}>60 Minutes</option>
                        <option value={90}>90 Minutes</option>
                    </select>
                </div>

                <button
                    onClick={generateInvite}
                    disabled={loading || !app.candidates?.whatsapp}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}
                >
                    <Send size={15} />
                    {loading ? 'Generating...' : success ? 'Invite Sent!' : 'Generate & Send via WA'}
                </button>

                {!app.candidates?.whatsapp && (
                    <p style={{ fontSize: 11, color: 'var(--alert)', marginTop: 8, textAlign: 'center' }}>
                        Candidate missing WhatsApp number.
                    </p>
                )}
            </div>
        </div>
    )
}
