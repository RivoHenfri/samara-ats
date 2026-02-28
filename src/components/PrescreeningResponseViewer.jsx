/**
 * PrescreeningResponseViewer.jsx
 *
 * Read-only display of prescreening form responses for a candidate.
 * Used in CandidateDetail tabs and CandidateBrief sections.
 *
 * Shows:
 * - Form status badge (pending/sent/started/completed/expired)
 * - If completed: all responses in a clean read-only format
 * - If not sent: "Send Prescreening Form" button
 * - If sent but not completed: "Resend" option + time elapsed
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { autoPreparePrescreen } from '../lib/aiWorkflow'
import {
  Loader2, Clock, CheckCircle, AlertTriangle, Send,
  Copy, Check, ExternalLink, RefreshCw,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const statusConfig = {
  not_sent:   { label: 'Not Sent',   color: '#9A8F80', bg: 'rgba(154,143,128,0.1)' },
  pending:    { label: 'Pending',    color: '#B8860B', bg: 'rgba(184,134,11,0.08)' },
  sent:       { label: 'Sent',       color: '#4A7C74', bg: 'rgba(74,124,116,0.08)' },
  started:    { label: 'In Progress',color: '#B8860B', bg: 'rgba(184,134,11,0.08)' },
  completed:  { label: 'Completed',  color: '#4A7C74', bg: 'rgba(74,124,116,0.12)' },
  expired:    { label: 'Expired',    color: '#C0614A', bg: 'rgba(192,97,74,0.08)' },
}

function displayIDR(num) {
  if (!num) return '—'
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

export default function PrescreeningResponseViewer({ app, compact = false }) {
  const [response, setResponse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [preparing, setPreparing] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('prescreening_responses')
        .select('*')
        .eq('application_id', app.id)
        .maybeSingle()

      setResponse(data)
      setLoading(false)
    }
    load()
  }, [app.id])

  const handlePrepare = async () => {
    setPreparing(true)
    const result = await autoPreparePrescreen(app.id)
    if (result) {
      // Reload response data
      const { data } = await supabase
        .from('prescreening_responses')
        .select('*')
        .eq('application_id', app.id)
        .maybeSingle()
      setResponse(data)
    }
    setPreparing(false)
  }

  const handleCopyLink = async () => {
    if (!response?.access_token) return
    const url = `${window.location.origin}/prescreening/${response.access_token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--stone)' }}>
        <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const status = response?.status || 'not_sent'
  const sc = statusConfig[status]
  const template = response?.template_snapshot || {}

  // ── Not sent / No response yet ──────────────────────────────────────
  if (!response) {
    return (
      <div style={{ padding: '20px 22px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        }}>
          <span style={{ ...badgeStyle, color: sc.color, background: sc.bg }}>{sc.label}</span>
          <span style={{ fontSize: 12, color: 'var(--stone)' }}>
            No prescreening form has been sent for this candidate.
          </span>
        </div>
        <button
          onClick={handlePrepare}
          disabled={preparing}
          className="btn btn-primary"
          style={{ fontSize: 12, padding: '7px 16px', gap: 6 }}
        >
          {preparing
            ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Preparing…</>
            : <><Send size={13} />Prepare Prescreening Form</>}
        </button>
      </div>
    )
  }

  // ── Sent but not completed ──────────────────────────────────────────
  if (status !== 'completed') {
    return (
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ ...badgeStyle, color: sc.color, background: sc.bg }}>{sc.label}</span>
          {response.sent_at && (
            <span style={{ fontSize: 11.5, color: 'var(--stone)' }}>
              Sent {formatDistanceToNow(new Date(response.sent_at), { addSuffix: true })}
            </span>
          )}
          {status === 'started' && response.started_at && (
            <span style={{ fontSize: 11.5, color: 'var(--stone)' }}>
              · Opened {formatDistanceToNow(new Date(response.started_at), { addSuffix: true })}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleCopyLink} className="btn btn-ghost" style={{ fontSize: 11.5, padding: '5px 12px', gap: 5 }}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy Form Link'}
          </button>
          <a
            href={`/prescreening/${response.access_token}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ fontSize: 11.5, padding: '5px 12px', gap: 5, textDecoration: 'none' }}
          >
            <ExternalLink size={12} /> Preview Form
          </a>
        </div>
      </div>
    )
  }

  // ── Completed: Show responses ───────────────────────────────────────
  const responses = response.responses || {}
  const fixedFields = (template.fixed_fields || []).filter(f => f.enabled !== false)
  const customQuestions = template.custom_questions || []

  return (
    <div style={{ padding: compact ? '12px 0' : '16px 22px' }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ ...badgeStyle, color: sc.color, background: sc.bg }}>
            <CheckCircle size={10} style={{ marginRight: 3 }} />{sc.label}
          </span>
          {response.completed_at && (
            <span style={{ fontSize: 11.5, color: 'var(--stone)' }}>
              Submitted {formatDistanceToNow(new Date(response.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      )}

      {/* Fixed fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fixedFields.map(field => {
          const val = responses[field.field_key]
          const detail = responses[`${field.field_key}_detail`]

          let displayVal = val || '—'
          if (field.type === 'currency' && val) {
            displayVal = displayIDR(val)
          } else if (field.type === 'yes_no_detail') {
            displayVal = val === 'yes' ? `Yes — ${detail || '(no details)'}` : val === 'no' ? 'No' : '—'
          } else if (field.type === 'mbti' && val) {
            displayVal = val.toUpperCase()
          }

          return (
            <div key={field.field_key} style={rowStyle}>
              <span style={labelStyle}>{field.label}</span>
              <span style={valueStyle}>{displayVal}</span>
            </div>
          )
        })}

        {/* Custom questions */}
        {customQuestions.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--sand-dark)', margin: '6px 0', paddingTop: 10 }}>
              <p style={{
                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
                color: 'var(--stone)', fontWeight: 700, margin: '0 0 8px',
              }}>
                Technical / Case-Study Responses
              </p>
            </div>
            {customQuestions.map((q, i) => (
              <div key={i} style={rowStyle}>
                <span style={labelStyle}>{q.question}</span>
                <span style={{ ...valueStyle, whiteSpace: 'pre-wrap' }}>
                  {responses[`custom_q_${i}`] || '—'}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const badgeStyle = {
  display: 'inline-flex', alignItems: 'center',
  fontSize: 11, fontWeight: 600,
  padding: '2px 8px', borderRadius: 4,
}

const rowStyle = {
  display: 'flex', flexDirection: 'column', gap: 2,
}

const labelStyle = {
  fontSize: 11, fontWeight: 600, color: 'var(--stone)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}

const valueStyle = {
  fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.5,
}
