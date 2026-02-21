import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Search, MessageCircle, ExternalLink } from 'lucide-react'
import CandidateDetail from './CandidateDetail'

// ── Stage CSS ─────────────────────────────────────────────────
const stageClass = {
  New: 'stage-new',
  Screening: 'stage-screening',
  Interview: 'stage-interview',
  Offer: 'stage-offer',
  Hired: 'stage-hired',
  Rejected: 'stage-rejected',
}

// ── Division tag CSS ──────────────────────────────────────────
function deptTag(dept) {
  if (!dept) return 'tag-src'
  const d = dept.toLowerCase()
  if (d === 'hospitality') return 'tag-hosp'
  if (d === 'operations') return 'tag-ops'
  if (d === 'construction') return 'tag-const'
  return 'tag-src'
}

// ── IDR formatter ─────────────────────────────────────────────
function displayIDR(num) {
  if (!num) return '—'
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

function getWhatsAppMessage(candidate, role, stage, lang) {
  const name = candidate?.full_name?.split(' ')[0] || 'there'
  const roleTitle = role?.title || 'the position'
  const templates = {
    New: { en: `Hi ${name}, this is Satya from Samara Lombok. We received your application for ${roleTitle} and would love to learn more about you.`, id: `Halo ${name}, perkenalkan saya Satya dari Samara Lombok. Kami menerima lamaran Anda untuk posisi ${roleTitle} dan ingin mengenal Anda lebih lanjut.` },
    Screening: { en: `Hi ${name}, this is Satya from Samara Lombok. We'd like to schedule a screening call for the ${roleTitle} role.`, id: `Halo ${name}, ini Satya dari Samara Lombok. Kami ingin menjadwalkan sesi screening untuk posisi ${roleTitle}.` },
    Interview: { en: `Hi ${name}, this is Satya from Samara Lombok. Great news — we'd like to invite you for an interview for the ${roleTitle} position.`, id: `Halo ${name}, ini Satya dari Samara Lombok. Kabar baik — kami ingin mengundang Anda untuk interview posisi ${roleTitle}.` },
    Offer: { en: `Hi ${name}, this is Satya from Samara Lombok. We're excited to move forward with you for the ${roleTitle} role.`, id: `Halo ${name}, ini Satya dari Samara Lombok. Kami senang ingin melanjutkan proses dengan Anda untuk posisi ${roleTitle}.` },
    Hired: { en: `Hi ${name}, congratulations and welcome to Samara Lombok!`, id: `Halo ${name}, selamat dan selamat datang di Samara Lombok!` },
    Rejected: { en: `Hi ${name}, this is Satya from Samara Lombok. Thank you for your interest in the ${roleTitle} role. After careful consideration, we'll be moving forward with other candidates. We wish you all the best!`, id: `Halo ${name}, ini Satya dari Samara Lombok. Terima kasih atas minat Anda pada posisi ${roleTitle}. Setelah pertimbangan matang, kami akan melanjutkan dengan kandidat lain. Semoga sukses selalu!` },
  }
  const template = templates[stage] || templates.New
  return lang === 'id' ? template.id : template.en
}

function WhatsAppButton({ candidate, role, stage }) {
  const [lang, setLang] = useState('id')
  const handleClick = (e) => {
    e.stopPropagation()
    const raw = candidate?.whatsapp || ''
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)
    const message = getWhatsAppMessage(candidate, role, stage || 'New', lang)
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button onClick={(e) => { e.stopPropagation(); setLang(lang === 'id' ? 'en' : 'id') }} className="lang-toggle">
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
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lombokOnly, setLombokOnly] = useState(false)
  const [selectedApp, setSelectedApp] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [lastSelected, setLastSelected] = useState(null)
  const [bulkMessaging, setBulkMessaging] = useState(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setSelectedIds([])
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

  const handleSelect = (app, e) => {
    e.stopPropagation()
    const isSelected = selectedIds.includes(app.id)
    if (e.shiftKey && lastSelected) {
      const lastIdx = filtered.findIndex(a => a.id === lastSelected)
      const currIdx = filtered.findIndex(a => a.id === app.id)
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx)
        const end = Math.max(lastIdx, currIdx)
        const slice = filtered.slice(start, end + 1).map(a => a.id)
        const newSelected = new Set([...selectedIds, ...slice])
        setSelectedIds(Array.from(newSelected).slice(0, 50))
        setLastSelected(app.id)
        return
      }
    }
    if (isSelected) {
      setSelectedIds(selectedIds.filter(id => id !== app.id))
      setLastSelected(null)
    } else {
      if (selectedIds.length < 50) {
        setSelectedIds([...selectedIds, app.id])
        setLastSelected(app.id)
      } else {
        alert("You can select up to 50 candidates.")
      }
    }
  }

  const handleBulkReject = async () => {
    if (!window.confirm(`Are you sure you want to reject ${selectedIds.length} candidate(s)?`)) return
    await supabase.from('applications').update({ stage: 'Rejected' }).in('id', selectedIds)
    const appsToMessage = filtered.filter(a => selectedIds.includes(a.id) && a.candidates?.whatsapp)
    if (appsToMessage.length > 0) {
      setBulkMessaging({ apps: appsToMessage, currentIndex: 0, lang: 'id', stage: 'Rejected' })
    }
    fetchData()
  }

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
                <th style={{ width: 40, paddingLeft: 16 }}>
                  <input
                    type="checkbox"
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(filtered.slice(0, 50).map(a => a.id))
                      else setSelectedIds([])
                      setLastSelected(null)
                    }}
                  />
                </th>
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
                const isSelected = selectedIds.includes(app.id)
                return (
                  <tr
                    key={app.id}
                    className={stale ? 'row-stale' : ''}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(74, 124, 116, 0.08)' : (stale ? 'rgba(192, 97, 74, 0.03)' : 'white'),
                      borderLeft: isSelected ? '4px solid var(--teal)' : 'none'
                    }}
                    onClick={(e) => {
                      // If user clicks the row, handle multi-selection
                      handleSelect(app, e.nativeEvent)
                    }}
                  >
                    <td style={{ paddingLeft: 16, width: 40 }}>
                      <input
                        type="checkbox"
                        readOnly
                        checked={isSelected}
                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                      />
                    </td>
                    <td onClick={(e) => {
                      // Only open detail if clicking the NAME specifically
                      e.stopPropagation()
                      setSelectedApp(app)
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--charcoal)', textDecoration: 'underline', textDecorationColor: 'rgba(0,0,0,0.1)' }}>
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
                        <WhatsAppButton candidate={app.candidates} role={app.roles} stage={app.stage} />
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

      {selectedIds.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 30, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--charcoal)', color: 'white', padding: '12px 24px',
          borderRadius: 30, display: 'flex', alignItems: 'center', gap: 16,
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 100
        }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedIds.length} candidate(s) selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleBulkReject} className="btn btn-sm" style={{ background: 'var(--alert)', color: 'white', border: 'none' }}>Bulk Reject</button>
            <button onClick={() => setSelectedIds([])} className="btn btn-ghost btn-sm" style={{ color: 'var(--stone-light)', border: 'none' }}>Cancel</button>
          </div>
        </div>
      )}

      {selectedApp && (
        <CandidateDetail
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdated={handleUpdated}
        />
      )}

      {bulkMessaging && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="card" style={{ padding: 24, width: 400, maxWidth: '90%' }}>
            <h3 style={{ marginBottom: 8, color: 'var(--charcoal)' }}>WhatsApp Broadcasting</h3>
            <p style={{ fontSize: 13, color: 'var(--stone)', marginBottom: 16 }}>
              Sending localized messages ({bulkMessaging.currentIndex + 1} of {bulkMessaging.apps.length})
            </p>
            <div style={{ background: 'var(--sand-light)', padding: 16, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
              <strong>To:</strong> {bulkMessaging.apps[bulkMessaging.currentIndex].candidates.full_name}<br />
              <strong>WhatsApp:</strong> {bulkMessaging.apps[bulkMessaging.currentIndex].candidates.whatsapp}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                onClick={() => setBulkMessaging({ ...bulkMessaging, lang: 'id' })}
                className={`btn btn-sm ${bulkMessaging.lang === 'id' ? 'btn-primary' : 'btn-ghost'}`}
              >
                ID (Bahasa)
              </button>
              <button
                onClick={() => setBulkMessaging({ ...bulkMessaging, lang: 'en' })}
                className={`btn btn-sm ${bulkMessaging.lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              >
                EN (English)
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={() => setBulkMessaging(null)} className="btn btn-ghost btn-sm">Cancel</button>
              <button
                onClick={() => {
                  const app = bulkMessaging.apps[bulkMessaging.currentIndex]
                  const raw = app.candidates?.whatsapp || ''
                  let number = raw.replace(/[\s\-\(\)]/g, '')
                  if (number.startsWith('0')) number = '62' + number.slice(1)
                  if (number.startsWith('+')) number = number.slice(1)

                  const message = getWhatsAppMessage(app.candidates, app.roles, bulkMessaging.stage, bulkMessaging.lang)
                  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')

                  if (bulkMessaging.currentIndex < bulkMessaging.apps.length - 1) {
                    setBulkMessaging({ ...bulkMessaging, currentIndex: bulkMessaging.currentIndex + 1 })
                  } else {
                    setBulkMessaging(null)
                  }
                }}
                className="btn btn-primary btn-sm"
              >
                Send & Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
