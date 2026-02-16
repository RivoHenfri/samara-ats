import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, MessageCircle } from 'lucide-react'

const stageColors = {
  New: 'bg-gray-600',
  Screening: 'bg-blue-600',
  Interview: 'bg-yellow-600',
  Offer: 'bg-purple-600',
  Hired: 'bg-emerald-600',
  Rejected: 'bg-red-600',
}

function getWhatsAppMessage(candidate, role, lang) {
  const name = candidate?.full_name?.split(' ')[0] || 'there'
  const roleTitle = role?.title || 'the position'

  if (lang === 'id') {
    return `Halo ${name}, perkenalkan saya Satya dari Samara Lombok. Kami telah meninjau lamaran Anda untuk posisi ${roleTitle} dan ingin berdiskusi lebih lanjut. Apakah Anda ada waktu untuk ngobrol sebentar?`
  }
  return `Hi ${name}, this is Satya from Samara Lombok. We reviewed your application for ${roleTitle} and would love to connect. Are you available for a quick chat?`
}

function WhatsAppButton({ candidate, role }) {
  const [lang, setLang] = useState('id')

  const handleClick = () => {
    const raw = candidate?.whatsapp || ''
    // Normalize: strip spaces/dashes, ensure starts with 62
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)

    const message = getWhatsAppMessage(candidate, role, lang)
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  return (
    <div className="flex items-center gap-1">
      {/* Language toggle */}
      <button
        onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
        className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors font-mono"
        title="Toggle language"
      >
        {lang === 'id' ? 'ID' : 'EN'}
      </button>
      {/* WhatsApp button */}
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors font-medium"
        title={`Send WhatsApp in ${lang === 'id' ? 'Bahasa Indonesia' : 'English'}`}
      >
        <MessageCircle size={14} />
        WA
      </button>
    </div>
  )
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
              <th className="text-left text-gray-400 text-sm px-4 py-3">Stage</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Origin</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">WhatsApp</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(app => (
              <tr key={app.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{app.candidates?.full_name}</td>
                <td className="px-4 py-3 text-gray-300">{app.roles?.title}</td>
                <td className="px-4 py-3 text-gray-400 text-sm">{app.roles?.department}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full text-white ${stageColors[app.stage] || 'bg-gray-600'}`}>
                    {app.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{app.candidates?.origin}</td>
                <td className="px-4 py-3 text-gray-400 text-sm font-mono">{app.candidates?.whatsapp || '—'}</td>
                <td className="px-4 py-3">
                  {app.candidates?.whatsapp ? (
                    <WhatsAppButton candidate={app.candidates} role={app.roles} />
                  ) : (
                    <span className="text-gray-600 text-xs">No number</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-12">No candidates found</div>
        )}
      </div>
    </div>
  )
}