import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

// Samara brand colours for stages
const STAGE_COLORS = {
  New:       '#9A8F80',  // stone
  Screening: '#B8965A',  // gold
  Interview: '#4A7C74',  // teal
  Offer:     '#6A9C94',  // teal-light
  Hired:     '#2A5C54',  // teal-dark
  Rejected:  '#C0614A',  // alert
}

// Division colours
const DEPT_COLORS = ['#B8965A', '#4A7C74', '#9A8F80']

// Recharts tooltip style (shared)
const tooltipStyle = {
  contentStyle: {
    background: '#2C2A27',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    color: '#F0EBE0',
  },
  labelStyle: { color: '#C5BCB0' },
  itemStyle:  { color: '#F0EBE0' },
}

export default function Analytics() {
  const [applications, setApplications] = useState([])
  const [loading,      setLoading]      = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(title, department)')
    setApplications(data || [])
    setLoading(false)
  }

  // Pipeline funnel
  const funnelData = STAGES.map(stage => ({
    name:  stage,
    value: applications.filter(a => a.stage === stage).length,
    fill:  STAGE_COLORS[stage],
  }))

  // Conversion rates
  const conversionData = []
  for (let i = 0; i < STAGES.length - 1; i++) {
    const from = STAGES[i]
    const to   = STAGES[i + 1]
    const fromCount = applications.filter(a => a.stage === from).length
    const toCount   = applications.filter(a => a.stage === to).length
    const total = fromCount + toCount
    conversionData.push({
      name: `${from} → ${to}`,
      rate: total > 0 ? Math.round((toCount / total) * 100) : 0,
    })
  }

  // Time to hire
  const hiredApps = applications.filter(a =>
    a.stage === 'Hired' && a.created_at && a.updated_at
  )
  const avgDays = hiredApps.length > 0
    ? Math.round(
        hiredApps.reduce((sum, a) => {
          const days = (new Date(a.updated_at) - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
          return sum + days
        }, 0) / hiredApps.length
      )
    : null

  // Department breakdown
  const deptMap = {}
  applications.forEach(a => {
    const dept = a.roles?.department || 'Unknown'
    deptMap[dept] = (deptMap[dept] || 0) + 1
  })
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      Loading analytics…
    </div>
  )

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">Analytics</h1>
      </div>

      <div className="page-body">
        {applications.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <p style={{ fontSize: 16, marginBottom: 6 }}>No data yet</p>
            <p style={{ fontSize: 12 }}>Add candidates to start seeing analytics.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Pipeline Funnel — full width */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <span className="card-title">Pipeline Funnel</span>
                <span style={{ fontSize: 11, color: 'var(--stone)' }}>Candidates per stage</span>
              </div>
              <div style={{ padding: '16px 8px 8px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--stone)', fontSize: 11, fontFamily: 'Jost, sans-serif' }}
                    />
                    <YAxis
                      tick={{ fill: 'var(--stone)', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Conversion Rates */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Conversion Rates</span>
                <span style={{ fontSize: 11, color: 'var(--stone)' }}>% advancing to next stage</span>
              </div>
              <div style={{ padding: '16px 8px 8px' }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={conversionData}
                    layout="vertical"
                    margin={{ top: 0, right: 32, left: 10, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      tick={{ fill: 'var(--stone)', fontSize: 10 }}
                      unit="%"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: 'var(--stone)', fontSize: 9.5 }}
                      width={115}
                    />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(v) => [`${v}%`, 'Rate']}
                    />
                    <Bar dataKey="rate" fill="var(--gold)" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Time to Hire */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Time to Hire</span>
                </div>
                <div style={{ padding: '20px' }}>
                  {avgDays !== null ? (
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <span style={{
                        fontFamily: 'var(--serif)',
                        fontSize: 52,
                        fontWeight: 300,
                        color: 'var(--teal)',
                        lineHeight: 1,
                      }}>
                        {avgDays}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--stone)', marginBottom: 6 }}>
                        days average
                      </span>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--stone-light)', fontSize: 12.5 }}>
                      No hired candidates yet.
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--stone-light)', marginTop: 6 }}>
                    Based on {hiredApps.length} hired candidate{hiredApps.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* By Department */}
              <div className="card" style={{ flex: 1 }}>
                <div className="card-header">
                  <span className="card-title">By Department</span>
                </div>
                <div style={{ padding: '16px 8px 8px' }}>
                  {deptData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={deptData}
                          cx="50%"
                          cy="50%"
                          innerRadius={32}
                          outerRadius={58}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {deptData.map((_, i) => (
                            <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip {...tooltipStyle} />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: 11, color: 'var(--stone)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p style={{ color: 'var(--stone-light)', fontSize: 12 }}>No data yet.</p>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}
      </div>
    </div>
  )
}
