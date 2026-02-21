import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  FileText, Link2, Upload, Eye, Download,
  ChevronDown, ChevronUp, AlertTriangle,
  Clock, Loader2, CheckCircle, X, Sparkles, ExternalLink,
} from 'lucide-react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY

const ALLOWED_TYPES = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── AI: full CV parse ─────────────────────────────────────────────────────────
async function parseCVWithClaude(base64Data, mimeType) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: mimeType, data: base64Data },
          },
          {
            type: 'text',
            text: `Analyze this CV/resume thoroughly. Return ONLY a valid JSON object — no explanation, no markdown fences:
{
  "full_name": "string or empty",
  "whatsapp": "phone digits only or empty",
  "email": "string or empty",
  "current_salary": null or monthly gross IDR as number,
  "current_role": "most recent job title or empty",
  "skills": ["array", "of", "skill", "strings"],
  "experience_years": null or total years of work experience as number,
  "employment_history": [
    { "company": "string", "role": "string", "start": "YYYY-MM or empty", "end": "YYYY-MM or Present", "duration_months": number }
  ],
  "education": [
    { "institution": "string", "degree": "string", "field": "string", "year": null or number }
  ],
  "employment_gaps": [
    { "from": "YYYY-MM", "to": "YYYY-MM", "duration_months": number }
  ],
  "average_tenure_months": null or number,
  "flags": ["risk signal strings — e.g. 'Frequent job changes (avg < 12 months)', 'Employment gap detected (> 3 months)', 'No formal education listed'"]
}`,
          },
        ],
      }],
    }),
  })

  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'Claude API error')
  const text = data.content?.[0]?.text
  if (!text) throw new Error('No response from Claude')
  return JSON.parse(text.replace(/```json|```/g, '').trim())
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function ParsedRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: 'var(--stone)',
        minWidth: 90, flexShrink: 0,
      }}>{label}</p>
      <p style={{ fontSize: 12, color: 'var(--charcoal)' }}>{value}</p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
// Props:
//   candidateId  — UUID of the candidate
//   canEdit      — boolean (Admin/Manager only)
export default function CVSourcePanel({ candidateId, canEdit }) {
  const { user } = useAuth()
  const [sources,         setSources]         = useState([])
  const [loading,         setLoading]         = useState(true)
  const [inputMode,       setInputMode]       = useState(null) // null | 'upload' | 'link'
  const [pendingFile,     setPendingFile]     = useState(null)
  const [pendingLink,     setPendingLink]     = useState('')
  const [uploading,       setUploading]       = useState(false)
  const [parsing,         setParsing]         = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [error,           setError]           = useState(null)
  const [showHistory,     setShowHistory]     = useState(false)
  const [showParsed,      setShowParsed]      = useState(false)
  const fileRef = useRef()

  const activeSource   = sources.find(s => s.is_active) ?? sources[0] ?? null
  const historyEntries = sources.filter(s => s.id !== activeSource?.id)

  useEffect(() => {
    if (candidateId) fetchSources()
  }, [candidateId])

  const fetchSources = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('cv_sources')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
    setSources(data || [])
    setLoading(false)
  }

  // ── File validation ─────────────────────────────────────────────────────────
  const validateFile = (file) => {
    if (!ALLOWED_TYPES[file.type]) {
      setError('Only PDF, DOC, or DOCX files are allowed.')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be under 10 MB.')
      return false
    }
    return true
  }

  const handleFileSelect = (file) => {
    if (!file) return
    setError(null)
    if (validateFile(file)) setPendingFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files?.[0])
  }

  // ── Upload file to Supabase Storage + create cv_source ─────────────────────
  const handleUploadAndParse = async () => {
    if (!pendingFile) return
    setUploading(true)
    setError(null)

    try {
      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${candidateId}/${crypto.randomUUID()}_${safeName}`

      const { error: storageErr } = await supabase.storage
        .from('cvs')
        .upload(path, pendingFile, { contentType: pendingFile.type, upsert: false })

      if (storageErr) {
        if (storageErr.message?.toLowerCase().includes('bucket')) {
          throw new Error("Storage bucket 'cvs' not found. Ask your admin to create it in Supabase Dashboard → Storage.")
        }
        throw new Error(storageErr.message)
      }

      // AI parse (PDF only, non-fatal if it fails)
      let parsedData = null
      let parsedAt   = null
      if (pendingFile.type === 'application/pdf' && ANTHROPIC_KEY) {
        setParsing(true)
        try {
          const base64 = await fileToBase64(pendingFile)
          parsedData = await parseCVWithClaude(base64, pendingFile.type)
          parsedAt   = new Date().toISOString()
        } catch (parseErr) {
          console.warn('AI parse skipped:', parseErr.message)
        }
        setParsing(false)
      }

      const { error: dbErr } = await supabase.from('cv_sources').insert({
        candidate_id: candidateId,
        source_type:  'upload',
        file_path:    path,
        file_name:    pendingFile.name,
        file_size:    pendingFile.size,
        file_type:    pendingFile.type,
        uploaded_by:  user?.id,
        is_active:    true,
        parsed_data:  parsedData,
        parsed_at:    parsedAt,
      })
      if (dbErr) throw new Error(dbErr.message)

      setPendingFile(null)
      setInputMode(null)
      if (parsedData) setShowParsed(true)
      await fetchSources()
    } catch (err) {
      setError(err.message)
    }

    setUploading(false)
    setParsing(false)
  }

  // ── Save external link ──────────────────────────────────────────────────────
  const handleSaveLink = async () => {
    if (!pendingLink.trim()) return
    try { new URL(pendingLink) } catch { setError('Please enter a valid URL.'); return }

    setUploading(true)
    setError(null)
    const { error: dbErr } = await supabase.from('cv_sources').insert({
      candidate_id: candidateId,
      source_type:  'link',
      file_url:     pendingLink.trim(),
      uploaded_by:  user?.id,
      is_active:    true,
    })
    if (dbErr) { setError(dbErr.message); setUploading(false); return }

    setPendingLink('')
    setInputMode(null)
    await fetchSources()
    setUploading(false)
  }

  // ── View CV ─────────────────────────────────────────────────────────────────
  const handleView = async (source) => {
    if (source.source_type === 'link') {
      window.open(source.file_url, '_blank', 'noopener,noreferrer')
      return
    }
    const { data, error: urlErr } = await supabase.storage
      .from('cvs')
      .createSignedUrl(source.file_path, 3600)
    if (urlErr || !data?.signedUrl) { setError('Could not generate view link.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  // ── Download CV ─────────────────────────────────────────────────────────────
  const handleDownload = async (source) => {
    if (source.source_type !== 'upload') return
    setDownloadLoading(true)
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('cvs')
        .download(source.file_path)
      if (dlErr) throw new Error('Could not download file.')
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = source.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      setError(err.message)
    }
    setDownloadLoading(false)
  }

  // ── Re-parse existing upload with AI ───────────────────────────────────────
  const handleParseWithAI = async (source) => {
    if (source.source_type !== 'upload' || !ANTHROPIC_KEY) return
    setParsing(true)
    setError(null)
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('cvs')
        .download(source.file_path)
      if (dlErr) throw new Error('Could not download file for parsing.')
      const base64 = await blobToBase64(blob)
      const parsedData = await parseCVWithClaude(base64, source.file_type)
      await supabase.from('cv_sources')
        .update({ parsed_data: parsedData, parsed_at: new Date().toISOString() })
        .eq('id', source.id)
      await fetchSources()
      setShowParsed(true)
    } catch (err) {
      setError('AI parsing failed: ' + err.message)
    }
    setParsing(false)
  }

  // ── Link permission warning ─────────────────────────────────────────────────
  const getLinkWarning = (url) => {
    try {
      const { hostname } = new URL(url)
      const known = ['drive.google.com', 'dropbox.com', 'onedrive.live.com', '1drv.ms', 'sharepoint.com']
      return known.some(d => hostname.includes(d))
        ? 'Ensure the link is set to "Anyone with the link can view".'
        : null
    } catch { return null }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--stone)', fontSize: 12.5, padding: '4px 0' }}>
      <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
      Loading CV…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
          borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--alert)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--alert)', padding: 0 }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Active source card ── */}
      {activeSource ? (
        <div style={{ border: '1px solid var(--sand-dark)', borderRadius: 8, background: 'var(--sand-light)', overflow: 'hidden' }}>

          {/* Header row */}
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: activeSource.source_type === 'upload' ? 'var(--teal-bg)' : 'var(--gold-bg)',
              color:      activeSource.source_type === 'upload' ? 'var(--teal)'    : 'var(--gold)',
            }}>
              {activeSource.source_type === 'upload' ? <FileText size={16} /> : <Link2 size={16} />}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeSource.source_type === 'upload' ? activeSource.file_name : 'External Link'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--stone)' }}>
                {activeSource.source_type === 'upload'
                  ? [ALLOWED_TYPES[activeSource.file_type] || 'File', formatBytes(activeSource.file_size)].filter(Boolean).join(' · ')
                  : (activeSource.file_url || '').replace(/^https?:\/\//, '').split('/')[0]
                }
                {' · '}{relTime(activeSource.created_at)}
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => handleView(activeSource)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Eye size={11} /> View
              </button>
              {activeSource.source_type === 'upload' && (
                <button
                  onClick={() => handleDownload(activeSource)}
                  disabled={downloadLoading}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Download size={11} />
                  {downloadLoading ? '…' : 'Download'}
                </button>
              )}
            </div>
          </div>

          {/* AI parsed data section */}
          {activeSource.parsed_data && (
            <>
              <div
                onClick={() => setShowParsed(v => !v)}
                style={{
                  padding: '8px 14px', borderTop: '1px solid var(--sand-dark)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <Sparkles size={11} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--teal)' }}>
                  AI Analysis
                </span>
                {activeSource.parsed_data.flags?.length > 0 && (
                  <span style={{
                    background: 'var(--alert-bg)', color: 'var(--alert)',
                    borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 600,
                  }}>
                    {activeSource.parsed_data.flags.length} flag{activeSource.parsed_data.flags.length > 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', color: 'var(--stone)' }}>
                  {showParsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
              </div>

              {showParsed && (
                <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--sand-dark)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeSource.parsed_data.current_role && (
                    <ParsedRow label="Current Role" value={activeSource.parsed_data.current_role} />
                  )}
                  {activeSource.parsed_data.experience_years != null && (
                    <ParsedRow
                      label="Experience"
                      value={`${activeSource.parsed_data.experience_years} yr${activeSource.parsed_data.experience_years !== 1 ? 's' : ''}`}
                    />
                  )}
                  {activeSource.parsed_data.average_tenure_months != null && (
                    <ParsedRow
                      label="Avg Tenure"
                      value={`${Math.round(activeSource.parsed_data.average_tenure_months)} months`}
                    />
                  )}

                  {/* Skills */}
                  {activeSource.parsed_data.skills?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 5 }}>Skills</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {activeSource.parsed_data.skills.slice(0, 14).map((skill, i) => (
                          <span key={i} style={{
                            background: 'var(--teal-bg)', color: 'var(--teal)',
                            borderRadius: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 500,
                          }}>
                            {skill}
                          </span>
                        ))}
                        {activeSource.parsed_data.skills.length > 14 && (
                          <span style={{ fontSize: 10.5, color: 'var(--stone)' }}>
                            +{activeSource.parsed_data.skills.length - 14} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Risk flags */}
                  {activeSource.parsed_data.flags?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 5 }}>Risk Flags</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {activeSource.parsed_data.flags.map((flag, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--alert)' }}>
                            <AlertTriangle size={11} style={{ flexShrink: 0 }} />
                            {flag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Employment history */}
                  {activeSource.parsed_data.employment_history?.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 5 }}>Employment</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {activeSource.parsed_data.employment_history.slice(0, 4).map((job, i) => (
                          <div key={i} style={{ fontSize: 11.5, color: 'var(--charcoal)' }}>
                            <span style={{ fontWeight: 500 }}>{job.role}</span>
                            {job.company && <span style={{ color: 'var(--stone)' }}> · {job.company}</span>}
                            {(job.start || job.end) && (
                              <span style={{ color: 'var(--stone-light)' }}>
                                {' '}· {[job.start, job.end].filter(Boolean).join(' → ')}
                              </span>
                            )}
                            {job.duration_months > 0 && (
                              <span style={{ color: 'var(--stone-light)' }}> ({job.duration_months}mo)</span>
                            )}
                          </div>
                        ))}
                        {activeSource.parsed_data.employment_history.length > 4 && (
                          <p style={{ fontSize: 11, color: 'var(--stone)' }}>
                            +{activeSource.parsed_data.employment_history.length - 4} more positions
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <p style={{ fontSize: 10, color: 'var(--stone-light)', marginTop: 2 }}>
                    Parsed {relTime(activeSource.parsed_at)}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Parse with AI button (uploaded but not yet parsed) */}
          {activeSource.source_type === 'upload' && !activeSource.parsed_data && canEdit && ANTHROPIC_KEY && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--sand-dark)' }}>
              <button
                onClick={() => handleParseWithAI(activeSource)}
                disabled={parsing}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                {parsing
                  ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Sparkles size={11} />}
                {parsing ? 'Parsing with AI…' : 'Parse with AI'}
              </button>
            </div>
          )}
        </div>
      ) : (
        inputMode === null && (
          <div style={{
            border: '1px dashed var(--sand-dark)', borderRadius: 8,
            padding: '14px', textAlign: 'center', color: 'var(--stone)', fontSize: 12.5,
          }}>
            No CV attached yet.
          </div>
        )
      )}

      {/* ── Editor (canEdit) ── */}
      {canEdit && (
        <>
          {inputMode === null ? (
            /* Buttons to open input */
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setInputMode('upload')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Upload size={11} />
                {activeSource ? 'Replace CV' : 'Upload CV'}
              </button>
              <button
                onClick={() => setInputMode('link')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Link2 size={11} />
                {activeSource ? 'Replace with Link' : 'Add External Link'}
              </button>
            </div>
          ) : (
            /* Input panel */
            <div style={{ border: '1px solid var(--sand-dark)', borderRadius: 8, overflow: 'hidden' }}>

              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--sand-dark)', background: 'var(--sand)' }}>
                {[{ id: 'upload', label: 'Upload File', Icon: Upload }, { id: 'link', label: 'External Link', Icon: Link2 }].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setInputMode(id); setPendingFile(null); setPendingLink(''); setError(null) }}
                    style={{
                      flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                      background:    inputMode === id ? 'white' : 'transparent',
                      borderBottom:  inputMode === id ? '2px solid var(--teal)' : '2px solid transparent',
                      color:         inputMode === id ? 'var(--teal)' : 'var(--stone)',
                      fontSize: 11.5, fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Icon size={11} /> {label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 12 }}>
                {inputMode === 'upload' ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={e => handleFileSelect(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />

                    {pendingFile ? (
                      /* File selected preview */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={16} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pendingFile.name}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--stone)' }}>{formatBytes(pendingFile.size)}</p>
                        </div>
                        <button
                          onClick={() => setPendingFile(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', padding: 0 }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      /* Drop zone */
                      <div
                        className="upload-zone"
                        onClick={() => fileRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                        style={{ margin: 0, padding: '20px 16px' }}
                      >
                        <div style={{
                          width: 32, height: 32, background: 'var(--sand)', borderRadius: 6,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          margin: '0 auto 8px', color: 'var(--stone)',
                        }}>
                          <Upload size={15} />
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 2 }}>
                          Drag & drop or click to upload
                        </p>
                        <p style={{ fontSize: 10.5, color: 'var(--stone)' }}>PDF, DOC, DOCX · Max 10 MB</p>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button
                        onClick={handleUploadAndParse}
                        disabled={!pendingFile || uploading || parsing}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        {(uploading || parsing) && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                        {parsing ? 'Parsing with AI…' : uploading ? 'Uploading…' : 'Save & Parse with AI'}
                      </button>
                      <button
                        onClick={() => { setInputMode(null); setPendingFile(null); setError(null) }}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* External link input */}
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <input
                        value={pendingLink}
                        onChange={e => setPendingLink(e.target.value)}
                        className="form-control"
                        style={{ fontSize: 12.5 }}
                        placeholder="https://drive.google.com/… or Dropbox / OneDrive link"
                      />
                      {pendingLink && getLinkWarning(pendingLink) && (
                        <p style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                          <AlertTriangle size={10} />
                          {getLinkWarning(pendingLink)}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={handleSaveLink}
                        disabled={!pendingLink.trim() || uploading}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        {uploading && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                        {uploading ? 'Saving…' : 'Save Link'}
                      </button>
                      <button
                        onClick={() => { setInputMode(null); setPendingLink(''); setError(null) }}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: 11 }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Version history ── */}
          {historyEntries.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(v => !v)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontSize: 11, color: 'var(--stone)', padding: '2px 0',
                }}
              >
                <Clock size={11} />
                {showHistory ? 'Hide' : 'Show'} version history ({historyEntries.length})
                {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>

              {showHistory && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {historyEntries.map((src, i) => (
                    <div key={src.id} style={{
                      border: '1px solid var(--sand-dark)', borderRadius: 6,
                      padding: '8px 10px', background: 'white',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--stone-light)', fontFamily: 'monospace', flexShrink: 0 }}>
                        v{historyEntries.length - i}
                      </span>
                      {src.source_type === 'upload'
                        ? <FileText size={12} style={{ color: 'var(--teal)', flexShrink: 0 }} />
                        : <Link2 size={12} style={{ color: 'var(--gold)', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11.5, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {src.source_type === 'upload' ? src.file_name : 'External link'}
                        </p>
                        <p style={{ fontSize: 10.5, color: 'var(--stone-light)' }}>{relTime(src.created_at)}</p>
                      </div>
                      <button
                        onClick={() => handleView(src)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', padding: 0 }}
                        title="Open"
                      >
                        <ExternalLink size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
