import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { XCircle, TrendingDown, BarChart2 } from 'lucide-react'

export default function RejectionAnalyticsMini() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Fetch all rejected applications
      const { data: rejected } = await supabase
        .from('applications')
        .select('rejection_reason, rejection_stage, rejected_at, created_at')
        .eq('stage', 'Rejected')

      // Fetch total applications for rejection rate
      const { count: totalApps } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })

      if (!rejected) {
        setStats(null)
        setLoading(false)
        return
      }

      const total = rejected.length
      const rate = totalApps > 0 ? ((total / totalApps) * 100).toFixed(1) : 0

      // Top rejection reasons
      const reasonCounts = {}
      rejected.forEach(r => {
        const reason = r.rejection_reason || 'Not Specified'
        reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
      })
      const topReasons = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)

      // Rejection by source stage
      const stageCounts = {}
      rejected.forEach(r => {
        const stage = r.rejection_stage || 'Unknown'
        stageCounts[stage] = (stageCounts[stage] || 0) + 1
      })
      const byStage = Object.entries(stageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)

      // This month count
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const thisMonth = rejected.filter(r => r.rejected_at && r.rejected_at >= monthStart).length

      setStats({ total, rate, topReasons, byStage, thisMonth })
    } catch (err) {
      console.error('Error fetching rejection stats:', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card" style={{ flex: 1, padding: '16px 20px', opacity: 0.5 }}>
            <div style={{ height: 40 }} />
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
      {/* Total Rejected */}
      <div className="card" style={{ flex: '1 1 180px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <XCircle size={14} style={{ color: 'var(--alert)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
            Total Rejected
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)' }}>
          {stats.total}
        </div>
        <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 2 }}>
          {stats.thisMonth} this month
        </div>
      </div>

      {/* Rejection Rate */}
      <div className="card" style={{ flex: '1 1 180px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <TrendingDown size={14} style={{ color: 'var(--gold)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
            Rejection Rate
          </span>
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--charcoal)' }}>
          {stats.rate}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--stone)', marginTop: 2 }}>
          of all applications
        </div>
      </div>

      {/* Top Reasons */}
      <div className="card" style={{ flex: '2 1 280px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <BarChart2 size={14} style={{ color: 'var(--teal)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
            Top Rejection Reasons
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stats.topReasons.map(([reason, count], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, height: 6, background: 'var(--sand)',
                borderRadius: 3, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(count / stats.total) * 100}%`,
                  background: i === 0 ? 'var(--alert)' : i === 1 ? 'var(--gold)' : 'var(--stone)',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--charcoal)', fontWeight: 500, minWidth: 120, textAlign: 'right' }}>
                {reason}
              </span>
              <span style={{ fontSize: 11, color: 'var(--stone)', minWidth: 24, textAlign: 'right' }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By Source Stage */}
      <div className="card" style={{ flex: '1 1 220px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--stone)' }}>
            Rejected From Stage
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {stats.byStage.map(([stage, count], i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: 'var(--charcoal)' }}>{stage}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--stone)',
                background: 'var(--sand-light)', padding: '1px 8px', borderRadius: 10,
              }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
