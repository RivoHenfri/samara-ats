import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, RotateCcw, ChevronLeft, ChevronRight, X, RefreshCw, MessageCircle, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import CandidateDetail from '../components/CandidateDetail'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import RejectionAnalyticsMini from '../components/RejectionAnalyticsMini'
import { ScoreBadge } from '../components/CompatibilityScore'
import { useRBAC } from '../contexts/RBACContext'

const departments = ['Hospitality', 'Operations', 'Construction']
const origins = ['Lombok Local', 'Indonesian (Non-Lombok)', 'International']

const stageClass = {
  New: 'stage-new',
  Screening: 'stage-screening',
  'Interview Pending': 'stage-interview',
  'Interview Scheduled': 'stage-interview',
  'Interview Completed': 'stage-interview',
  Offer: 'stage-offer',
  Hired: 'stage-hired',
  Rejected: 'stage-rejected',
}

function displayIDR(num) {
  if (!num) return '—'
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

export default function RejectedPoolPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasPermission } = useRBAC()

  const [applications, setApplications] = useState([])
  const [roles, setRoles] = useState([])
  const [rejectionReasons, setRejectionReasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedApp, setSelectedApp] = useState(null)
  const [scores, setScores] = useState({})
  const [reconsidering, setReconsidering] = useState(null) // app being reconsidered

  // Filters from URL
  const search = searchParams.get('q') || ''
  const roleFilters = searchParams.get('roles')?.split(',').filter(Boolean) || []
  const deptFilters = searchParams.get('depts')?.split(',').filter(Boolean) || []
  const reasonFilters = searchParams.get('reasons')?.split(',').filter(Boolean) || []
  const originFilters = searchParams.get('origins')?.split(',').filter(Boolean) || []
  const rejStageFilters = searchParams.get('rejStages')?.split(',').filter(Boolean) || []
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  useEffect(() => {
    supabase.from('roles').select('id, title, department').order('title').then(({ data }) => {
      setRoles(data || [])
    })
    // Fetch distinct rejection reasons
    supabase
      .from('applications')
      .select('rejection_reason')
      .eq('stage', 'Rejected')
      .not('rejection_reason', 'is', null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.rejection_reason).filter(Boolean))]
        setRejectionReasons(unique.sort())
      })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)

    let query = supabase
      .from('applications')
      .select('*, candidates!inner(*), roles!inner(*)', { count: 'exact' })
      .eq('stage', 'Rejected')
      .order('rejected_at', { ascending: false, nullsFirst: false })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,whatsapp.ilike.%${search}%`, { foreignTable: 'candidates' })
    }
    if (roleFilters.length > 0) {
      query = query.in('role_id', roleFilters)
    }
    if (deptFilters.length > 0) {
      query = query.in('roles.department', deptFilters)
    }
    if (reasonFilters.length > 0) {
      query = query.in('rejection_reason', reasonFilters)
    }
    if (originFilters.length > 0) {
      query = query.in('candidates.origin', originFilters)
    }
    if (rejStageFilters.length > 0) {
      query = query.in('rejection_stage', rejStageFilters)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching rejected applications:', error)
    } else {
      setApplications(data || [])
      setTotalCount(count || 0)

      if (data && data.length > 0) {
        const appIds = data.map(a => a.id)
        const { data: scoreRows } = await supabase
          .from('application_scores')
          .select('application_id, overall_score, created_at')
          .in('application_id', appIds)
          .order('created_at', { ascending: false })

        const scoreMap = {}
        for (const row of (scoreRows || [])) {
          if (!(row.application_id in scoreMap)) {
            scoreMap[row.application_id] = row.overall_score
          }
        }
        setScores(scoreMap)
      } else {
        setScores({})
      }
    }
    setLoading(false)
  }, [search, roleFilters.join(','), deptFilters.join(','), reasonFilters.join(','), originFilters.join(','), rejStageFilters.join(','), page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time subscription for rejected applications
  useEffect(() => {
    const channel = supabase
      .channel('rejected-pool')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        (payload) => {
          if (payload.new?.stage === 'Rejected' || payload.old?.stage === 'Rejected') {
            fetchData()
          }
        }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [fetchData])

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
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams())
  }

  const handleReconsider = async (app, targetStage) => {
    setReconsidering(null)
    const { error } = await supabase
      .from('applications')
      .update({ stage: targetStage })
      .eq('id', app.id)

    if (error) {
      alert('Failed to reconsider candidate: ' + error.message)
    } else {
      // Add a note about reconsideration
      await supabase.from('notes').insert({
        application_id: app.id,
        content: `Candidate reconsidered and moved back to "${targetStage}" from Rejected Pool. Previous rejection reason: ${app.rejection_reason || 'Not Specified'}`,
        created_by: 'System',
      })
      fetchData()
    }
  }

  const canReconsider = hasPermission('applications', 'reconsider')

  const hasActiveFilters = roleFilters.length > 0 || deptFilters.length > 0 || reasonFilters.length > 0 || originFilters.length > 0 || rejStageFilters.length > 0 || search

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <h1 className="page-title">Rejected Pool</h1>
        <span style={{ fontSize: 12, color: 'var(--stone)', marginLeft: 8 }}>
          {totalCount} candidate{totalCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="page-body">
        {/* Analytics Mini */}
        <RejectionAnalyticsMini />

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="search-wrap" style={{ flex: 'none', width: 260 }}>
              <Search size={13} />
              <input
                type="text"
                value={search}
                onChange={e => updateFilters('q', e.target.value)}
                placeholder="Search rejected candidates..."
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
              label="Reason"
              options={rejectionReasons.map(r => ({ label: r, value: r }))}
              selectedValues={reasonFilters}
              onChange={vals => updateFilters('reasons', vals)}
            />

            <MultiSelectDropdown
              label="Rejected From"
              options={['New', 'Screening', 'Interview Pending', 'Interview Scheduled', 'Interview Completed', 'Offer'].map(s => ({ label: s, value: s }))}
              selectedValues={rejStageFilters}
              onChange={vals => updateFilters('rejStages', vals)}
            />

            <MultiSelectDropdown
              label="Origin"
              options={origins.map(o => ({ label: o, value: o }))}
              selectedValues={originFilters}
              onChange={vals => updateFilters('origins', vals)}
            />

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="btn btn-ghost btn-sm text-stone flex items-center gap-1.5"
                style={{ border: 'none', background: 'none', color: 'var(--stone)' }}
              >
                <RotateCcw size={12} /> Clear All
              </button>
            )}
          </div>

          {/* Active filter tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
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
              {reasonFilters.map(r => (
                <span key={r} className="tag flex items-center gap-1" style={{ color: 'var(--alert)', background: 'rgba(192,97,74,0.1)', borderColor: 'rgba(192,97,74,0.3)' }}>
                  {r}
                  <X size={10} className="cursor-pointer" onClick={() => updateFilters('reasons', reasonFilters.filter(v => v !== r))} />
                </span>
              ))}
              {rejStageFilters.map(s => (
                <span key={s} className="tag tag-src flex items-center gap-1">
                  From: {s}
                  <X size={10} className="cursor-pointer" onClick={() => updateFilters('rejStages', rejStageFilters.filter(v => v !== s))} />
                </span>
              ))}
              {originFilters.map(o => (
                <span key={o} className="tag tag-src flex items-center gap-1">
                  {o}
                  <X size={10} className="cursor-pointer" onClick={() => updateFilters('origins', originFilters.filter(v => v !== o))} />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <span className="spinner" />
            Loading rejected candidates...
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Dept</th>
                  <th>Rejected From</th>
                  <th>Reason</th>
                  <th>Rejected</th>
                  <th>Score</th>
                  <th>Expected Salary</th>
                  <th>Origin</th>
                  {canReconsider && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr
                    key={app.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedApp(app)}
                  >
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.1)' }}>
                        {app.candidates?.full_name}
                      </span>
                    </td>
                    <td>{app.roles?.title}</td>
                    <td>
                      <span className={`tag ${deptTag(app.roles?.department)}`}>
                        {app.roles?.department}
                      </span>
                    </td>
                    <td>
                      {app.rejection_stage && app.rejection_stage !== 'Unknown' ? (
                        <span className={`stage-badge ${stageClass[app.rejection_stage] ?? 'stage-new'}`}>
                          {app.rejection_stage}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--stone-light)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, color: 'var(--alert)',
                        background: 'rgba(192,97,74,0.1)',
                        padding: '2px 8px', borderRadius: 4,
                        fontWeight: 500,
                      }}>
                        {app.rejection_reason || 'Not Specified'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 11.5, color: 'var(--stone)' }}>
                        {app.rejected_at
                          ? formatDistanceToNow(new Date(app.rejected_at), { addSuffix: true })
                          : app.updated_at
                            ? formatDistanceToNow(new Date(app.updated_at), { addSuffix: true })
                            : '—'}
                      </span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <ScoreBadge score={scores[app.id] ?? null} size="sm" />
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {displayIDR(app.candidates?.expected_salary)}
                    </td>
                    <td>
                      {app.candidates?.origin === 'Lombok Local' ? (
                        <span className="tag tag-lombok">Local</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--stone)' }}>
                          {app.candidates?.origin || '—'}
                        </span>
                      )}
                    </td>
                    {canReconsider && (
                      <td onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setReconsidering(app)}
                          className="btn btn-ghost btn-xs"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            color: 'var(--teal)', fontSize: 11, padding: '4px 10px',
                          }}
                        >
                          <RefreshCw size={11} /> Reconsider
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {applications.length === 0 && (
              <div className="empty-state">
                No rejected candidates found matching the filters.
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalCount > pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button
              disabled={page === 1 || loading}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', (page - 1).toString())
                setSearchParams(p)
              }}
              className="btn btn-ghost btn-xs"
              style={{ borderRadius: 20, padding: '6px 14px' }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--stone)', fontWeight: 500 }}>
              Page {page} of {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              disabled={page >= Math.ceil(totalCount / pageSize) || loading}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', (page + 1).toString())
                setSearchParams(p)
              }}
              className="btn btn-ghost btn-xs"
              style={{ borderRadius: 20, padding: '6px 14px' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Candidate Detail Modal */}
      {selectedApp && (
        <CandidateDetail
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={() => { fetchData(); setSelectedApp(null) }}
        />
      )}

      {/* Reconsider Confirmation Modal */}
      {reconsidering && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setReconsidering(null)}
        >
          <div className="card" style={{ padding: 24, width: 420, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 4, color: 'var(--charcoal)', fontSize: 16 }}>
              Reconsider Candidate
            </h3>
            <p style={{ fontSize: 13, color: 'var(--stone)', marginBottom: 16 }}>
              Move <strong>{reconsidering.candidates?.full_name}</strong> back into the active pipeline.
              {reconsidering.rejection_reason && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--alert)' }}>
                  Previous rejection reason: {reconsidering.rejection_reason}
                </span>
              )}
            </p>

            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--stone)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Return to stage:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              {reconsidering.rejection_stage && reconsidering.rejection_stage !== 'Unknown' && (
                <button
                  onClick={() => handleReconsider(reconsidering, reconsidering.rejection_stage)}
                  className="btn btn-sm"
                  style={{
                    background: 'var(--teal)', color: 'white', border: 'none',
                    justifyContent: 'flex-start', padding: '8px 14px',
                  }}
                >
                  <RefreshCw size={12} style={{ marginRight: 6 }} />
                  {reconsidering.rejection_stage} (original stage)
                </button>
              )}
              <button
                onClick={() => handleReconsider(reconsidering, 'New')}
                className="btn btn-sm btn-ghost"
                style={{ justifyContent: 'flex-start', padding: '8px 14px' }}
              >
                New (start over)
              </button>
              {reconsidering.rejection_stage !== 'Screening' && (
                <button
                  onClick={() => handleReconsider(reconsidering, 'Screening')}
                  className="btn btn-sm btn-ghost"
                  style={{ justifyContent: 'flex-start', padding: '8px 14px' }}
                >
                  Screening
                </button>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setReconsidering(null)} className="btn btn-ghost btn-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Helper ──
function deptTag(dept) {
  if (!dept) return 'tag-src'
  const d = dept.toLowerCase()
  if (d === 'hospitality') return 'tag-hosp'
  if (d === 'operations') return 'tag-ops'
  if (d === 'construction') return 'tag-const'
  return 'tag-src'
}
