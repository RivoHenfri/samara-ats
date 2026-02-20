import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CandidateCard from './CandidateCard'
import AddCandidateModal from './AddCandidateModal'
import { Plus } from 'lucide-react'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

// CSS class for each column
const colClass = {
  New:       'k-col-new',
  Screening: 'k-col-screening',
  Interview: 'k-col-interview',
  Offer:     'k-col-offer',
  Hired:     'k-col-hired',
  Rejected:  'k-col-rejected',
}

export default function KanbanBoard() {
  const [applications, setApplications] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [lombokOnly,   setLombokOnly]   = useState(false)
  const [filterDept,   setFilterDept]   = useState('All')
  const [dragging,     setDragging]     = useState(null)

  useEffect(() => { fetchApplications() }, [])

  const fetchApplications = async () => {
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
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
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
    </div>
  )
}
