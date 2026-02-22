import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Video, MapPin, Calendar } from 'lucide-react'

export default function TodaysInterviews() {
  const [interviews, setInterviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInterviews()
  }, [])

  const fetchInterviews = async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayAfterTomorrow = new Date(today)
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

    const { data } = await supabase
      .from('interviews')
      .select('*, applications(candidates(full_name), roles(title, department))')
      .eq('status', 'scheduled')
      .gte('scheduled_at', today.toISOString())
      .lte('scheduled_at', dayAfterTomorrow.toISOString())
      .order('scheduled_at', { ascending: true })

    setInterviews(data || [])
    setLoading(false)
  }

  if (loading) return null

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayItems = interviews.filter(i => new Date(i.scheduled_at) < tomorrow)
  const tomorrowItems = interviews.filter(i => new Date(i.scheduled_at) >= tomorrow)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Upcoming Interviews</span>
        <span style={{ fontSize: 11, color: 'var(--stone)' }}>
          {interviews.length} scheduled
        </span>
      </div>

      {interviews.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)' }}>No interviews in the next 48 hours.</p>
        </div>
      ) : (
        <div style={{ padding: '12px 16px' }}>
          {todayItems.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Today
              </div>
              {todayItems.map(i => <InterviewRow key={i.id} interview={i} />)}
            </>
          )}
          {tomorrowItems.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--stone)', marginBottom: 6, marginTop: todayItems.length > 0 ? 12 : 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Tomorrow
              </div>
              {tomorrowItems.map(i => <InterviewRow key={i.id} interview={i} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InterviewRow({ interview }) {
  const time = new Date(interview.scheduled_at).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const candidateName = interview.applications?.candidates?.full_name || 'Unknown'
  const roleTitle = interview.applications?.roles?.title || ''
  const isOnline = interview.interview_type === 'Online'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 0', borderBottom: '1px solid var(--sand-dark, #E5DED3)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', width: 42, flexShrink: 0 }}>
        {time}
      </span>
      {isOnline
        ? <Video size={13} color="var(--teal)" style={{ flexShrink: 0 }} />
        : <MapPin size={13} color="var(--gold)" style={{ flexShrink: 0 }} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
          {candidateName}
        </span>
        <span style={{ fontSize: 11, color: 'var(--stone)', marginLeft: 6 }}>
          {roleTitle}
        </span>
      </div>
      {isOnline && interview.meeting_link && (
        <a
          href={interview.meeting_link}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-sm btn-ghost"
          style={{ fontSize: 10, padding: '2px 8px' }}
          onClick={e => e.stopPropagation()}
        >
          Join
        </a>
      )}
    </div>
  )
}
