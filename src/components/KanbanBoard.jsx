import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CandidateCard, { getWhatsAppMessage } from './CandidateCard'
import AddCandidateModal from './AddCandidateModal'
import { Plus } from 'lucide-react'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

// CSS class for each column
const colClass = {
  New: 'k-col-new',
  Screening: 'k-col-screening',
  Interview: 'k-col-interview',
  Offer: 'k-col-offer',
  Hired: 'k-col-hired',
  Rejected: 'k-col-rejected',
}

export default function KanbanBoard() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [lombokOnly, setLombokOnly] = useState(false)
  const [filterDept, setFilterDept] = useState('All')
  const [dragging, setDragging] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [lastSelected, setLastSelected] = useState(null)
  const [bulkMessaging, setBulkMessaging] = useState(null)

  useEffect(() => { fetchApplications() }, [])

  const fetchApplications = async () => {
    setSelectedIds([])
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(*)')
      .order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const handleDragStart = (app) => setDragging(app)

  const handleDrop = async (stage) => {
    if (!dragging || dragging.stage === stage) return
    await supabase.from('applications').update({ stage }).eq('id', dragging.id)
    setDragging(null)
    fetchApplications()
  }

  const filtered = applications.filter(app => {
    if (lombokOnly && app.candidates?.origin !== 'Lombok Local') return false
    if (filterDept !== 'All' && app.roles?.department !== filterDept) return false
    return true
  })

  const handleSelect = (app, e) => {
    e.stopPropagation && e.stopPropagation()
    const isSelected = selectedIds.includes(app.id)
    if (e.shiftKey && lastSelected) {
      const lastIdx = filtered.findIndex(a => a.id === lastSelected)
      const currIdx = filtered.findIndex(a => a.id === app.id)
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx)
        const end = Math.max(lastIdx, currIdx)
        const slice = filtered.slice(start, end + 1).map(a => a.id)
        const newSelected = new Set([...selectedIds, ...slice])
        setSelectedIds(Array.from(newSelected).slice(0, 50))
        setLastSelected(app.id)
        return
      }
    }
    if (isSelected) {
      setSelectedIds(selectedIds.filter(id => id !== app.id))
      setLastSelected(null)
    } else {
      if (selectedIds.length < 50) {
        setSelectedIds([...selectedIds, app.id])
        setLastSelected(app.id)
      } else {
        alert("You can select up to 50 candidates.")
      }
    }
  }

  const handleBulkReject = async () => {
    if (!window.confirm(`Are you sure you want to reject ${selectedIds.length} candidate(s)?`)) return
    await supabase.from('applications').update({ stage: 'Rejected' }).in('id', selectedIds)
    const appsToMessage = filtered.filter(a => selectedIds.includes(a.id) && a.candidates?.whatsapp)
    if (appsToMessage.length > 0) {
      setBulkMessaging({ apps: appsToMessage, currentIndex: 0, lang: 'id', stage: 'Rejected' })
    }
    fetchApplications()
  }

  // Count stale across all active stages
  const staleCount = applications.filter(app => {
    if (['Offer', 'Hired', 'Rejected'].includes(app.stage)) return false
    const hrs = (Date.now() - new Date(app.updated_at)) / 36e5
    return hrs > 48
  }).length

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      Loading pipeline…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">Pipeline</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Lombok First toggle */}
          <button
            onClick={() => setLombokOnly(!lombokOnly)}
            className={`btn btn-sm ${lombokOnly ? 'btn-teal' : 'btn-ghost'}`}
          >
            🌴 Lombok First
          </button>

          {/* Department filter */}
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="form-control"
            style={{ width: 'auto', padding: '5px 28px 5px 10px', fontSize: 11 }}
          >
            <option>All</option>
            <option>Hospitality</option>
            <option>Operations</option>
            <option>Construction</option>
          </select>

          {/* Add Candidate */}
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            Add Candidate
          </button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* 48h stale alert */}
        {staleCount > 0 && (
          <div className="alert-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--alert)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <strong style={{ color: 'var(--alert)' }}>{staleCount} candidate{staleCount > 1 ? 's' : ''}</strong>
              {' '}not moved in 48+ hours — action required
            </span>
          </div>
        )}

        {/* Kanban board */}
        <div className="kanban-wrap" style={{ flex: 1 }}>
          {STAGES.map(stage => {
            const cards = filtered.filter(a => a.stage === stage)
            return (
              <div
                key={stage}
                className={`k-col ${colClass[stage]}`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                {/* Column header */}
                <div className="k-col-head">
                  <span className="k-col-title">{stage}</span>
                  <span className="k-col-count"
                    style={{
                      background: stage === 'Hired' ? 'rgba(74,124,116,0.18)' :
                        stage === 'Rejected' ? 'rgba(192,97,74,0.12)' :
                          'rgba(0,0,0,0.06)',
                      color: stage === 'Hired' ? 'var(--teal)' :
                        stage === 'Rejected' ? 'var(--alert)' :
                          'var(--charcoal)',
                    }}
                  >
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="k-col-body">
                  {cards.map(app => (
                    <CandidateCard
                      key={app.id}
                      app={app}
                      onDragStart={handleDragStart}
                      selected={selectedIds.includes(app.id)}
                      onSelect={(app, e) => handleSelect(app, e)}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div style={{
                      textAlign: 'center', padding: '16px 8px',
                      fontSize: 11, color: 'var(--stone-light)',
                      border: '1.5px dashed var(--sand-dark)',
                      borderRadius: 6,
                    }}>
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && (
        <AddCandidateModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchApplications() }}
        />
      )}

      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--charcoal)', color: 'white', padding: '12px 24px',
          borderRadius: 30, display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 100
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedIds.length} candidate(s) selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleBulkReject} className="btn btn-sm" style={{ background: 'var(--alert)', color: 'white', border: 'none' }}>Bulk Reject</button>
            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--stone-light)', border: 'none' }}>Cancel</button>
          </div>
        </div>
      )}

      {bulkMessaging && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ padding: 24, width: 400, maxWidth: '90%' }}>
            <h3 style={{ marginBottom: 8, color: 'var(--charcoal)' }}>WhatsApp Broadcasting</h3>
            <p style={{ fontSize: 13, color: 'var(--stone)', marginBottom: 16 }}>
              Sending localized messages ({bulkMessaging.currentIndex + 1} of {bulkMessaging.apps.length})
            </p>
            <div style={{ background: 'var(--sand-light)', padding: 16, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>To:</strong> {bulkMessaging.apps[bulkMessaging.currentIndex].candidates.full_name}<br />
              <strong>WhatsApp:</strong> {bulkMessaging.apps[bulkMessaging.currentIndex].candidates.whatsapp}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setBulkMessaging({ ...bulkMessaging, lang: 'id' })}
                className={`btn btn-sm ${bulkMessaging.lang === 'id' ? 'btn-primary' : 'btn-ghost'}`}
              >
                ID (Bahasa)
              </button>
              <button
                onClick={() => setBulkMessaging({ ...bulkMessaging, lang: 'en' })}
                className={`btn btn-sm ${bulkMessaging.lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              >
                EN (English)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setBulkMessaging(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={() => {
                  const app = bulkMessaging.apps[bulkMessaging.currentIndex]
                  const raw = app.candidates?.whatsapp || ''
                  let number = raw.replace(/[\s\-\(\)]/g, '')
                  if (number.startsWith('0')) number = '62' + number.slice(1)
                  if (number.startsWith('+')) number = number.slice(1)

                  const message = getWhatsAppMessage(app.candidates, app.roles, bulkMessaging.stage, bulkMessaging.lang)
                  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')

                  if (bulkMessaging.currentIndex < bulkMessaging.apps.length - 1) {
                    setBulkMessaging({ ...bulkMessaging, currentIndex: bulkMessaging.currentIndex + 1 })
                  } else {
                    setBulkMessaging(null)
                  }
                }}
                className="btn btn-primary btn-sm"
              >
                Send & Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
