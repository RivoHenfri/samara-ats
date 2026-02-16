import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell, PieChart, Pie, Legend } from 'recharts'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

const STAGE_COLORS = {
  New: '#6b7280',
  Screening: '#3b82f6',
  Interview: '#eab308',
  Offer: '#a855f7',
  Hired: '#10b981',
  Rejected: '#ef4444',
}

const DEPT_COLORS = ['#10b981', '#3b82f6', '#f59e0b']

export default function Analytics() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(title, department)')
    setApplications(data || [])
    setLoading(false)
  }

  // --- Pipeline Funnel Data ---
  const funnelData = STAGES.map(stage => ({
    name: stage,
    value: applications.filter(a => a.stage === stage).length,
    fill: STAGE_COLORS[stage],
  }))

  // --- Conversion Rates ---
  const conversionData = []
  for (let i = 0; i < STAGES.length - 1; i++) {
    const from = STAGES[i]
    const to = STAGES[i + 1]
    const fromCount = applications.filter(a => a.stage === from).length
    const toCount = applications.filter(a => a.stage === to).length
    const total = fromCount + toCount
    const rate = total > 0 ? Math.round((toCount / total) * 100) : 0
    conversionData.push({ name: `${from} → ${to}`, rate })
  }

  // --- Time to Hire ---
  const hiredApps = applications.filter(a => a.stage === 'Hired' && a.created_at && a.updated_at)
  const avgDays = hiredApps.length > 0
    ? Math.round(
        hiredApps.reduce((sum, a) => {
          const days = (new Date(a.updated_at) - new Date(a.created_at)) / (1000 * 60 * 60 * 24)
          return sum + days
        }, 0) / hiredApps.length
      )
    : null

  // --- Department Breakdown ---
  const deptMap = {}
  applications.forEach(a => {
    const dept = a.roles?.department || 'Unknown'
    deptMap[dept] = (deptMap[dept] || 0) + 1
  })
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

  if (loading) return <div className="p-8 text-gray-400">Loading analytics...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Analytics</h1>

      {applications.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          <p className="text-lg">No data yet.</p>
          <p className="text-sm mt-1">Add candidates to start seeing analytics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Pipeline Funnel */}
          <div className="bg-gray-800 rounded-xl p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-1">Pipeline Funnel</h2>
            <p className="text-gray-500 text-sm mb-4">Candidates per stage</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  itemStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {funnelData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion Rates */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Conversion Rates</h2>
            <p className="text-gray-500 text-sm mb-4">% advancing to next stage</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={conversionData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                  formatter={(v) => [`${v}%`, 'Rate']}
                />
                <Bar dataKey="rate" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Right column: Time to hire + Dept breakdown */}
          <div className="flex flex-col gap-6">

            {/* Time to Hire */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-1">Time to Hire</h2>
              <p className="text-gray-500 text-sm mb-4">Average days from application to hired</p>
              {avgDays !== null ? (
                <div className="flex items-end gap-2">
                  <span className="text-6xl font-bold text-emerald-400">{avgDays}</span>
                  <span className="text-gray-400 mb-2">days avg</span>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No hired candidates yet.</p>
              )}
              <p className="text-gray-600 text-xs mt-3">Based on {hiredApps.length} hired candidate{hiredApps.length !== 1 ? 's' : ''}</p>
            </div>

            {/* Department Breakdown */}
            <div className="bg-gray-800 rounded-xl p-6 flex-1">
              <h2 className="text-lg font-semibold text-white mb-1">By Department</h2>
              <p className="text-gray-500 text-sm mb-2">Applications per department</p>
              {deptData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie
                      data={deptData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {deptData.map((_, index) => (
                        <Cell key={index} fill={DEPT_COLORS[index % DEPT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                      itemStyle={{ color: '#9ca3af' }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-sm">No data yet.</p>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}