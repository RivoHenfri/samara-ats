import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, formatDistanceToNow } from 'date-fns'
import { X, ArrowRight, Plus, Clock } from 'lucide-react'
import { STAGE_COLORS } from '../lib/constants'

/**
 * CandidateTimeline — Reusable vertical timeline component.
 * Queries application_history for a given applicationId and renders
 * a chronological list of stage transitions.
 *
 * @param {{ applicationId: string, onClose?: () => void }} props
 */
export default function CandidateTimeline({ applicationId, onClose }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!applicationId) return
    fetchTimeline()
  }, [applicationId])

  const fetchTimeline = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('application_history')
      .select('id, action_type, previous_stage, new_stage, metadata, created_at')
      .eq('application_id', applicationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching timeline:', error)
    } else {
      setEvents(data || [])
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <span className="spinner" /> Loading timeline...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>Application Timeline</h3>
            <button onClick={onClose} className="modal-close"><X size={14} /></button>
          </div>
        )}
        <p style={{ fontSize: 12, color: 'var(--stone)', textAlign: 'center', padding: '20px 0' }}>
          No history events recorded for this application.
        </p>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {onClose && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>Application Timeline</h3>
          <button onClick={onClose} className="modal-close"><X size={14} /></button>
        </div>
      )}

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        {/* Vertical line */}
        <div style={{
          position: 'absolute', left: 7, top: 4, bottom: 4,
          width: 2, background: 'var(--sand-dark)',
        }} />

        {events.map((event, i) => (
          <TimelineEvent key={event.id} event={event} isLast={i === events.length - 1} />
        ))}
      </div>
    </div>
  )
}

function TimelineEvent({ event, isLast }) {
  const isCreated = event.action_type === 'CREATED'
  const isStageMoved = event.action_type === 'STAGE_MOVED'
  const isBulkRejected = event.action_type === 'BULK_REJECTED'
  const isNoteAdded = event.action_type === 'NOTE_ADDED'

  const dotColor = isCreated
    ? 'var(--teal)'
    : isStageMoved
      ? (STAGE_COLORS[event.new_stage] || 'var(--stone)')
      : isBulkRejected
        ? 'var(--alert)'
        : 'var(--gold)'

  const eventDate = new Date(event.created_at)

  return (
    <div style={{ position: 'relative', paddingBottom: isLast ? 0 : 20 }}>
      {/* Dot */}
      <div style={{
        position: 'absolute', left: -20, top: 2,
        width: 12, height: 12, borderRadius: '50%',
        background: dotColor, border: '2px solid white',
        boxShadow: '0 0 0 2px var(--sand-dark)',
      }} />

      {/* Content */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {isCreated && (
            <>
              <Plus size={11} style={{ color: 'var(--teal)' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
                Application created
              </span>
            </>
          )}

          {isStageMoved && (
            <>
              <span style={{
                fontSize: 11, fontWeight: 500, color: STAGE_COLORS[event.previous_stage] || 'var(--stone)',
              }}>
                {event.previous_stage}
              </span>
              <ArrowRight size={11} style={{ color: 'var(--stone-light)' }} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: STAGE_COLORS[event.new_stage] || 'var(--stone)',
              }}>
                {event.new_stage}
              </span>
            </>
          )}

          {isBulkRejected && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--alert)' }}>
              Bulk rejected
              {event.metadata?.reason && ` — ${event.metadata.reason}`}
            </span>
          )}

          {isNoteAdded && (
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--gold)' }}>
              Note added
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--stone-light)' }}>
          <Clock size={10} />
          <span>{format(eventDate, 'dd MMM yyyy, HH:mm')}</span>
          <span style={{ color: 'var(--sand-dark)' }}>|</span>
          <span>{formatDistanceToNow(eventDate, { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  )
}
