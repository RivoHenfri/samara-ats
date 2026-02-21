import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, MessageCircle, ExternalLink, X, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import CandidateDetail from './CandidateDetail'
import MultiSelectDropdown from './MultiSelectDropdown'

const stages = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']
const departments = ['Hospitality', 'Operations', 'Construction']
const origins = ['Lombok Local', 'Indonesian Expat', 'International']

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
  const [searchParams, setSearchParams] = useSearchParams()

  const [applications, setApplications] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [presets, setPresets] = useState(() => {
    const saved = localStorage.getItem('candidate_filter_presets')
    return saved ? JSON.parse(saved) : []
  })

  // Selection state
  const [selectedApp, setSelectedApp] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [lastSelected, setLastSelected] = useState(null)
  const [bulkMessaging, setBulkMessaging] = useState(null)

  // Filters from URL
  const search = searchParams.get('q') || ''
  const roleFilters = searchParams.get('roles')?.split(',').filter(Boolean) || []
  const deptFilters = searchParams.get('depts')?.split(',').filter(Boolean) || []
  const stageFilters = searchParams.get('stages')?.split(',').filter(Boolean) || []
  const originFilters = searchParams.get('origins')?.split(',').filter(Boolean) || []
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = 20

  useEffect(() => {
    // Fetch roles for the filter dropdown
    supabase.from('roles').select('id, title, department').order('title').then(({ data }) => {
      setRoles(data || [])
    })
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setSelectedIds([])

    let query = supabase
      .from('applications')
      .select('*, candidates!inner(*), roles!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Apply Filters
    if (search) {
      // Search in candidates table (name and whatsapp)
      query = query.or(`full_name.ilike.%${search}%,whatsapp.ilike.%${search}%`, { foreignTable: 'candidates' })
    }

    if (roleFilters.length > 0) {
      query = query.in('role_id', roleFilters)
    }

    if (deptFilters.length > 0) {
      query = query.in('roles.department', deptFilters)
    }

    if (stageFilters.length > 0) {
      query = query.in('stage', stageFilters)
    }

    if (originFilters.length > 0) {
      query = query.in('candidates.origin', originFilters)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error('Error fetching applications:', error)
    } else {
      setApplications(data || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [search, roleFilters.join(','), deptFilters.join(','), stageFilters.join(','), originFilters.join(','), page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateFilters = (key, values) => {
    const nextParams = new URLSearchParams(searchParams)
    if (values && values.length > 0) {
      if (Array.isArray(values)) {
        nextParams.set(key, values.join(','))
      } else {
        nextParams.set(key, values)
      }
    } else {
      nextParams.delete(key)
    }
    nextParams.set('page', '1') // Reset to page 1 on filter change
    setSearchParams(nextParams)
  }

  const clearAllFilters = () => {
    setSearchParams(new URLSearchParams())
  }

  const savePreset = () => {
    const name = window.prompt("Enter preset name (e.g., 'Screening – HR Role'):")
    if (!name) return
    const newPreset = {
      name,
      params: searchParams.toString()
    }
    const updated = [...presets, newPreset]
    setPresets(updated)
    localStorage.setItem('candidate_filter_presets', JSON.stringify(updated))
  }

  const deletePreset = (index, e) => {
    e.stopPropagation()
    const updated = presets.filter((_, i) => i !== index)
    setPresets(updated)
    localStorage.setItem('candidate_filter_presets', JSON.stringify(updated))
  }

  const applyPreset = (params) => {
    setSearchParams(new URLSearchParams(params))
  }

  const handleSelect = (app, e) => {
    e.stopPropagation()
    const isSelected = selectedIds.includes(app.id)
    if (e.shiftKey && lastSelected) {
      const lastIdx = applications.findIndex(a => a.id === lastSelected)
      const currIdx = applications.findIndex(a => a.id === app.id)
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx)
        const end = Math.max(lastIdx, currIdx)
        const slice = applications.slice(start, end + 1).map(a => a.id)
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

  const handleUpdated = () => {
    fetchData()
    setSelectedApp(null)
  }

  const handleBulkReject = async () => {
    if (!window.confirm(`Are you sure you want to reject ${selectedIds.length} candidate(s)?`)) return
    await supabase.from('applications').update({ stage: 'Rejected' }).in('id', selectedIds)
    const appsToMessage = applications.filter(a => selectedIds.includes(a.id) && a.candidates?.whatsapp)
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
        <h1 className="page-title">All Candidates V2</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => updateFilters('origins', originFilters.includes('Lombok Local') ? originFilters.filter(o => o !== 'Lombok Local') : [...originFilters, 'Lombok Local'])}
            className={`btn btn-sm ${originFilters.includes('Lombok Local') ? 'btn-teal' : 'btn-ghost'}`}
          >
            🌴 Lombok First
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="search-wrap" style={{ flex: 'none', width: 260 }}>
              <Search size={13} />
              <input
                type="text"
                value={search}
                onChange={e => updateFilters('q', e.target.value)}
                placeholder="Search candidates…"
                className="search-input"
              />
            </div>

            <MultiSelectDropdown
              label="Role"
              options={roles.map(r => ({ label: r.title, value: r.id }))}
              selectedValues={roleFilters}
              onChange={vals => updateFilters('roles', vals)}
            />

            <MultiSelectDropdown
              label="Department"
              options={departments.map(d => ({ label: d, value: d }))}
              selectedValues={deptFilters}
              onChange={vals => updateFilters('depts', vals)}
            />

            <MultiSelectDropdown
              label="Stage"
              options={stages.map(s => ({ label: s, value: s }))}
              selectedValues={stageFilters}
              onChange={vals => updateFilters('stages', vals)}
            />

            <MultiSelectDropdown
              label="Origin"
              options={origins.map(o => ({ label: o, value: o }))}
              selectedValues={originFilters}
              onChange={vals => updateFilters('origins', vals)}
            />

            <div className="relative group">
              <button className="btn btn-ghost btn-sm">
                Presets {presets.length > 0 && `(${presets.length})`}
              </button>
              <div className="absolute left-0 mt-2 w-56 bg-white border border-sand-dark rounded-md shadow-lg hidden group-hover:block z-50 animate-slide-down">
                <div className="p-2 border-b border-sand-light">
                  <span className="text-[10px] font-bold text-stone uppercase tracking-wider">Saved Presets</span>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {presets.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-stone italic">No presets saved</div>
                  ) : (
                    presets.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-2 hover:bg-sand-light cursor-pointer group/item"
                        onClick={() => applyPreset(p.params)}
                      >
                        <span className="text-xs text-charcoal truncate">{p.name}</span>
                        <X
                          size={12}
                          className="text-stone hover:text-alert opacity-0 group-hover/item:opacity-100"
                          onClick={(e) => deletePreset(i, e)}
                        />
                      </div>
                    ))
                  )}
                </div>
                <div className="p-2 border-t border-sand-light">
                  <button
                    onClick={savePreset}
                    className="w-full text-center py-1.5 text-[10px] font-bold text-teal uppercase tracking-wider hover:bg-teal-bg rounded transition-colors"
                  >
                    Save Current View
                  </button>
                </div>
              </div>
            </div>

            {(roleFilters.length > 0 || deptFilters.length > 0 || stageFilters.length > 0 || originFilters.length > 0 || search) && (
              <button
                onClick={clearAllFilters}
                className="btn btn-ghost btn-sm text-stone flex items-center gap-1.5"
                style={{ border: 'none', background: 'none', color: 'var(--stone)' }}
              >
                <RotateCcw size={12} /> Clear All
              </button>
            )}
          </div>

          {/* Active Tags */}
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontSize: 11, color: 'var(--stone)', marginRight: 4, fontWeight: 500 }}>
              {loading ? 'Searching...' : `${totalCount} candidate${totalCount !== 1 ? 's' : ''} found`}
            </span>

            {roleFilters.map(id => {
              const role = roles.find(r => r.id === id)
              return (
                <span key={id} className="tag tag-src flex items-center gap-1">
                  {role?.title || id}
                  <X size={10} className="cursor-pointer" onClick={() => updateFilters('roles', roleFilters.filter(v => v !== id))} />
                </span>
              )
            })}

            {deptFilters.map(d => (
              <span key={d} className="tag tag-src flex items-center gap-1">
                {d}
                <X size={10} className="cursor-pointer" onClick={() => updateFilters('depts', deptFilters.filter(v => v !== d))} />
              </span>
            ))}

            {stageFilters.map(s => (
              <span key={s} className="tag tag-src flex items-center gap-1">
                {s}
                <X size={10} className="cursor-pointer" onClick={() => updateFilters('stages', stageFilters.filter(v => v !== s))} />
              </span>
            ))}

            {originFilters.map(o => (
              <span key={o} className="tag tag-src flex items-center gap-1">
                {o}
                <X size={10} className="cursor-pointer" onClick={() => updateFilters('origins', originFilters.filter(v => v !== o))} />
              </span>
            ))}
          </div>
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
                    checked={applications.length > 0 && selectedIds.length === applications.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(applications.slice(0, 50).map(a => a.id))
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
              {applications.map(app => {
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
          {applications.length === 0 && !loading && (
            <div className="empty-state">
              No candidates found matching the filters.
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalCount > pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <button
              disabled={page === 1 || loading}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', (page - 1).toString())
                setSearchParams(p)
              }}
              className="btn btn-ghost btn-xs"
              style={{ borderRadius: 20, padding: '6px 14px' }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: 12, color: 'var(--stone)', fontWeight: 500 }}>
              Page {page} of {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              disabled={page >= Math.ceil(totalCount / pageSize) || loading}
              onClick={() => {
                const p = new URLSearchParams(searchParams)
                p.set('page', (page + 1).toString())
                setSearchParams(p)
              }}
              className="btn btn-ghost btn-xs"
              style={{ borderRadius: 20, padding: '6px 14px' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        )}
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
