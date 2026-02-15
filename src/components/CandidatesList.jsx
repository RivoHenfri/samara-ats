import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Phone, Mail } from 'lucide-react'

const stageColors = {
  New: 'bg-gray-600',
  Screening: 'bg-blue-600',
  Interview: 'bg-yellow-600',
  Offer: 'bg-purple-600',
  Hired: 'bg-emerald-600',
  Rejected: 'bg-red-600',
}

export default function CandidatesList() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lombokOnly, setLombokOnly] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(*)')
      .order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const filtered = applications.filter(app => {
    if (lombokOnly && app.candidates?.origin !== 'Lombok Local') return false
    if (search) {
      const q = search.toLowerCase()
      return (
        app.candidates?.full_name?.toLowerCase().includes(q) ||
        app.roles?.title?.toLowerCase().includes(q) ||
        app.candidates?.whatsapp?.includes(q)
      )
    }
    return true
  })

  if (loading) return <div className="p-8 text-gray-400">Loading candidates...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">All Candidates</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLombokOnly(!lombokOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              lombokOnly ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}
          >
            🏝️ Lombok First
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, role, or WhatsApp..."
          className="w-full bg-gray-800 text-white pl-9 pr-4 py-2.5 rounded-lg outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-sm px-4 py-3">Name</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Role</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Dept</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Origin</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Contact</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Stage</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(app => (
              <tr key={app.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{app.candidates?.full_name}</td>
                <td className="px-4 py-3 text-gray-300 text-sm">{app.roles?.title}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{app.roles?.department}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{app.candidates?.origin}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {app.candidates?.whatsapp && (
                      <a href={`https://wa.me/${app.candidates.whatsapp}`} target="_blank" rel="noreferrer"
                        className="text-emerald-400 hover:text-emerald-300">
                        <Phone size={14} />
                      </a>
                    )}
                    {app.candidates?.email && (
                      <a href={`mailto:${app.candidates.email}`} className="text-blue-400 hover:text-blue-300">
                        <Mail size={14} />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs text-white px-2 py-1 rounded-full ${stageColors[app.stage]}`}>
                    {app.stage}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No candidates found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}