import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Users, Briefcase, Activity, TrendingUp, AlertTriangle } from 'lucide-react'
import { checkStagnation, groupByStage } from '../lib/stagnationMonitor'
import { DEPARTMENTS } from '../lib/constants'

// Dashboard widgets
import TimeRangeFilter, { getDefaultDateRange } from './dashboard/TimeRangeFilter'
import ActionQueue from './dashboard/ActionQueue'
import SourceBreakdown from './dashboard/SourceBreakdown'
import PipelineSnapshot from './dashboard/PipelineSnapshot'
import PipelineVelocityCard from './dashboard/PipelineVelocityCard'
import TodaysInterviews from './dashboard/TodaysInterviews'
import RecruiterWorkload from './dashboard/RecruiterWorkload'

export default function Dashboard({ setCurrentPage }) {
  const { isAdmin, isManager } = useAuth()

  const [allApplications, setAllApplications] = useState([])
  const [allRoles, setAllRoles] = useState([])
  const [dept, setDept] = useState('All')
  const [dateRange, setDateRange] = useState(getDefaultDateRange)
  const [loading, setLoading] = useState(true)

  // ── Determine view mode from role ──
  const viewMode = isAdmin ? 'executive' : isManager ? 'recruiter' : 'viewer'

  // ── Data fetching ──
  const fetchAll = useCallback(async () => {
    const [appsRes, rolesRes] = await Promise.all([
      supabase
        .from('applications')
        .select('*, candidates(full_name, id, origin), roles(title, department, status, created_at)')
        .order('created_at', { ascending: false }),
      supabase.from('roles').select('id, status, department, created_at'),
    ])
    setAllApplications(appsRes.data || [])
    setAllRoles(rolesRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Real-time subscription (ported from KanbanBoard) ──
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => { fetchAll() }
      )
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [fetchAll])

  // ── Filtered data ──
  const filteredApps = allApplications.filter(app =>
    dept === 'All' || app.roles?.department === dept
  )
  const filteredRoles = allRoles.filter(r =>
    dept === 'All' || r.department === dept
  )

  // Time-scoped apps (within date range)
  const periodApps = filteredApps.filter(a => {
    const d = new Date(a.created_at)
    return d >= dateRange.start && d <= dateRange.end
  })

  // Previous equivalent period (for delta calculation)
  const periodLengthMs = dateRange.end.getTime() - dateRange.start.getTime()
  const prevStart = new Date(dateRange.start.getTime() - periodLengthMs)
  const prevEnd = dateRange.start
  const prevPeriodApps = filteredApps.filter(a => {
    const d = new Date(a.created_at)
    return d >= prevStart && d < prevEnd
  })

  // ── Computed metrics ──
  const openRoles = filteredRoles.filter(r => r.status === 'Open').length
  const longOpenRoles = filteredRoles.filter(r => {
    if (r.status !== 'Open') return false
    const daysSinceOpen = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysSinceOpen > 30
  }).length

  const stagnationAlerts = checkStagnation(filteredApps)
  const stagnant = stagnationAlerts.length
  const staleByStage = groupByStage(stagnationAlerts)

  // Pipeline health: % of active candidates that are on-track
  const activeCandidates = filteredApps.filter(a => a.stage !== 'Hired' && a.stage !== 'Rejected').length
  const pipelineHealth = activeCandidates > 0
    ? Math.round(((activeCandidates - stagnant) / activeCandidates) * 100)
    : 100

  const newThisPeriod = periodApps.length
  const delta = prevPeriodApps.length > 0
    ? Math.round(((newThisPeriod - prevPeriodApps.length) / prevPeriodApps.length) * 100)
    : null

  const hiredThisPeriod = periodApps.filter(a => a.stage === 'Hired')
  const hiredCount = hiredThisPeriod.length
  const avgDaysToHire = hiredThisPeriod.length > 0
    ? Math.round(
        hiredThisPeriod.reduce((sum, a) => {
          return sum + (new Date(a.updated_at) - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
        }, 0) / hiredThisPeriod.length
      )
    : null

  // ── Stat cards ──
  const stats = [
    {
      label: 'New This Period',
      value: newThisPeriod,
      accent: 'stat-gold',
      icon: <Users size={40} />,
      subtitle: delta !== null ? `${delta > 0 ? '+' : ''}${delta}% vs prev` : null,
      subtitleColor: delta === null ? undefined : delta > 0 ? 'var(--teal)' : delta < 0 ? 'var(--alert)' : 'var(--stone)',
    },
    {
      label: 'Open Roles',
      value: openRoles,
      accent: 'stat-teal',
      icon: <Briefcase size={40} />,
      subtitle: longOpenRoles > 0 ? `${longOpenRoles} unfilled > 30d` : 'All progressing',
      subtitleColor: longOpenRoles > 0 ? 'var(--alert)' : 'var(--teal)',
    },
    {
      label: 'Pipeline Health',
      value: `${pipelineHealth}%`,
      accent: pipelineHealth >= 80 ? 'stat-teal' : pipelineHealth >= 60 ? 'stat-gold' : 'stat-alert',
      icon: <Activity size={40} />,
      alert: pipelineHealth < 60,
      subtitle: `${stagnant} stagnant of ${activeCandidates}`,
      subtitleColor: stagnant > 0 ? 'var(--alert)' : 'var(--stone)',
    },
    {
      label: 'Hired',
      value: hiredCount,
      accent: 'stat-stone',
      icon: <TrendingUp size={40} />,
      subtitle: avgDaysToHire ? `${avgDaysToHire}d avg time-to-hire` : null,
    },
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
      <div className="topbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h1 className="page-title">Dashboard</h1>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <TimeRangeFilter value={dateRange} onChange={setDateRange} />
          <div style={{ width: 1, height: 20, background: 'var(--sand-dark, #E5DED3)' }} />
          <div style={{ display: 'flex', gap: 6 }}>
            {DEPARTMENTS.map(d => (
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
      </div>

      <div className="page-body">

        {/* Stagnation alert banner */}
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
              {s.subtitle && (
                <div style={{
                  fontSize: 10.5, color: s.subtitleColor || 'var(--stone)',
                  marginTop: 2, fontWeight: 500,
                }}>
                  {s.subtitle}
                </div>
              )}
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

        {/* ── Role-specific sections ── */}

        {viewMode === 'executive' && (
          <>
            {/* Row 1: Velocity + Team Activity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <PipelineVelocityCard dateRange={dateRange} />
              <RecruiterWorkload dateRange={dateRange} />
            </div>
            {/* Row 2: Pipeline + Sources */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <PipelineSnapshot applications={filteredApps} />
              <SourceBreakdown applications={periodApps} />
            </div>
            {/* Row 3: Action Queue */}
            <ActionQueue applications={filteredApps} onNavigate={setCurrentPage} />
          </>
        )}

        {viewMode === 'recruiter' && (
          <>
            {/* Row 1: Action Queue (prominent) */}
            <ActionQueue applications={filteredApps} onNavigate={setCurrentPage} />
            {/* Row 2: Interviews + Pipeline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <TodaysInterviews />
              <PipelineSnapshot applications={filteredApps} />
            </div>
            {/* Row 3: Sources */}
            <div style={{ marginTop: 14 }}>
              <SourceBreakdown applications={periodApps} />
            </div>
          </>
        )}

        {viewMode === 'viewer' && (
          <>
            {/* Row 1: Pipeline + Interviews */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <PipelineSnapshot applications={filteredApps} />
              <TodaysInterviews />
            </div>
            {/* Row 2: Source breakdown */}
            <SourceBreakdown applications={periodApps} />
          </>
        )}

      </div>
    </div>
  )
}
