import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { TOOLTIP_STYLE } from '../../lib/constants'

const SOURCE_COLORS = {
  'Career Page': '#4A7C74',
  Referral:      '#B8965A',
  Manual:        '#9A8F80',
  Import:        '#6A9C94',
  Unknown:       '#C5BCB0',
}

export default function SourceBreakdown({ applications }) {
  const sourceMap = {}
  for (const a of applications) {
    const src = a.source || 'Unknown'
    if (!sourceMap[src]) sourceMap[src] = { applied: 0, hired: 0 }
    sourceMap[src].applied++
    if (a.stage === 'Hired') sourceMap[src].hired++
  }

  const data = Object.entries(sourceMap)
    .map(([name, { applied, hired }]) => ({
      name,
      applied,
      hired,
      rate: applied > 0 ? Math.round((hired / applied) * 100) : 0,
    }))
    .sort((a, b) => b.applied - a.applied)

  if (data.length === 0) return null

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Source Effectiveness</span>
        <span style={{ fontSize: 11, color: 'var(--stone)' }}>Applied vs Hired</span>
      </div>
      <div style={{ padding: '16px 8px 8px' }}>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 32, left: 10, bottom: 0 }}>
            <XAxis
              type="number"
              tick={{ fill: 'var(--stone)', fontSize: 10 }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'var(--stone)', fontSize: 11 }}
              width={85}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v, name) => [v, name === 'applied' ? 'Applied' : 'Hired']}
            />
            <Bar dataKey="applied" fill="#9A8F80" radius={[0, 4, 4, 0]} barSize={14} name="applied" />
            <Bar dataKey="hired" fill="#4A7C74" radius={[0, 4, 4, 0]} barSize={14} name="hired" />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: 'var(--stone)' }}
              formatter={v => v === 'applied' ? 'Applied' : 'Hired'}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
