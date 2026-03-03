/**
 * RoleSummaryPage.jsx
 *
 * In-app summary table for a single role listing all candidates with:
 *  - Prescreening status
 *  - Screening verdict (inline-editable)
 *  - Screening comment (inline-editable)
 *  - AI score + AI comment
 *  - Clickable link to Candidate Brief
 *
 * Route: /roles/:roleId/summary
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { exportRoleSummary } from '../lib/exportRoleSummary'
import {
  ArrowLeft, Download, Loader2, Check, X, Pencil, FileText, ExternalLink,
} from 'lucide-react'

// ── Constants ────────────────────────────────────────────────────────────────

const VERDICT_OPTIONS = [
  { value: '', label: '— No Verdict —' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'passed_with_concern', label: 'Passed with concern' },
]

const VERDICT_STYLES = {
  passed: { background: 'rgba(74,124,116,0.12)', color: '#4A7C74' },
  failed: { background: 'rgba(192,97,74,0.12)', color: '#C0614A' },
  passed_with_concern: { background: 'rgba(184,150,90,0.12)', color: '#8A6010' },
}

const VERDICT_LABELS = {
  passed: 'Passed',
  failed: 'Failed',
  passed_with_concern: 'Passed with concern',
}

const PRESCREEN_LABELS = {
  not_sent: 'Not Sent',
  pending: 'Pending',
  sent: 'Sent',
  started: 'In Progress',
  completed: 'Completed',
  expired: 'Expired',
}

const PRESCREEN_STYLES = {
  not_sent: { background: 'rgba(154,143,128,0.10)', color: '#9A8F80' },
  pending: { background: 'rgba(184,150,90,0.10)', color: '#8A6010' },
  sent: { background: 'rgba(74,124,116,0.10)', color: '#4A7C74' },
  started: { background: 'rgba(74,124,116,0.15)', color: '#4A7C74' },
  completed: { background: 'rgba(74,124,116,0.20)', color: '#2F5B54' },
  expired: { background: 'rgba(192,97,74,0.10)', color: '#C0614A' },
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RoleSummaryPage() {
  const { roleId } = useParams()
  const navigate = useNavigate()

  const [role, setRole] = useState(null)
  const [applications, setApplications] = useState([])
  const [scores, setScores] = useState({})          // appId → { overall_score, executive_summary }
  const [loading, setLoading] = useState(true)

  // Inline editing state
  const [editingId, setEditingId] = useState(null)   // application.id being edited
  const [editVerdict, setEditVerdict] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)

  const [exporting, setExporting] = useState(false)

  // ── Fetch role ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('roles').select('*').eq('id', roleId).single()
      .then(({ data }) => setRole(data))
  }, [roleId])

  // ── Fetch applications + scores ──────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data: apps } = await supabase
      .from('applications')
      .select('*, candidates!inner(*)')
      .eq('role_id', roleId)
      .order('created_at', { ascending: false })

    setApplications(apps || [])

    // Batch-fetch latest scores
    if (apps?.length > 0) {
      const appIds = apps.map(a => a.id)
      const { data: scoreRows } = await supabase
        .from('application_scores')
        .select('application_id, overall_score, executive_summary, created_at')
        .in('application_id', appIds)
        .order('created_at', { ascending: false })

      const scoreMap = {}
      for (const row of (scoreRows || [])) {
        if (!(row.application_id in scoreMap)) {
          scoreMap[row.application_id] = {
            overall_score: row.overall_score,
            executive_summary: row.executive_summary,
          }
        }
      }
      setScores(scoreMap)
    }

    setLoading(false)
  }, [roleId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Inline edit handlers ─────────────────────────────────────────────────
  const startEdit = (app) => {
    setEditingId(app.id)
    setEditVerdict(app.screening_verdict || '')
    setEditComment(app.screening_comment || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('applications').update({
      screening_verdict: editVerdict || null,
      screening_comment: editComment || null,
    }).eq('id', editingId)

    // Optimistically update local state
    setApplications(prev =>
      prev.map(a => a.id === editingId
        ? { ...a, screening_verdict: editVerdict || null, screening_comment: editComment || null }
        : a
      )
    )
    setEditingId(null)
    setSaving(false)
  }

  // ── Export handler ───────────────────────────────────────────────────────
  const handleExport = () => {
    setExporting(true)
    try {
      const enriched = applications.map(app => ({
        ...app,
        score: scores[app.id]?.overall_score ?? null,
        aiComment: scores[app.id]?.executive_summary ?? '',
      }))
      exportRoleSummary(role?.title || 'Role', enriched)
    } catch (err) {
      console.error('[RoleSummaryPage] Export failed:', err)
    }
    setExporting(false)
  }

  // ── Score color helper ───────────────────────────────────────────────────
  const scoreColor = (score) => {
    if (score == null) return '#9A8F80'
    if (score >= 8) return '#4A7C74'
    if (score >= 6) return '#8A6010'
    return '#C0614A'
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '0 28px 40px', flex: 1, overflowY: 'auto' }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 0 16px', borderBottom: '1px solid var(--sand-dark)', marginBottom: 20,
        position: 'sticky', top: 0, background: 'var(--sand-light)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/roles')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 6,
              border: '1px solid var(--sand-dark)', background: 'white', cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>
              {role?.title || 'Loading…'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--stone)', margin: '2px 0 0' }}>
              {role?.department} · {applications.length} candidate{applications.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting || loading || applications.length === 0}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {exporting
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Download size={14} />}
          Export to Excel
        </button>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--teal)' }} />
          <p style={{ marginTop: 10, color: 'var(--stone)', fontSize: 13 }}>Loading candidates…</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && applications.length === 0 && (
        <div className="empty-state" style={{ padding: 60 }}>
          No candidates found for this role.
        </div>
      )}

      {/* ── Data table ── */}
      {!loading && applications.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Candidate</th>
                <th style={{ width: '10%' }}>Prescreen</th>
                <th style={{ width: '13%' }}>Verdict</th>
                <th style={{ width: '25%' }}>Screening Comment</th>
                <th style={{ width: '6%', textAlign: 'center' }}>Score</th>
                <th style={{ width: '22%' }}>AI Comment</th>
                <th style={{ width: '6%', textAlign: 'center' }}>Brief</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => {
                const isEditing = editingId === app.id
                const score = scores[app.id]?.overall_score
                const aiComment = scores[app.id]?.executive_summary || ''
                const prescreenStatus = app.prescreening_status || 'not_sent'

                return (
                  <tr key={app.id} style={{
                    background: isEditing ? 'rgba(74,124,116,0.03)' : undefined,
                  }}>
                    {/* Name */}
                    <td>
                      <button
                        onClick={() => window.open(`/candidates/${app.id}/brief`, '_blank')}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--charcoal)', fontWeight: 600, fontSize: 12.5,
                          padding: 0, textAlign: 'left', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--teal)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--charcoal)'}
                      >
                        {app.candidates?.full_name || '—'}
                      </button>
                      <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 1 }}>
                        {app.stage}
                      </div>
                    </td>

                    {/* Prescreen Status */}
                    <td>
                      <span className="tag" style={{
                        fontSize: 10.5, fontWeight: 600, padding: '2px 7px',
                        borderRadius: 4,
                        ...(PRESCREEN_STYLES[prescreenStatus] || PRESCREEN_STYLES.not_sent),
                      }}>
                        {PRESCREEN_LABELS[prescreenStatus] || prescreenStatus}
                      </span>
                    </td>

                    {/* Verdict (editable) */}
                    <td>
                      {isEditing ? (
                        <select
                          value={editVerdict}
                          onChange={e => setEditVerdict(e.target.value)}
                          style={{
                            fontSize: 12, padding: '4px 8px', borderRadius: 5,
                            border: '1px solid var(--sand-dark)', fontFamily: 'inherit',
                            width: '100%', background: 'white',
                          }}
                        >
                          {VERDICT_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={() => startEdit(app)}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}
                        >
                          {app.screening_verdict ? (
                            <span className="tag" style={{
                              fontSize: 10.5, fontWeight: 600, padding: '2px 7px',
                              borderRadius: 4,
                              ...(VERDICT_STYLES[app.screening_verdict] || {}),
                            }}>
                              {VERDICT_LABELS[app.screening_verdict] || app.screening_verdict}
                            </span>
                          ) : (
                            <span style={{
                              fontSize: 11, color: 'var(--stone)', fontStyle: 'italic',
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                            }}>
                              <Pencil size={10} /> Set verdict
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    {/* Screening Comment (editable) */}
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea
                            value={editComment}
                            onChange={e => setEditComment(e.target.value)}
                            rows={3}
                            style={{
                              fontSize: 12, padding: '6px 8px', borderRadius: 5,
                              border: '1px solid var(--sand-dark)', fontFamily: 'inherit',
                              resize: 'vertical', width: '100%', lineHeight: 1.4,
                            }}
                            placeholder="Screening notes…"
                          />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={saveEdit}
                              disabled={saving}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                background: 'var(--teal)', color: 'white', border: 'none',
                                borderRadius: 4, padding: '3px 10px', fontSize: 11,
                                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                                opacity: saving ? 0.6 : 1,
                              }}
                            >
                              <Check size={11} /> Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                background: 'none', color: 'var(--stone)', border: '1px solid var(--sand-dark)',
                                borderRadius: 4, padding: '3px 10px', fontSize: 11,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => startEdit(app)}
                          style={{
                            cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)',
                            lineHeight: 1.45, minHeight: 20,
                            display: '-webkit-box', WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}
                        >
                          {app.screening_comment || (
                            <span style={{ color: 'var(--stone)', fontStyle: 'italic', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Pencil size={10} /> Add comment
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* AI Score */}
                    <td style={{ textAlign: 'center' }}>
                      {score != null ? (
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: scoreColor(score),
                        }}>
                          {score}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--stone)', fontSize: 11 }}>—</span>
                      )}
                    </td>

                    {/* AI Comment */}
                    <td>
                      <ExpandableText text={aiComment} maxLines={3} />
                    </td>

                    {/* Brief link */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => window.open(`/candidates/${app.id}/brief`, '_blank')}
                        title="Open Candidate Brief"
                        style={{
                          background: 'none', border: '1px solid var(--sand-dark)',
                          borderRadius: 5, padding: '4px 8px', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          color: 'var(--teal)', fontSize: 11, fontWeight: 500,
                          fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,124,116,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <FileText size={12} />
                        <ExternalLink size={10} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Expandable text helper ───────────────────────────────────────────────────

function ExpandableText({ text, maxLines = 3 }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return <span style={{ color: 'var(--stone)', fontSize: 11 }}>—</span>

  return (
    <div>
      <div style={{
        fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.45,
        ...(expanded ? {} : {
          display: '-webkit-box', WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }),
      }}>
        {text}
      </div>
      {text.length > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--teal)', fontSize: 10.5, fontWeight: 600,
            padding: '2px 0 0', fontFamily: 'inherit',
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}
