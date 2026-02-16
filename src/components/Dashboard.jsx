import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Briefcase, AlertTriangle, TrendingUp } from 'lucide-react'

const DEPTS = ['All', 'Hospitality', 'Operations', 'Construction']

export default function Dashboard() {
  const [allApplications, setAllApplications] = useState([])
  const [allCandidates, setAllCandidates] = useState([])
  const [allRoles, setAllRoles] = useState([])
  const [dept, setDept] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const [appsRes, candidatesRes, rolesRes] = await Promise.all([
      supabase.from('applications').select('*, candidates(full_name, id), roles(title, department, status)').order('created_at', { ascending: false }),
      supabase.from('candidates').select('id'),
      supabase.from('roles').select('id, status, department'),
    ])
    setAllApplications(appsRes.data || [])
    setAllCandidates(candidatesRes.data || [])
    setAllRoles(rolesRes.data || [])
    setLoading(false)
  }

  // Filter applications by department
  const filteredApps = allApplications.filter(app =>
    dept === 'All' || app.roles?.department === dept
  )

  // Filter roles by department
  const filteredRoles = allRoles.filter(r =>
    dept === 'All' || r.department === dept
  )

  // Compute stats from filtered data
  const totalCandidates = dept === 'All'
    ? allCandidates.length
    : [...new Set(filteredApps.map(a => a.candidates?.id).filter(Boolean))].length

  const openRoles = filteredRoles.filter(r => r.status === 'Open').length

  const stagnant = filteredApps.filter(a => {
    if (['Offer', 'Hired', 'Rejected'].includes(a.stage)) return false
    const hrs = (Date.now() - new Date(a.last_stage_change_at)) / 36e5
    return hrs > 48
  }).length

  const hired = filteredApps.filter(a => a.stage === 'Hired').length

  const recentApps = filteredApps.slice(0, 5)

  const statCards = [
    { label: 'Total Candidates', value: totalCandidates, icon: Users, color: 'text-blue-400' },
    { label: 'Open Roles', value: openRoles, icon: Briefcase, color: 'text-emerald-400' },
    { label: 'Stagnant (48h+)', value: stagnant, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Hired', value: hired, icon: TrendingUp, color: 'text-purple-400' },
  ]

  const stageColors = {
    New: 'bg-gray-600',
    Screening: 'bg-blue-600',
    Interview: 'bg-yellow-600',
    Offer: 'bg-purple-600',
    Hired: 'bg-emerald-600',
    Rejected: 'bg-red-600',
  }

  if (loading) return <div className="p-8 text-gray-400">Loading...</div>

  return (
    <div className="p-8">
      {/* Header + Department Filter */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          {DEPTS.map(d => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dept === d
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">{card.label}</span>
              <card.icon size={20} className={card.color} />
            </div>
            <div className="text-3xl font-bold text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Applications</h2>
          {dept !== 'All' && (
            <span className="text-xs px-2 py-1 bg-emerald-900/50 text-emerald-400 rounded-full">
              {dept} only
            </span>
          )}
        </div>
        {recentApps.length === 0 ? (
          <p className="text-gray-400">No applications found{dept !== 'All' ? ` in ${dept}` : ''}.</p>
        ) : (
          <div className="space-y-3">
            {recentApps.map(app => (
              <div key={app.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white font-medium">{app.candidates?.full_name}</p>
                  <p className="text-gray-400 text-sm">{app.roles?.title} · {app.roles?.department}</p>
                </div>
                <span className={`text-xs text-white px-3 py-1 rounded-full ${stageColors[app.stage]}`}>
                  {app.stage}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}