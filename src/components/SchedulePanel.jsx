import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Clock, Video, MapPin, Send, Plus, X, ChevronDown, ChevronUp, Users, Tag } from 'lucide-react'

const LOCATIONS = ['Lombok', 'Sumbawa', 'Bali', 'Jakarta']
const DURATIONS = [30, 45, 60, 90]

const statusStyle = {
    pending: { background: 'rgba(184,150,90,0.12)', color: '#8A6010' },
    scheduled: { background: 'rgba(74,124,116,0.12)', color: '#4A7C74' },
    completed: { background: 'rgba(74,124,116,0.2)', color: '#3a665f' },
    cancelled: { background: 'rgba(192,97,74,0.12)', color: '#C0614A' },
}

const typeStyle = {
    Online: { background: 'rgba(45,140,255,0.10)', color: '#2D8CFF' },
    Onsite: { background: 'rgba(184,150,90,0.12)', color: '#8A6010' },
}

export default function SchedulePanel({ app }) {
    const { user } = useAuth()
    const [interviews, setInterviews] = useState([])
    const [rounds, setRounds] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    // Form state
    const [form, setForm] = useState({
        interview_type: 'Online',
        round: '',
        interviewers: [],
        scheduled_at: '',
        duration_minutes: 60,
        meeting_link: '',
        location: '',
    })
    const [interviewerInput, setInterviewerInput] = useState('')

    useEffect(() => {
        fetchInterviews()
        fetchRounds()
    }, [])

    const fetchInterviews = async () => {
        const { data } = await supabase
            .from('interviews')
            .select('*')
            .eq('application_id', app.id)
            .order('created_at', { ascending: false })
        setInterviews(data || [])
    }

    const fetchRounds = async () => {
        const { data } = await supabase
            .from('interview_rounds')
            .select('name')
            .order('sort_order')
        setRounds((data || []).map(r => r.name))
    }

    const addInterviewer = () => {
        const val = interviewerInput.trim()
        if (val && !form.interviewers.includes(val)) {
            setForm(f => ({ ...f, interviewers: [...f.interviewers, val] }))
        }
        setInterviewerInput('')
    }

    const removeInterviewer = (name) => {
        setForm(f => ({ ...f, interviewers: f.interviewers.filter(i => i !== name) }))
    }

    const handleInterviewerKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addInterviewer()
        }
    }

    const handleSubmit = async () => {
        if (!form.round || !form.scheduled_at) return
        if (form.interview_type === 'Onsite' && !form.location) return

        setLoading(true)

        // 1. Parse date
        const scheduledAt = new Date(form.scheduled_at)
        const endAt = new Date(scheduledAt.getTime() + form.duration_minutes * 60000)

        // 2. Insert interview record
        const insertPayload = {
            application_id: app.id,
            organizer_id: user.id,
            status: 'scheduled',
            interview_type: form.interview_type,
            round: form.round,
            interviewers: form.interviewers,
            scheduled_at: scheduledAt.toISOString(),
            end_at: endAt.toISOString(),
            duration_minutes: form.duration_minutes,
            meeting_link: form.interview_type === 'Online' ? form.meeting_link : null,
            location: form.interview_type === 'Onsite' ? form.location : null,
        }

        const { data: interview, error: insertErr } = await supabase
            .from('interviews')
            .insert(insertPayload)
            .select()
            .single()

        if (insertErr) {
            console.error('Failed to create interview:', insertErr)
            setLoading(false)
            return
        }

        // 3. Auto-update stage → Interview Scheduled
        const { error: stageErr } = await supabase
            .from('applications')
            .update({ stage: 'Interview Scheduled' })
            .eq('id', app.id)

        if (stageErr) {
            console.error('Stage update failed (trigger may have blocked):', stageErr)
        }

        // 4. Log to audit ledger
        await supabase.from('application_history').insert({
            application_id: app.id,
            candidate_id: app.candidates?.id || app.candidate_id,
            role_id: app.role_id,
            actor_id: user.id,
            action_type: 'INTERVIEW_CREATED',
            previous_stage: app.stage,
            new_stage: 'Interview Scheduled',
            metadata: {
                interview_id: interview.id,
                round: form.round,
                interview_type: form.interview_type,
                interviewers: form.interviewers,
                scheduled_at: scheduledAt.toISOString(),
                location: form.location || null,
            }
        })

        // 5. Try auto-generating Zoom link via Edge Function BEFORE WhatsApp message
        let zoomLink = form.meeting_link || null
        if (form.interview_type === 'Online' && !form.meeting_link) {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
                const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
                const efResp = await fetch(`${supabaseUrl}/functions/v1/schedule-interview`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': anonKey,
                        'Authorization': `Bearer ${anonKey}`,
                    },
                    body: JSON.stringify({
                        interview_id: interview.id,
                        user_id: user.id,
                        selected_date: scheduledAt.toISOString().split('T')[0],
                        selected_slot: `${scheduledAt.getHours().toString().padStart(2, '0')}:${scheduledAt.getMinutes().toString().padStart(2, '0')}`,
                        interview_type: form.interview_type,
                        round: form.round,
                        interviewers: form.interviewers,
                    }),
                })
                if (efResp.ok) {
                    const efData = await efResp.json()
                    console.log('[DEBUG] schedule-interview response:', efData)
                    if (efData?.meeting_link) zoomLink = efData.meeting_link
                } else {
                    const errText = await efResp.text()
                    console.error('[DEBUG] schedule-interview failed:', efResp.status, errText)
                }
            } catch (efErr) {
                console.warn('Zoom link generation skipped or failed:', efErr)
            }
        }

        // 6. Open WhatsApp to notify candidate (now includes Zoom link if generated)
        const raw = app.candidates?.whatsapp || ''
        let number = raw.replace(/[\s\-\(\)]/g, '')
        if (number.startsWith('0')) number = '62' + number.slice(1)
        if (number.startsWith('+')) number = number.slice(1)

        if (number) {
            const typeLabel = form.interview_type === 'Online'
                ? `(Online via Zoom)`
                : `(Onsite at ${form.location})`
            const linkLine = zoomLink ? `\nZoom Link: ${zoomLink}` : ''
            const message = `Hi ${app.candidates?.full_name}, we'd like to invite you to a ${form.round} interview for the ${app.roles?.title} position ${typeLabel}.\n\nDate: ${scheduledAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\nTime: ${scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\nDuration: ${form.duration_minutes} minutes${linkLine}\n\nPlease confirm your attendance. Thank you!`
            window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')
        }

        // 7. Reset form
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        setForm({
            interview_type: 'Online', round: '', interviewers: [],
            scheduled_at: '', duration_minutes: 60, meeting_link: '', location: '',
        })
        setShowForm(false)
        setLoading(false)
        fetchInterviews()
    }

    const cancelInterview = async (inv) => {
        await supabase.from('interviews').update({ status: 'cancelled' }).eq('id', inv.id)

        await supabase.from('application_history').insert({
            application_id: app.id,
            candidate_id: app.candidates?.id || app.candidate_id,
            role_id: app.role_id,
            actor_id: user.id,
            action_type: 'INTERVIEW_CANCELLED',
            previous_stage: app.stage,
            new_stage: app.stage,
            metadata: {
                interview_id: inv.id,
                round: inv.round,
                cancelled_at: new Date().toISOString(),
            }
        })

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

            {/* Success toast */}
            {success && (
                <div style={{
                    background: 'rgba(74,124,116,0.12)', color: '#4A7C74',
                    padding: '10px 14px', borderRadius: 8, fontSize: 12.5,
                    fontWeight: 500, marginBottom: 16,
                }}>
                    ✓ Interview scheduled successfully. WhatsApp notification sent.
                </div>
            )}

            {/* ── Interview History ── */}
            {interviews.length > 0 && (
                <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {interviews.map(inv => (
                        <div key={inv.id} style={{
                            padding: 14, border: '1px solid var(--sand-dark)',
                            borderRadius: 10, background: 'var(--sand-light)',
                        }}>
                            {/* Top row: status + round + type */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                <span className="tag" style={statusStyle[inv.status]}>
                                    {inv.status?.toUpperCase()}
                                </span>
                                {inv.round && (
                                    <span className="tag" style={{ background: 'rgba(0,0,0,0.05)', color: 'var(--charcoal)' }}>
                                        {inv.round}
                                    </span>
                                )}
                                <span className="tag" style={typeStyle[inv.interview_type] || {}}>
                                    {inv.interview_type === 'Online' ? '🎥 Online' : '📍 Onsite'}
                                </span>
                            </div>

                            {/* Date & time */}
                            <div style={{ fontSize: 13, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Calendar size={13} color="var(--stone)" />
                                {inv.scheduled_at
                                    ? `${new Date(inv.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${new Date(inv.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : 'Awaiting scheduling'}
                            </div>

                            {/* Duration */}
                            <div style={{ fontSize: 12, color: 'var(--stone)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Clock size={12} color="var(--stone)" />
                                {inv.duration_minutes} min
                            </div>

                            {/* Interviewers */}
                            {inv.interviewers && inv.interviewers.length > 0 && (
                                <div style={{ fontSize: 12, color: 'var(--stone)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Users size={12} color="var(--stone)" />
                                    {inv.interviewers.join(', ')}
                                </div>
                            )}

                            {/* Meeting link or location */}
                            {inv.interview_type === 'Online' && inv.meeting_link && (
                                <div style={{ marginTop: 6 }}>
                                    <a href={inv.meeting_link} target="_blank" rel="noopener noreferrer"
                                        className="btn btn-sm btn-ghost" style={{ display: 'inline-flex', gap: 5, fontSize: 11.5 }}>
                                        <Video size={13} /> Join Meeting
                                    </a>
                                </div>
                            )}
                            {inv.interview_type === 'Onsite' && inv.location && (
                                <div style={{ fontSize: 12, color: 'var(--stone)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    <MapPin size={12} color="var(--stone)" />
                                    {inv.location}
                                </div>
                            )}

                            {/* Cancel action */}
                            {(inv.status === 'scheduled' || inv.status === 'pending') && (
                                <div style={{ marginTop: 8, borderTop: '1px solid var(--sand-dark)', paddingTop: 8 }}>
                                    <button
                                        onClick={() => { if (window.confirm('Cancel this interview?')) cancelInterview(inv) }}
                                        className="btn btn-sm btn-ghost"
                                        style={{ fontSize: 11, color: 'var(--alert)' }}
                                    >
                                        Cancel Interview
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── New Interview Form Toggle ── */}
            <button
                onClick={() => setShowForm(!showForm)}
                className="btn btn-ghost"
                style={{
                    width: '100%', display: 'flex', justifyContent: 'center',
                    gap: 6, marginBottom: showForm ? 16 : 0,
                    border: '1px dashed var(--sand-dark)',
                }}
            >
                {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
                {showForm ? 'Collapse' : 'Schedule New Interview'}
            </button>

            {/* ── New Interview Form ── */}
            {showForm && (
                <div style={{
                    padding: 16, border: '1px solid var(--sand-dark)',
                    borderRadius: 12, background: 'white',
                }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 14 }}>
                        New Interview
                    </h4>

                    {/* Interview Type — Radio toggle */}
                    <div className="form-group">
                        <label className="form-label">Interview Type *</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {['Online', 'Onsite'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, interview_type: t, meeting_link: '', location: '' }))}
                                    className={`btn btn-sm ${form.interview_type === t ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ flex: 1 }}
                                >
                                    {t === 'Online' ? '🎥' : '📍'} {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Round */}
                    <div className="form-group">
                        <label className="form-label">Interview Round *</label>
                        <select
                            value={form.round}
                            onChange={e => setForm(f => ({ ...f, round: e.target.value }))}
                            className="form-control"
                        >
                            <option value="">— Select Round —</option>
                            {rounds.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Interviewers — Tag input */}
                    <div className="form-group">
                        <label className="form-label">Interviewer(s)</label>
                        {form.interviewers.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                {form.interviewers.map(name => (
                                    <span key={name} className="tag" style={{
                                        background: 'rgba(74,124,116,0.10)',
                                        color: '#4A7C74',
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                    }}>
                                        {name}
                                        <button
                                            type="button"
                                            onClick={() => removeInterviewer(name)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A7C74', padding: 0, display: 'flex' }}
                                        >
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <input
                            value={interviewerInput}
                            onChange={e => setInterviewerInput(e.target.value)}
                            onKeyDown={handleInterviewerKeyDown}
                            onBlur={addInterviewer}
                            className="form-control"
                            placeholder="Type name or email, press Enter to add"
                        />
                        <p className="form-hint" style={{ marginTop: 4 }}>
                            Supports external stakeholders — no ATS login required.
                        </p>
                    </div>

                    {/* Date & Time */}
                    <div className="form-group">
                        <label className="form-label">Date & Time *</label>
                        <input
                            type="datetime-local"
                            value={form.scheduled_at}
                            onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                            className="form-control"
                        />
                    </div>

                    {/* Duration */}
                    <div className="form-group">
                        <label className="form-label">Duration</label>
                        <select
                            value={form.duration_minutes}
                            onChange={e => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                            className="form-control"
                        >
                            {DURATIONS.map(d => <option key={d} value={d}>{d} Minutes</option>)}
                        </select>
                    </div>

                    {/* Conditional: Meeting Link (Online) */}
                    {form.interview_type === 'Online' && (
                        <div className="form-group">
                            <label className="form-label">
                                Meeting Link
                                <span style={{ fontWeight: 400, color: 'var(--stone)', marginLeft: 6, fontSize: 11 }}>
                                    — auto-generated if Zoom is connected
                                </span>
                            </label>
                            <input
                                value={form.meeting_link}
                                onChange={e => setForm(f => ({ ...f, meeting_link: e.target.value }))}
                                className="form-control"
                                placeholder="https://zoom.us/j/..."
                            />
                        </div>
                    )}

                    {/* Conditional: Location (Onsite) */}
                    {form.interview_type === 'Onsite' && (
                        <div className="form-group">
                            <label className="form-label">Location *</label>
                            <select
                                value={form.location}
                                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                                className="form-control"
                            >
                                <option value="">— Select Hub —</option>
                                {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !form.round || !form.scheduled_at || (form.interview_type === 'Onsite' && !form.location)}
                        className="btn btn-primary"
                        style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}
                    >
                        <Send size={14} />
                        {loading ? 'Scheduling...' : 'Schedule & Notify via WA'}
                    </button>

                    {!app.candidates?.whatsapp && (
                        <p style={{ fontSize: 11, color: 'var(--alert)', marginTop: 8, textAlign: 'center' }}>
                            ⚠ Candidate missing WhatsApp number — notification will be skipped.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
