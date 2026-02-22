import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ACTIVE_STAGES, STAGE_COLORS, TOOLTIP_STYLE } from '../../lib/constants'

// Abbreviate long stage names for compact display
const SHORT_NAMES = {
  'Interview Pending':   'Int. Pending',
  'Interview Scheduled': 'Int. Scheduled',
  'Interview Completed': 'Int. Done',
}

export default function PipelineSnapshot({ applications }) {
  const funnelData = ACTIVE_STAGES.map(stage => ({
    name: SHORT_NAMES[stage] || stage,
    value: applications.filter(a => a.stage === stage).length,
    fill: STAGE_COLORS[stage],
  }))

  const total = funnelData.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Pipeline Snapshot</span>
        <span style={{ fontSize: 11, color: 'var(--stone)' }}>{total} active</span>
      </div>
      <div style={{ padding: '16px 8px 8px' }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              tick={{ fill: 'var(--stone)', fontSize: 9.5, fontFamily: 'Jost, sans-serif' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tick={{ fill: 'var(--stone)', fontSize: 10 }}
              allowDecimals={false}
            />
            <Tooltip {...TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {funnelData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
