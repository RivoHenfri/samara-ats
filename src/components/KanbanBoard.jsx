import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { autoScore, autoGenerateQuestions } from '../lib/aiWorkflow'
import CandidateCard, { getWhatsAppMessage } from './CandidateCard'
import AddCandidateModal from './AddCandidateModal'
import { Plus, Search, RotateCcw, X } from 'lucide-react'
import MultiSelectDropdown from './MultiSelectDropdown'
import { checkStagnation, groupByStage, STAGE_NEXT_ACTION } from '../lib/stagnationMonitor'

const STAGES = ['New', 'Screening', 'Interview Pending', 'Interview Scheduled', 'Interview Completed', 'Offer', 'Hired', 'Rejected']
const departments = ['Hospitality', 'Operations', 'Construction']
const origins = ['Lombok Local', 'Indonesian (Non-Lombok)', 'International']

// CSS class for each column
const colClass = {
  New: 'k-col-new',
  Screening: 'k-col-screening',
  'Interview Pending': 'k-col-interview',
  'Interview Scheduled': 'k-col-interview',
  'Interview Completed': 'k-col-interview',
  Offer: 'k-col-offer',
  Hired: 'k-col-hired',
  Rejected: 'k-col-rejected',
}

export default function KanbanBoard() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [applications, setApplications] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [dragging, setDragging] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [lastSelected, setLastSelected] = useState(null)
  const [bulkMessaging, setBulkMessaging] = useState(null)

  // Filters from URL
  const search = searchParams.get('q') || ''
  const roleFilters = searchParams.get('roles')?.split(',').filter(Boolean) || []
  const deptFilters = searchParams.get('depts')?.split(',').filter(Boolean) || []
  const originFilters = searchParams.get('origins')?.split(',').filter(Boolean) || []

  useEffect(() => {
    // Fetch roles for the filter dropdown
    supabase.from('roles').select('id, title, department').order('title').then(({ data }) => {
      setRoles(data || [])
    })
  }, [])

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    setSelectedIds([])

    let query = supabase
      .from('applications')
      .select('*, candidates!inner(*), roles!inner(*)')
      .order('created_at', { ascending: false })

    // Apply Filters
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,whatsapp.ilike.%${search}%`, { foreignTable: 'candidates' })
    }

    if (roleFilters.length > 0) {
      query = query.in('role_id', roleFilters)
    }

    if (deptFilters.length > 0) {
      query = query.in('roles.department', deptFilters)
    }

    if (originFilters.length > 0) {
      query = query.in('candidates.origin', originFilters)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching applications:', error)
    } else {
      setApplications(data || [])
    }
    setLoading(false)
  }, [search, roleFilters.join(','), deptFilters.join(','), originFilters.join(',')])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  // ── Real-time subscription ──────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('kanban-applications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => { fetchApplications() }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [fetchApplications])

  const updateFilters = (key, values) => {
    const nextParams = new URLSearchParams(searchParams)
    if (values && values.length > 0) {
      if (Array.isArray(values)) {
        nextParams.set(key, values.join(','))
      } else {
        nextParams.set(key, values)
      }
    } else {
      nextParams.delete(key)
    }
    setSearchParams(nextParams)
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams())
  }

  const handleDragStart = (app) => setDragging(app)

  const handleDrop = async (stage) => {
    if (!dragging || dragging.stage === stage) return
    const prevStage = dragging.stage
    const appId = dragging.id
    await supabase.from('applications').update({ stage }).eq('id', appId)
    setDragging(null)
    fetchApplications()

    // ── Auto-trigger AI in background based on destination stage ──
    if (stage === 'Screening' && prevStage !== 'Screening') {
      autoScore(appId)          // fire-and-forget; no-ops if already scored
    } else if (stage === 'Interview Pending' && prevStage !== 'Interview Pending') {
      autoGenerateQuestions(appId) // fire-and-forget; no-ops if already generated
    }
  }

  const handleSelect = (app, e) => {
    e.stopPropagation && e.stopPropagation()
    const isSelected = selectedIds.includes(app.id)
    if (e.shiftKey && lastSelected) {
      const lastIdx = applications.findIndex(a => a.id === lastSelected)
      const currIdx = applications.findIndex(a => a.id === app.id)
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx)
        const end = Math.max(lastIdx, currIdx)
        const slice = applications.slice(start, end + 1).map(a => a.id)
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
    const appsToMessage = applications.filter(a => selectedIds.includes(a.id) && a.candidates?.whatsapp)
    if (appsToMessage.length > 0) {
      setBulkMessaging({ apps: appsToMessage, currentIndex: 0, lang: 'id', stage: 'Rejected' })
    }
    fetchApplications()
  }

  // Proactive stagnation detection across all active pipeline stages
  const stagnationAlerts = checkStagnation(applications)
  const staleCount = stagnationAlerts.length
  const staleByStage = groupByStage(stagnationAlerts)

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
            onClick={() => updateFilters('origins', originFilters.includes('Lombok Local') ? originFilters.filter(o => o !== 'Lombok Local') : [...originFilters, 'Lombok Local'])}
            className={`btn btn-sm ${originFilters.includes('Lombok Local') ? 'btn-teal' : 'btn-ghost'}`}
          >
            🌴 Lombok First
          </button>

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

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="search-wrap" style={{ flex: 'none', width: 260 }}>
              <Search size={13} />
              <input
                type="text"
                value={search}
                onChange={e => updateFilters('q', e.target.value)}
                placeholder="Search candidates…"
                className="search-input"
              />
            </div>

            <MultiSelectDropdown
              label="Role"
              options={roles.map(r => ({ label: r.title, value: r.id }))}
              selectedValues={roleFilters}
              onChange={vals => updateFilters('roles', vals)}
            />

            <MultiSelectDropdown
              label="Department"
              options={departments.map(d => ({ label: d, value: d }))}
              selectedValues={deptFilters}
              onChange={vals => updateFilters('depts', vals)}
            />

            <MultiSelectDropdown
              label="Origin"
              options={origins.map(o => ({ label: o, value: o }))}
              selectedValues={originFilters}
              onChange={vals => updateFilters('origins', vals)}
            />

            {(roleFilters.length > 0 || deptFilters.length > 0 || originFilters.length > 0 || search) && (
              <button
                onClick={clearAllFilters}
                className="btn btn-ghost btn-sm text-stone flex items-center gap-1.5"
                style={{ border: 'none', background: 'none', color: 'var(--stone)' }}
              >
                <RotateCcw size={12} /> Clear All
              </button>
            )}
          </div>

          {/* Active Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontSize: 11, color: 'var(--stone)', marginRight: 4, fontWeight: 500 }}>
              {loading ? 'Searching...' : `${applications.length} candidate${applications.length !== 1 ? 's' : ''} found`}
            </span>

            {roleFilters.map(id => {
              const role = roles.find(r => r.id === id)
              return (
                <span key={id} className="tag tag-src flex items-center gap-1">
                  {role?.title || id}
                  <X size={10} className="cursor-pointer" onClick={() => updateFilters('roles', roleFilters.filter(v => v !== id))} />
                </span>
              )
            })}

            {deptFilters.map(d => (
              <span key={d} className="tag tag-src flex items-center gap-1">
                {d}
                <X size={10} className="cursor-pointer" onClick={() => updateFilters('depts', deptFilters.filter(v => v !== d))} />
              </span>
            ))}

            {originFilters.map(o => (
              <span key={o} className="tag tag-src flex items-center gap-1">
                {o}
                <X size={10} className="cursor-pointer" onClick={() => updateFilters('origins', originFilters.filter(v => v !== o))} />
              </span>
            ))}
          </div>
        </div>

        {/* Proactive stagnation alert with recommended next actions */}
        {staleCount > 0 && (
          <div className="alert-banner" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--alert)" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                <strong style={{ color: 'var(--alert)' }}>{staleCount} candidate{staleCount !== 1 ? 's' : ''}</strong>
                {' '}stagnant beyond stage threshold — action required
              </span>
            </div>
            {/* Per-stage recommended next actions */}
            {Object.entries(staleByStage).map(([stage, group]) =>
              STAGE_NEXT_ACTION[stage] ? (
                <div key={stage} style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingLeft: 22 }}>
                  <span style={{ fontSize: 11, color: 'var(--alert)', fontWeight: 600, flexShrink: 0 }}>
                    {group.count} in {stage}:
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--charcoal)' }}>
                    {STAGE_NEXT_ACTION[stage]}
                  </span>
                </div>
              ) : null
            )}
          </div>
        )}

        {/* Kanban board */}
        <div className="kanban-wrap" style={{ flex: 1 }}>
          {STAGES.map(stage => {
            const cards = applications.filter(a => a.stage === stage)
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
