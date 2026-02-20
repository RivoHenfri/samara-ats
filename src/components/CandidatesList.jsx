import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, MessageCircle, ExternalLink } from 'lucide-react'
import CandidateDetail from './CandidateDetail'

// ── Stage CSS ─────────────────────────────────────────────────
const stageClass = {
  New:       'stage-new',
  Screening: 'stage-screening',
  Interview: 'stage-interview',
  Offer:     'stage-offer',
  Hired:     'stage-hired',
  Rejected:  'stage-rejected',
}

// ── Division tag CSS ──────────────────────────────────────────
function deptTag(dept) {
  if (!dept) return 'tag-src'
  const d = dept.toLowerCase()
  if (d === 'hospitality') return 'tag-hosp'
  if (d === 'operations')  return 'tag-ops'
  if (d === 'construction') return 'tag-const'
  return 'tag-src'
}

// ── IDR formatter ─────────────────────────────────────────────
function displayIDR(num) {
  if (!num) return '—'
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

// ── WhatsApp logic (unchanged from original) ──────────────────
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
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)
    const message = getWhatsAppMessage(candidate, role, lang)
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={() => setLang(lang === 'id' ? 'en' : 'id')} className="lang-toggle">
        {lang === 'id' ? 'ID' : 'EN'}
      </button>
      <button onClick={handleClick} className="wa-btn">
        <MessageCircle size={12} /> WA
      </button>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function CandidatesList() {
  const [applications, setApplications] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [lombokOnly,   setLombokOnly]   = useState(false)
  const [selectedApp,  setSelectedApp]  = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(*)')
      .order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const handleUpdated = () => {
    fetchData()
    setSelectedApp(null)
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

  // Is a row stale?
  const isStale = (app) => {
    if (['Offer', 'Hired', 'Rejected'].includes(app.stage)) return false
    const hrs = (Date.now() - new Date(app.updated_at)) / 36e5
    return hrs > 48
  }

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" />
      Loading candidates…
    </div>
  )

  return (
    <div>

      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">All Candidates</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setLombokOnly(!lombokOnly)}
            className={`btn btn-sm ${lombokOnly ? 'btn-teal' : 'btn-ghost'}`}
          >
            🌴 Lombok First
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Search bar */}
        <div className="filter-bar" style={{ marginBottom: 18 }}>
          <div className="search-wrap">
            <Search size={13} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, role, or WhatsApp…"
              className="search-input"
            />
          </div>
          <span style={{ fontSize: 11, color: 'var(--stone)' }}>
            {filtered.length} candidate{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Dept</th>
                <th>Stage</th>
                <th>Origin</th>
                <th>Current Salary</th>
                <th>Expected Salary</th>
                <th>CV</th>
                <th>WhatsApp</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(app => {
                const stale = isStale(app)
                const cvLabel = app.candidates?.full_name && app.roles?.title
                  ? `${app.candidates.full_name} – ${app.roles.title}`
                  : 'CV'
                return (
                  <tr
                    key={app.id}
                    className={stale ? 'row-stale' : ''}
                    onClick={() => setSelectedApp(app)}
                  >
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>
                        {app.candidates?.full_name}
                      </span>
                    </td>
                    <td>{app.roles?.title}</td>
                    <td>
                      <span className={`tag ${deptTag(app.roles?.department)}`}>
                        {app.roles?.department}
                      </span>
                    </td>
                    <td>
                      <span className={`stage-badge ${stageClass[app.stage] ?? 'stage-new'}`}>
                        {app.stage}
                      </span>
                    </td>
                    <td>
                      {app.candidates?.origin === 'Lombok Local' ? (
                        <span className="tag tag-lombok">🌴 Local</span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--stone)' }}>
                          {app.candidates?.origin || '—'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {displayIDR(app.candidates?.current_salary)}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {displayIDR(app.candidates?.expected_salary)}
                    </td>
                    <td>
                      {app.candidates?.cv_link ? (
                        <a
                          href={app.candidates.cv_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--teal)', fontSize: 11 }}
                        >
                          <ExternalLink size={11} />
                          {cvLabel.length > 22 ? cvLabel.slice(0, 22) + '…' : cvLabel}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--stone-light)', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--stone)' }}>
                      {app.candidates?.whatsapp || '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {app.candidates?.whatsapp ? (
                        <WhatsAppButton candidate={app.candidates} role={app.roles} />
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--stone-light)' }}>No number</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              No candidates found.
            </div>
          )}
        </div>
      </div>

      {selectedApp && (
        <CandidateDetail
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
