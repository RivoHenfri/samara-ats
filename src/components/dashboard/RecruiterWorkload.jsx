import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function RecruiterWorkload({ dateRange }) {
  const [workloadData, setWorkloadData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWorkload()
  }, [dateRange.start?.getTime(), dateRange.end?.getTime()])

  const fetchWorkload = async () => {
    setLoading(true)

    // 1. Get all history entries in date range
    const { data: history } = await supabase
      .from('application_history')
      .select('actor_id, application_id, action_type, created_at')
      .gte('created_at', dateRange.start.toISOString())
      .lte('created_at', dateRange.end.toISOString())

    if (!history?.length) {
      setWorkloadData([])
      setLoading(false)
      return
    }

    // 2. Get unique actor IDs and fetch profiles
    const actorIds = [...new Set(history.map(h => h.actor_id).filter(Boolean))]
    if (actorIds.length === 0) {
      setWorkloadData([])
      setLoading(false)
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', actorIds)

    // 3. Aggregate per actor
    const actorMap = {}
    for (const h of history) {
      if (!h.actor_id) continue
      if (!actorMap[h.actor_id]) actorMap[h.actor_id] = { actions: 0, applicationIds: new Set() }
      actorMap[h.actor_id].actions++
      actorMap[h.actor_id].applicationIds.add(h.application_id)
    }

    // 4. Build display data
    const result = actorIds.map(id => {
      const profile = (profiles || []).find(p => p.id === id)
      const stats = actorMap[id] || { actions: 0, applicationIds: new Set() }
      return {
        id,
        name: profile?.full_name || profile?.email || 'Unknown',
        role: profile?.role || '—',
        actionsThisPeriod: stats.actions,
        candidatesTouched: stats.applicationIds.size,
      }
    }).sort((a, b) => b.actionsThisPeriod - a.actionsThisPeriod)

    setWorkloadData(result)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="card">
        <div className="card-header">
          <span className="card-title">Team Activity</span>
        </div>
        <div className="loading-state" style={{ padding: 20 }}>
          <span className="spinner" /> Loading…
        </div>
      </div>
    )
  }

  const maxActions = Math.max(...workloadData.map(d => d.actionsThisPeriod), 1)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Team Activity</span>
        <span style={{ fontSize: 11, color: 'var(--stone)' }}>
          {workloadData.length} member{workloadData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {workloadData.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 20px' }}>
          <p style={{ fontSize: 12, color: 'var(--stone)' }}>No team activity in this period.</p>
        </div>
      ) : (
        <div style={{ padding: '12px 16px' }}>
          {workloadData.map(d => (
            <div key={d.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 0', borderBottom: '1px solid var(--sand-dark, #E5DED3)',
            }}>
              {/* Name and role */}
              <div style={{ width: 120, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
                  {d.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--stone)' }}>{d.role}</div>
              </div>

              {/* Activity bar */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  height: 12, borderRadius: 3,
                  width: `${(d.actionsThisPeriod / maxActions) * 100}%`,
                  background: 'var(--teal)',
                  transition: 'width 0.3s ease',
                  minWidth: 8,
                }} />
              </div>

              {/* Stats */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)' }}>
                  {d.actionsThisPeriod}
                </div>
                <div style={{ fontSize: 10, color: 'var(--stone)' }}>
                  {d.candidatesTouched} candidates
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
