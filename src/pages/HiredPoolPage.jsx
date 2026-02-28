import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, RotateCcw, ChevronLeft, ChevronRight, X, Clock, UserCheck, Users, CheckCircle, Loader } from 'lucide-react'
import { format, formatDistanceToNow, differenceInDays } from 'date-fns'
import CandidateDetail from '../components/CandidateDetail'
import CandidateTimeline from '../components/CandidateTimeline'
import MultiSelectDropdown from '../components/MultiSelectDropdown'
import { ScoreBadge } from '../components/CompatibilityScore'

const departments = ['Hospitality', 'Operations', 'Construction']
const onboardingStatuses = ['Pending', 'Scheduled', 'In Progress', 'Completed']

function deptTag(dept) {
  if (!dept) return 'tag-src'
  const d = dept.toLowerCase()
  if (d === 'hospitality') return 'tag-hosp'
  if (d === 'operations') return 'tag-ops'
  if (d === 'construction') return 'tag-const'
  return 'tag-src'
}

function onboardingBadge(status) {
  if (!status) return { label: 'Pending', color: 'var(--stone)', bg: 'rgba(154,143,128,0.1)' }
  const map = {
    Pending: { label: 'Pending', color: 'var(--stone)', bg: 'rgba(154,143,128,0.1)' },
    Scheduled: { label: 'Scheduled', color: 'var(--gold)', bg: 'rgba(184,150,90,0.1)' },
    'In Progress': { label: 'In Progress', color: 'var(--teal)', bg: 'rgba(74,124,116,0.1)' },
    Completed: { label: 'Completed', color: '#2A5C54', bg: 'rgba(42,92,84,0.1)' },
  }
  return map[status] || map.Pending
}

export default function HiredPoolPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [applications, setApplications] = useState([])
  const [roles, setRoles] = useState([])
  const [employeeMap, setEmployeeMap] = useState({}) // candidateId → employee record with workflows
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedApp, setSelectedApp] = useState(null)
  const [timelineAppId, setTimelineAppId] = useState(null)
  const [scores, setScores] = useState({})

  // Summary stats
  const [stats, setStats] = useState({ total: 0, avgDays: null, statusCounts: {} })

  // Filters from URL
  const search = searchParams.get('q') || ''
  const roleFilters = searchParams.get('roles')?.split(',').filter(Boolean) || []
  const deptFilters = searchParams.get('depts')?.split(',').filter(Boolean) || []
  const obStatusFilters = searchParams.get('obStatus')?.split(',').filter(Boolean) || []
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  useEffect(() => {
    supabase.from('roles').select('id, title, department').order('title').then(({ data }) => {
      setRoles(data || [])
    })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch hired applications
    let query = supabase
      .from('applications')
      .select('*, candidates!inner(*), roles!inner(*)', { count: 'exact' })
      .eq('stage', 'Hired')
      .order('hired_at', { ascending: false, nullsFirst: false })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,whatsapp.ilike.%${search}%`, { foreignTable: 'candidates' })
    }
    if (roleFilters.length > 0) {
      query = query.in('role_id', roleFilters)
    }
    if (deptFilters.length > 0) {
      query = query.in('roles.department', deptFilters)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching hired applications:', error)
      setLoading(false)
      return
    }

    setApplications(data || [])
    setTotalCount(count || 0)

    // 2. Fetch scores for these applications
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

      // 3. Fetch employee records with onboarding workflow status
      const candidateIds = data.map(a => a.candidate_id).filter(Boolean)
      if (candidateIds.length > 0) {
        await fetchEmployeeData(candidateIds)
      }
    } else {
      setScores({})
      setEmployeeMap({})
    }

    // 4. Compute summary stats
    await computeStats()

    setLoading(false)
  }, [search, roleFilters.join(','), deptFilters.join(','), page])

  const fetchEmployeeData = async (candidateIds) => {
    // Try view-based access first (hr_employee_records), fallback to schema-based
    let employees = null
    const { data, error } = await supabase
      .from('hr_employee_records')
      .select(`*, hr_employee_workflows!employee_id (status, id, template_id)`)
      .in('candidate_id', candidateIds)

    if (error) {
      const { data: hrData } = await supabase
        .schema('hr')
        .from('employee_records')
        .select(`*, employee_workflows (status, id, template_id)`)
        .in('candidate_id', candidateIds)
      employees = hrData
    } else {
      employees = data
    }

    const map = {}
    for (const emp of (employees || [])) {
      map[emp.candidate_id] = emp
    }
    setEmployeeMap(map)
  }

  const computeStats = async () => {
    const { data: allHired } = await supabase
      .from('applications')
      .select('created_at, hired_at, updated_at, candidate_id')
      .eq('stage', 'Hired')

    if (!allHired || allHired.length === 0) {
      setStats({ total: 0, avgDays: null, statusCounts: {} })
      return
    }

    const total = allHired.length

    // Avg time-to-hire
    const daysArr = allHired.map(a => {
      const hiredDate = a.hired_at ? new Date(a.hired_at) : new Date(a.updated_at)
      return differenceInDays(hiredDate, new Date(a.created_at))
    }).filter(d => d >= 0)
    const avgDays = daysArr.length > 0 ? Math.round(daysArr.reduce((s, d) => s + d, 0) / daysArr.length) : null

    // Onboarding status breakdown (from employeeMap populated after fetchData)
    // We'll compute this from employeeMap once it's set
    setStats({ total, avgDays, statusCounts: {} })
  }

  // Compute onboarding status counts whenever employeeMap changes
  useEffect(() => {
    const counts = { Pending: 0, Scheduled: 0, 'In Progress': 0, Completed: 0 }
    for (const emp of Object.values(employeeMap)) {
      const wfStatus = emp.employee_workflows?.[0]?.status
        || emp.hr_employee_workflows?.[0]?.status
      if (wfStatus && counts[wfStatus] !== undefined) {
        counts[wfStatus]++
      } else {
        counts.Pending++
      }
    }
    setStats(prev => ({ ...prev, statusCounts: counts }))
  }, [employeeMap])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('hired-pool')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        (payload) => {
          if (payload.new?.stage === 'Hired' || payload.old?.stage === 'Hired') {
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
      nextParams.set(key, Array.isArray(values) ? values.join(',') : values)
    } else {
      nextParams.delete(key)
    }
    nextParams.set('page', '1')
    setSearchParams(nextParams)
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams())
  }

  const getOnboardingStatus = (candidateId) => {
    const emp = employeeMap[candidateId]
    if (!emp) return null
    const workflows = emp.employee_workflows || emp.hr_employee_workflows || []
    return workflows[0]?.status || 'Pending'
  }

  const getTimeToHire = (app) => {
    const hiredDate = app.hired_at ? new Date(app.hired_at) : new Date(app.updated_at)
    const days = differenceInDays(hiredDate, new Date(app.created_at))
    return days >= 0 ? days : null
  }

  // Client-side filter for onboarding status (since it comes from a separate table)
  const filteredApplications = obStatusFilters.length > 0
    ? applications.filter(app => {
      const status = getOnboardingStatus(app.candidate_id) || 'Pending'
      return obStatusFilters.includes(status)
    })
    : applications

  const hasActiveFilters = roleFilters.length > 0 || deptFilters.length > 0 || obStatusFilters.length > 0 || search

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <h1 className="page-title">Hired Candidates</h1>
        <span style={{ fontSize: 12, color: 'var(--stone)', marginLeft: 8 }}>
          {totalCount} total
        </span>
      </div>

      <div className="page-body">
        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: '1 1 160px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <UserCheck size={14} style={{ color: 'var(--teal)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
                Total Hired
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)' }}>
              {stats.total}
            </div>
          </div>

          <div className="card" style={{ flex: '1 1 160px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Clock size={14} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
                Avg Time-to-Hire
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)' }}>
              {stats.avgDays != null ? `${stats.avgDays}d` : '—'}
            </div>
          </div>

          <div className="card" style={{ flex: '2 1 300px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Users size={14} style={{ color: 'var(--teal)' }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
                Onboarding Status
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {onboardingStatuses.map(status => {
                const badge = onboardingBadge(status)
                const count = stats.statusCounts[status] || 0
                return (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 20, fontWeight: 700, color: badge.color,
                    }}>
                      {count}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--stone)' }}>{status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="search-wrap" style={{ flex: 'none', width: 260 }}>
              <Search size={13} />
              <input
                type="text"
                value={search}
                onChange={e => updateFilters('q', e.target.value)}
                placeholder="Search hired candidates..."
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
              label="Onboarding"
              options={onboardingStatuses.map(s => ({ label: s, value: s }))}
              selectedValues={obStatusFilters}
              onChange={vals => updateFilters('obStatus', vals)}
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
              {obStatusFilters.map(s => {
                const badge = onboardingBadge(s)
                return (
                  <span key={s} className="tag flex items-center gap-1" style={{ color: badge.color, background: badge.bg }}>
                    {s}
                    <X size={10} className="cursor-pointer" onClick={() => updateFilters('obStatus', obStatusFilters.filter(v => v !== s))} />
                  </span>
                )
              })}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="loading-state">
            <span className="spinner" />
            Loading hired candidates...
          </div>
        )}

        {/* Table */}
        {!loading && (
          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1000 }}>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Dept</th>
                  <th>Hired Date</th>
                  <th>Time-to-Hire</th>
                  <th>Score</th>
                  <th>Onboarding</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.map(app => {
                  const daysToHire = getTimeToHire(app)
                  const obStatus = getOnboardingStatus(app.candidate_id)
                  const badge = onboardingBadge(obStatus)

                  return (
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
                        <span style={{ fontSize: 11.5, color: 'var(--charcoal)' }}>
                          {app.hired_at
                            ? format(new Date(app.hired_at), 'dd MMM yyyy')
                            : app.updated_at
                              ? format(new Date(app.updated_at), 'dd MMM yyyy')
                              : '—'}
                        </span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--stone-light)' }}>
                          {app.hired_at
                            ? formatDistanceToNow(new Date(app.hired_at), { addSuffix: true })
                            : ''}
                        </span>
                      </td>
                      <td>
                        {daysToHire != null ? (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: daysToHire <= 30 ? 'var(--teal)' : daysToHire <= 60 ? 'var(--gold)' : 'var(--alert)',
                          }}>
                            {daysToHire}d
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--stone-light)' }}>—</span>
                        )}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <ScoreBadge score={scores[app.id] ?? null} size="sm" />
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 500,
                          color: badge.color, background: badge.bg,
                          padding: '2px 8px', borderRadius: 4,
                        }}>
                          {badge.label}
                        </span>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setTimelineAppId(app.id)}
                            className="btn btn-ghost btn-xs"
                            style={{ fontSize: 11, padding: '4px 8px', color: 'var(--teal)' }}
                          >
                            <Clock size={11} style={{ marginRight: 3 }} /> Timeline
                          </button>
                          {obStatus === 'Pending' && (
                            <button
                              onClick={() => {
                                navigate('/employees')
                              }}
                              className="btn btn-ghost btn-xs"
                              style={{ fontSize: 11, padding: '4px 8px', color: 'var(--gold)' }}
                            >
                              <Loader size={11} style={{ marginRight: 3 }} /> Start Onboarding
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredApplications.length === 0 && (
              <div className="empty-state">
                No hired candidates found matching the filters.
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

      {/* Timeline Modal */}
      {timelineAppId && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setTimelineAppId(null)}
        >
          <div
            className="card"
            style={{ width: 480, maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <CandidateTimeline
              applicationId={timelineAppId}
              onClose={() => setTimelineAppId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
