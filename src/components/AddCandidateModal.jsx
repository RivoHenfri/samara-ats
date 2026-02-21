import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Upload, Link2, Loader2, CheckCircle, FileText, AlertTriangle } from 'lucide-react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY

const ALLOWED_TYPES = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
}
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ── AI: full CV extraction ────────────────────────────────────────────────────
// Returns structured data used to: (a) auto-fill the form, (b) store in parsed_data
async function extractCVWithClaude(base64PDF) {
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
            source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
          },
          {
            type: 'text',
            text: `Analyze this CV/resume. Return ONLY a valid JSON object — no explanation, no markdown:
{
  "full_name": "string or empty",
  "whatsapp": "phone digits only or empty",
  "email": "string or empty",
  "current_salary": null or monthly gross IDR as number,
  "current_role": "most recent job title or empty",
  "skills": ["array", "of", "skill", "strings"],
  "experience_years": null or total years as number,
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
  "flags": ["risk signal strings — e.g. 'Frequent job changes (avg < 12 months)', 'Employment gap > 3 months'"]
}`,
          },
        ],
      }],
    }),
  })
  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'API error')
  if (!data.content?.[0]?.text) throw new Error('No response from Claude')
  return JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())
}

// ── IDR formatting ────────────────────────────────────────────────────────────
function formatIDR(value) {
  const num = value.replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}
function parseIDR(formatted) {
  return (formatted || '').replace(/\./g, '').replace(/,/g, '')
}

// ── Link permission warning ───────────────────────────────────────────────────
function getLinkWarning(url) {
  try {
    const { hostname } = new URL(url)
    const known = ['drive.google.com', 'dropbox.com', 'onedrive.live.com', '1drv.ms', 'sharepoint.com']
    return known.some(d => hostname.includes(d))
      ? 'Ensure the link is set to "Anyone with the link can view".'
      : null
  } catch { return null }
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function AddCandidateModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [roles,    setRoles]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // CV state
  const [cvMode,        setCvMode]        = useState('upload')  // 'upload' | 'link'
  const [cvFile,        setCvFile]        = useState(null)      // File object to upload after submit
  const [cvLink,        setCvLink]        = useState('')
  const [scanning,      setScanning]      = useState(false)
  const [scanned,       setScanned]       = useState(false)
  const [parsedCVData,  setParsedCVData]  = useState(null)      // Full AI extraction stored in cv_sources
  const fileRef = useRef()

  const [form, setForm] = useState({
    full_name:       '',
    whatsapp:        '',
    email:           '',
    origin:          'Lombok Local',
    role_id:         '',
    current_salary:  '',
    expected_salary: '',
  })

  useEffect(() => {
    supabase.from('roles').select('id, title, department').eq('status', 'Open').then(({ data }) => {
      setRoles(data || [])
      if (data?.length > 0) setForm(f => ({ ...f, role_id: data[0].id }))
    })
  }, [])

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── File selection & AI scan ──────────────────────────────────────────────
  const handleFileSelect = async (file) => {
    if (!file) return

    if (!ALLOWED_TYPES[file.type]) {
      setError('Please upload a PDF, DOC, or DOCX file.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be under 10 MB.')
      return
    }

    setError(null)
    setCvFile(file)

    // Only scan PDFs with Claude AI
    if (file.type !== 'application/pdf' || !ANTHROPIC_KEY) return

    setScanning(true)
    setScanned(false)
    setParsedCVData(null)

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      try {
        const extracted = await extractCVWithClaude(base64)
        setParsedCVData(extracted)
        setForm(f => ({
          ...f,
          full_name:      extracted.full_name      || f.full_name,
          whatsapp:       extracted.whatsapp       || f.whatsapp,
          email:          extracted.email          || f.email,
          current_salary: extracted.current_salary
            ? parseInt(extracted.current_salary).toLocaleString('id-ID')
            : f.current_salary,
        }))
        setScanned(true)
      } catch (err) {
        setError('CV scan failed: ' + (err.message || 'fill in the form manually.'))
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFileSelect(e.dataTransfer.files?.[0])
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const currentSalaryNum  = form.current_salary  ? parseInt(parseIDR(form.current_salary))  : null
    const expectedSalaryNum = form.expected_salary ? parseInt(parseIDR(form.expected_salary)) : null

    // 1. Create candidate
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .insert({
        full_name:       form.full_name,
        whatsapp:        form.whatsapp,
        email:           form.email,
        origin:          form.origin,
        current_salary:  currentSalaryNum,
        expected_salary: expectedSalaryNum,
        cv_link:         cvMode === 'link' && cvLink ? cvLink : null, // backward-compat field
      })
      .select()
      .single()

    if (candError) { setError(candError.message); setLoading(false); return }

    // 2. Create application
    const { error: appError } = await supabase
      .from('applications')
      .insert({ candidate_id: candidate.id, role_id: form.role_id, stage: 'New' })

    if (appError) { setError(appError.message); setLoading(false); return }

    // 3. Persist CV source (non-blocking — errors are logged but don't fail submission)
    await saveCVSource(candidate.id)

    setLoading(false)
    onSuccess()
  }

  const saveCVSource = async (candidateId) => {
    try {
      if (cvMode === 'upload' && cvFile) {
        const safeName = cvFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${candidateId}/${crypto.randomUUID()}_${safeName}`

        const { error: storageErr } = await supabase.storage
          .from('cvs')
          .upload(path, cvFile, { contentType: cvFile.type, upsert: false })

        if (storageErr) {
          console.warn('CV upload skipped (storage):', storageErr.message)
          return
        }

        await supabase.from('cv_sources').insert({
          candidate_id: candidateId,
          source_type:  'upload',
          file_path:    path,
          file_name:    cvFile.name,
          file_size:    cvFile.size,
          file_type:    cvFile.type,
          uploaded_by:  user?.id,
          is_active:    true,
          parsed_data:  parsedCVData || null,
          parsed_at:    parsedCVData ? new Date().toISOString() : null,
        })

      } else if (cvMode === 'link' && cvLink.trim()) {
        await supabase.from('cv_sources').insert({
          candidate_id: candidateId,
          source_type:  'link',
          file_url:     cvLink.trim(),
          uploaded_by:  user?.id,
          is_active:    true,
        })
      }
    } catch (err) {
      console.warn('cv_source save failed (non-fatal):', err.message)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 480 }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add Candidate</h2>
            <p style={{ fontSize: 11, color: 'var(--stone)', marginTop: 2 }}>
              Upload a CV or add a link — AI fills the form automatically
            </p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
                borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)',
                marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* ── CV Source ── */}
            <div className="form-group">
              <label className="form-label">CV Source</label>

              {/* Mode tabs */}
              <div style={{
                display: 'flex', border: '1px solid var(--sand-dark)',
                borderRadius: '6px 6px 0 0', overflow: 'hidden', borderBottom: 'none',
              }}>
                {[
                  { id: 'upload', label: 'Upload File', Icon: Upload },
                  { id: 'link',   label: 'External Link', Icon: Link2 },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setCvMode(id); setCvFile(null); setCvLink(''); setScanned(false); setScanning(false); setParsedCVData(null); setError(null) }}
                    style={{
                      flex: 1, padding: '7px 0', border: 'none', cursor: 'pointer',
                      background:   cvMode === id ? 'white' : 'var(--sand)',
                      borderBottom: cvMode === id ? '2px solid var(--teal)' : '2px solid var(--sand-dark)',
                      color:        cvMode === id ? 'var(--teal)' : 'var(--stone)',
                      fontSize: 11.5, fontWeight: 500,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Icon size={11} /> {label}
                  </button>
                ))}
              </div>

              {/* Upload panel */}
              {cvMode === 'upload' && (
                <div style={{ border: '1px solid var(--sand-dark)', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={e => handleFileSelect(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />

                  {cvFile ? (
                    /* File selected */
                    <div style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 6, flexShrink: 0,
                          background: 'var(--teal-bg)', color: 'var(--teal)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {scanning
                            ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                            : scanned ? <CheckCircle size={15} /> : <FileText size={15} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cvFile.name}
                          </p>
                          <p style={{ fontSize: 11, color: scanning ? 'var(--teal)' : scanned ? 'var(--teal)' : 'var(--stone)' }}>
                            {scanning ? 'Scanning with Claude AI…' : scanned ? 'Extracted! Review fields below.' : `${ALLOWED_TYPES[cvFile.type] || 'File'} · ${(cvFile.size / 1024 / 1024).toFixed(1)} MB`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setCvFile(null); setScanned(false); setParsedCVData(null) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', padding: 0 }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Drop zone */
                    <div
                      className="upload-zone"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={handleDrop}
                      style={{ borderRadius: 0, border: 'none', margin: 0 }}
                    >
                      <div style={{
                        width: 36, height: 36, background: 'var(--sand)', borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 10px', color: 'var(--stone)',
                      }}>
                        <Upload size={18} />
                      </div>
                      <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 3 }}>
                        Upload PDF — Claude AI will auto-fill the form
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--stone)' }}>PDF, DOC, DOCX · Max 10 MB · Click or drag & drop</p>
                    </div>
                  )}
                </div>
              )}

              {/* Link panel */}
              {cvMode === 'link' && (
                <div style={{ border: '1px solid var(--sand-dark)', borderRadius: '0 0 6px 6px', padding: '10px 12px' }}>
                  <input
                    value={cvLink}
                    onChange={e => setCvLink(e.target.value)}
                    className="form-control"
                    style={{ fontSize: 12.5 }}
                    placeholder="https://drive.google.com/… or Dropbox / OneDrive"
                  />
                  {cvLink && getLinkWarning(cvLink) && (
                    <p style={{ fontSize: 11, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
                      <AlertTriangle size={10} />
                      {getLinkWarning(cvLink)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Full Name */}
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                required
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                className="form-control"
                placeholder="e.g. Budi Santoso"
              />
            </div>

            {/* WhatsApp */}
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={e => set('whatsapp', e.target.value)}
                className="form-control mono"
                placeholder="e.g. 08123456789"
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="form-control"
                placeholder="e.g. budi@email.com"
              />
            </div>

            {/* Origin */}
            <div className="form-group">
              <label className="form-label">Origin *</label>
              <select
                value={form.origin}
                onChange={e => set('origin', e.target.value)}
                className="form-control"
              >
                <option>Lombok Local</option>
                <option>Indonesian Expat</option>
                <option>International</option>
              </select>
            </div>

            {/* Applying For */}
            <div className="form-group">
              <label className="form-label">Applying For *</label>
              <select
                value={form.role_id}
                onChange={e => set('role_id', e.target.value)}
                className="form-control"
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.title} — {r.department}</option>
                ))}
              </select>
            </div>

            {/* Salary row */}
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Current Salary (IDR)</label>
                <input
                  value={form.current_salary}
                  onChange={e => set('current_salary', formatIDR(e.target.value))}
                  className="form-control mono"
                  placeholder="5.000.000"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expected Salary (IDR)</label>
                <input
                  value={form.expected_salary}
                  onChange={e => set('expected_salary', formatIDR(e.target.value))}
                  className="form-control mono"
                  placeholder="7.000.000"
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading || scanning} className="btn btn-primary">
              {loading ? (
                <><span className="spinner" style={{ width: 13, height: 13 }} /> Adding…</>
              ) : scanning ? (
                <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Scanning CV…</>
              ) : (
                'Add to Pipeline'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}
