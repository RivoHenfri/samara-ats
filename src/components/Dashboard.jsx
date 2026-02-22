import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Briefcase, AlertTriangle, TrendingUp } from 'lucide-react'
import { checkStagnation, groupByStage } from '../lib/stagnationMonitor'

const DEPTS = ['All', 'Hospitality', 'Operations', 'Construction']

// Stage → CSS class
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

export default function Dashboard() {
  const [allApplications, setAllApplications] = useState([])
  const [allCandidates, setAllCandidates] = useState([])
  const [allRoles, setAllRoles] = useState([])
  const [dept, setDept] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [appsRes, candidatesRes, rolesRes] = await Promise.all([
      supabase
        .from('applications')
        .select('*, candidates(full_name, id), roles(title, department, status)')
        .order('created_at', { ascending: false }),
      supabase.from('candidates').select('id'),
      supabase.from('roles').select('id, status, department'),
    ])
    setAllApplications(appsRes.data || [])
    setAllCandidates(candidatesRes.data || [])
    setAllRoles(rolesRes.data || [])
    setLoading(false)
  }

  // ── Filtered data ───────────────────────────────────────────
  const filteredApps = allApplications.filter(app =>
    dept === 'All' || app.roles?.department === dept
  )
  const filteredRoles = allRoles.filter(r =>
    dept === 'All' || r.department === dept
  )

  const totalCandidates = dept === 'All'
    ? allCandidates.length
    : [...new Set(filteredApps.map(a => a.candidates?.id).filter(Boolean))].length

  const openRoles = filteredRoles.filter(r => r.status === 'Open').length

  const stagnationAlerts = checkStagnation(filteredApps)
  const stagnant = stagnationAlerts.length
  const staleByStage = groupByStage(stagnationAlerts)

  const hired = filteredApps.filter(a => a.stage === 'Hired').length

  const recentApps = filteredApps.slice(0, 8)

  // ── Stat cards config ──────────────────────────────────────
  const stats = [
    { label: 'Total Candidates', value: totalCandidates, accent: 'stat-gold', icon: <Users size={40} /> },
    { label: 'Open Roles', value: openRoles, accent: 'stat-teal', icon: <Briefcase size={40} /> },
    { label: '48h+ Stagnant', value: stagnant, accent: 'stat-alert', icon: <AlertTriangle size={40} />, alert: stagnant > 0 },
    { label: 'Hired', value: hired, accent: 'stat-stone', icon: <TrendingUp size={40} /> },
  ]

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      Loading dashboard…
    </div>
  )

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {DEPTS.map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`btn btn-sm ${dept === d ? 'btn-primary' : 'btn-ghost'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">

        {/* Stale candidate alert with per-stage breakdown */}
        {stagnant > 0 && (
          <div className="alert-banner" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="var(--alert)" style={{ flexShrink: 0 }} />
              <span>
                <strong style={{ color: 'var(--alert)' }}>{stagnant} candidate{stagnant !== 1 ? 's' : ''}</strong>
                {' '}stagnant beyond stage threshold — action required
              </span>
            </div>
            {Object.entries(staleByStage).map(([stage, group]) => (
              <div key={stage} style={{ display: 'flex', alignItems: 'baseline', gap: 6, paddingLeft: 23 }}>
                <span style={{ fontSize: 11, color: 'var(--alert)', fontWeight: 600, flexShrink: 0 }}>
                  {group.count} in {stage}:
                </span>
                <span style={{ fontSize: 11, color: 'var(--charcoal)' }}>
                  {group.nextAction}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 22 }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`stat-card ${s.accent} animate-fade-up`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="stat-label">{s.label}</div>
              <div className={`stat-num${s.alert ? ' alert-val' : ''}`}>{s.value}</div>
              <div style={{
                position: 'absolute', bottom: 12, right: 14,
                opacity: 0.07, color: 'var(--charcoal)',
                width: 40, height: 40,
              }}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* Recent Applications */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Applications</span>
            {dept !== 'All' && (
              <span className="tag tag-ops">{dept}</span>
            )}
          </div>

          {recentApps.length === 0 ? (
            <div className="empty-state">
              No applications found{dept !== 'All' ? ` in ${dept}` : ''}.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map(app => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600 }}>{app.candidates?.full_name}</td>
                    <td>{app.roles?.title}</td>
                    <td>
                      <span className={`tag ${app.roles?.department === 'Hospitality' ? 'tag-hosp' :
                          app.roles?.department === 'Operations' ? 'tag-ops' : 'tag-const'
                        }`}>
                        {app.roles?.department}
                      </span>
                    </td>
                    <td>
                      <span className={`stage-badge ${stageClass[app.stage] ?? 'stage-new'}`}>
                        {app.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}
