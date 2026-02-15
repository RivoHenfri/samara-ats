import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, Briefcase, AlertTriangle, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCandidates: 0,
    openRoles: 0,
    stagnant: 0,
    hired: 0,
  })
  const [recentApplications, setRecentApplications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const [candidatesRes, rolesRes, appsRes] = await Promise.all([
      supabase.from('candidates').select('id', { count: 'exact' }),
      supabase.from('roles').select('id', { count: 'exact' }).eq('status', 'Open'),
      supabase.from('applications').select('*, candidates(full_name), roles(title, department)').order('created_at', { ascending: false }).limit(5),
    ])

    const allApps = await supabase.from('applications').select('stage, last_stage_change_at')
    const now = new Date()
    const stagnant = allApps.data?.filter(a => {
      const hrs = (now - new Date(a.last_stage_change_at)) / 36e5
      return hrs > 48 && !['Offer', 'Hired', 'Rejected'].includes(a.stage)
    }).length || 0

    const hired = allApps.data?.filter(a => a.stage === 'Hired').length || 0

    setStats({
      totalCandidates: candidatesRes.count || 0,
      openRoles: rolesRes.count || 0,
      stagnant,
      hired,
    })
    setRecentApplications(appsRes.data || [])
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Candidates', value: stats.totalCandidates, icon: Users, color: 'text-blue-400' },
    { label: 'Open Roles', value: stats.openRoles, icon: Briefcase, color: 'text-emerald-400' },
    { label: 'Stagnant (48h+)', value: stats.stagnant, icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Hired', value: stats.hired, icon: TrendingUp, color: 'text-purple-400' },
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
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

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
        <h2 className="text-lg font-semibold text-white mb-4">Recent Applications</h2>
        {recentApplications.length === 0 ? (
          <p className="text-gray-400">No applications yet. Add your first candidate!</p>
        ) : (
          <div className="space-y-3">
            {recentApplications.map(app => (
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