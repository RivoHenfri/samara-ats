import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Send, Pencil, Check } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import CVSourcePanel from './CVSourcePanel'
import ScreeningQuestions from './ScreeningQuestions'
import CompatibilityScore from './CompatibilityScore'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']
const ORIGINS = ['Lombok Local', 'Indonesian (Non-Lombok)', 'International']

const stageClass = {
  New: 'stage-new',
  Screening: 'stage-screening',
  Interview: 'stage-interview',
  Offer: 'stage-offer',
  Hired: 'stage-hired',
  Rejected: 'stage-rejected',
}

function formatIDR(value) {
  const num = value.replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}
function parseIDR(formatted) {
  return (formatted || '').replace(/\./g, '').replace(/,/g, '')
}
function displayIDR(num) {
  if (!num) return '—'
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

export default function CandidateDetail({ app, onClose, onUpdated }) {
  const { isManager } = useAuth()
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [roles, setRoles] = useState([])
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('notes') // 'notes' | 'screening' | 'score'
  const [latestScore, setLatestScore] = useState(null)

  const [editData, setEditData] = useState({
    role_id: app?.role_id || '',
    stage: app?.stage || '',
    whatsapp: app?.candidates?.whatsapp || '',
    origin: app?.candidates?.origin || '',
    current_salary: app?.candidates?.current_salary
      ? parseInt(app.candidates.current_salary).toLocaleString('id-ID') : '',
    expected_salary: app?.candidates?.expected_salary
      ? parseInt(app.candidates.expected_salary).toLocaleString('id-ID') : '',
  })

  useEffect(() => {
    if (app) { fetchNotes(); fetchRoles(); fetchLatestScore() }
  }, [app])

  // ── Real-time subscriptions ─────────────────────────────────────
  useEffect(() => {
    if (!app) return

    // 1. Keep notes live for all collaborators viewing the same candidate
    const notesChannel = supabase
      .channel(`notes-${app.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `application_id=eq.${app.id}` },
        () => { fetchNotes() }
      )
      .subscribe()

    // 2. Notify parent when someone updates this application remotely
    const appChannel = supabase
      .channel(`application-detail-${app.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${app.id}` },
        () => { onUpdated?.() }
      )
      .subscribe()

    return () => {
      notesChannel.unsubscribe()
      appChannel.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id])

  const fetchLatestScore = async () => {
    const { data } = await supabase
      .from('application_scores')
      .select('overall_score')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLatestScore(data?.overall_score ?? null)
  }

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes').select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('id, title, department').order('title')
    setRoles(data || [])
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    await supabase.from('notes').insert({
      application_id: app.id,
      content: newNote.trim(),
      created_by: 'Satya',
    })
    setNewNote('')
    await fetchNotes()
    setSaving(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote()
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    try {
      await supabase.from('applications')
        .update({ stage: editData.stage, role_id: editData.role_id })
        .eq('id', app.id)
      await supabase.from('candidates').update({
        whatsapp: editData.whatsapp,
        origin: editData.origin,
        current_salary: editData.current_salary ? parseInt(parseIDR(editData.current_salary)) : null,
        expected_salary: editData.expected_salary ? parseInt(parseIDR(editData.expected_salary)) : null,
      }).eq('id', app.candidates?.id)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      setEditMode(false)
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSavingEdit(false)
  }

  if (!app) return null

  const candidate = app.candidates
  const role = app.roles
  const isLombok = candidate?.origin === 'Lombok Local'

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 520 }}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="modal-title">{candidate?.full_name}</h2>
            {!editMode && (
              <>
                <p style={{ fontSize: 12, color: 'var(--stone)', marginTop: 2 }}>
                  {role?.title} · {role?.department}
                </p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <span className={`stage-badge ${stageClass[app.stage] ?? 'stage-new'}`}>
                    {app.stage}
                  </span>
                  <span className={`tag ${isLombok ? 'tag-lombok' : 'tag-src'}`}>
                    {isLombok ? '🌴 Lombok Local' : '📍 Outside Lombok'}
                  </span>
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setEditMode(!editMode)}
              style={{
                width: 30, height: 30,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${editMode ? 'var(--gold)' : 'var(--sand-dark)'}`,
                borderRadius: 5,
                background: editMode ? 'var(--gold-bg)' : 'none',
                cursor: 'pointer',
                color: editMode ? 'var(--gold)' : 'var(--stone)',
                transition: '0.15s',
              }}
            >
              <Pencil size={14} />
            </button>
            <button className="modal-close" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Edit section ── */}
        {editMode ? (
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--sand-dark)',
            maxHeight: '52vh', overflowY: 'auto',
          }}>
            {/* Role */}
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={editData.role_id}
                onChange={e => setEditData(d => ({ ...d, role_id: e.target.value }))}
                className="form-control"
              >
                <option value="">— Select Role —</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.title} ({r.department})</option>
                ))}
              </select>
            </div>
            {/* Stage */}
            <div className="form-group">
              <label className="form-label">Stage</label>
              <select
                value={editData.stage}
                onChange={e => setEditData(d => ({ ...d, stage: e.target.value }))}
                className="form-control"
              >
                {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* Origin */}
            <div className="form-group">
              <label className="form-label">Origin</label>
              <select
                value={editData.origin}
                onChange={e => setEditData(d => ({ ...d, origin: e.target.value }))}
                className="form-control"
              >
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {/* WhatsApp */}
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <input
                value={editData.whatsapp}
                onChange={e => setEditData(d => ({ ...d, whatsapp: e.target.value }))}
                className="form-control mono"
                placeholder="08123456789"
              />
            </div>
            {/* Salary */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Current Salary</label>
                <input
                  value={editData.current_salary}
                  onChange={e => setEditData(d => ({ ...d, current_salary: formatIDR(e.target.value) }))}
                  className="form-control mono"
                  placeholder="5.000.000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Salary</label>
                <input
                  value={editData.expected_salary}
                  onChange={e => setEditData(d => ({ ...d, expected_salary: formatIDR(e.target.value) }))}
                  className="form-control mono"
                  placeholder="7.000.000"
                />
              </div>
            </div>
            {/* Save */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEdit} disabled={savingEdit} className="btn btn-primary btn-sm">
                <Check size={13} />
                {savingEdit ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Changes'}
              </button>
              <button onClick={() => setEditMode(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        ) : (
          /* ── Read-only info grid ── */
          <div style={{
            padding: '14px 22px',
            borderBottom: '1px solid var(--sand-dark)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px 20px',
          }}>
            <InfoRow label="WhatsApp" value={<span style={{ fontFamily: 'monospace' }}>{candidate?.whatsapp || '—'}</span>} />
            <InfoRow label="Applied" value={format(new Date(app.created_at), 'dd MMM yyyy')} />
            <InfoRow label="Current Salary" value={displayIDR(candidate?.current_salary)} />
            <InfoRow label="Expected Salary" value={displayIDR(candidate?.expected_salary)} />
          </div>
        )}

        {/* ── CV Source ── */}
        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--sand-dark)' }}>
          <p style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 10,
          }}>
            CV
          </p>
          <CVSourcePanel candidateId={candidate?.id} canEdit={isManager} />
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--sand-dark)',
          padding: '0 22px',
        }}>
          {[
            { key: 'notes', label: `Notes (${notes.length})` },
            { key: 'screening', label: 'Screening Questions' },
            { key: 'score', label: latestScore != null ? `AI Score · ${latestScore}` : 'AI Score' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 14px',
                fontSize: 11.5,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--gold)' : 'var(--stone)',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer', marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Notes tab ── */}
        {activeTab === 'notes' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px', maxHeight: '30vh' }}>
              <p style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: 'var(--stone)',
                marginBottom: 12,
              }}>
                Notes ({notes.length})
              </p>
              {notes.length === 0 ? (
                <p style={{ color: 'var(--stone-light)', fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>
                  No notes yet. Add the first one below.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {notes.map(note => (
                    <div key={note.id} style={{
                      background: 'var(--sand-light)',
                      border: '1px solid var(--sand-dark)',
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <p style={{ fontSize: 12.5, color: 'var(--charcoal)', lineHeight: 1.55 }}>
                        {note.content}
                      </p>
                      <p style={{ fontSize: 10.5, color: 'var(--stone-light)', marginTop: 5 }}>
                        {note.created_by} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add note */}
            <div style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--sand-dark)',
              background: 'var(--sand-light)',
            }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a note… (Ctrl+Enter to save)"
                  rows={2}
                  className="form-control"
                  style={{ resize: 'none', flex: 1 }}
                />
                <button
                  onClick={addNote}
                  disabled={saving || !newNote.trim()}
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-end' }}
                >
                  <Send size={13} />
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: 'var(--stone-light)', marginTop: 5 }}>
                Ctrl+Enter to save quickly
              </p>
            </div>
          </>
        )}

        {/* ── Screening Questions tab ── */}
        {activeTab === 'screening' && (
          <ScreeningQuestions app={app} />
        )}

        {/* ── AI Score tab ── */}
        {activeTab === 'score' && (
          <CompatibilityScore app={app} onScored={(score) => setLatestScore(score)} />
        )}

      </div>
    </div>
  )
}

// ── Small helper ──────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div>
      <p className="form-label" style={{ marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12.5, color: 'var(--charcoal)' }}>{value}</p>
    </div>
  )
}
