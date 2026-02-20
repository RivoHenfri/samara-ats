import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X, Upload, Loader2, CheckCircle } from 'lucide-react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY

// ── CV extraction (unchanged) ─────────────────────────────────
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
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
          },
          {
            type: 'text',
            text: `Extract the following fields from this CV/resume. Return ONLY a JSON object with these exact keys, no explanation:
{
  "full_name": "candidate full name or empty string",
  "whatsapp": "phone/whatsapp number digits only, or empty string",
  "email": "email address or empty string",
  "current_salary": "current monthly gross salary as a number (IDR) if mentioned, else null"
}`,
          },
        ],
      }],
    }),
  })
  const data = await response.json()
  if (data.error) throw new Error(data.error.message || 'API error')
  if (!data.content?.[0]?.text) throw new Error('No response from Claude')
  const text = data.content[0].text
  try {
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    throw new Error('Could not parse CV data')
  }
}

// ── IDR formatting helpers ─────────────────────────────────────
function formatIDR(value) {
  const num = value.replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}

function parseIDR(formatted) {
  return formatted.replace(/\./g, '').replace(/,/g, '')
}

// ── MODAL ──────────────────────────────────────────────────────
export default function AddCandidateModal({ onClose, onSuccess }) {
  const [roles,    setRoles]    = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanned,  setScanned]  = useState(false)
  const fileRef = useRef()

  const [form, setForm] = useState({
    full_name:       '',
    whatsapp:        '',
    email:           '',
    origin:          'Lombok Local',
    role_id:         '',
    current_salary:  '',
    expected_salary: '',
    cv_link:         '',
  })

  const selectedRole = roles.find(r => r.id === form.role_id)
  const cvLinkLabel  = form.full_name && selectedRole
    ? `${form.full_name} – ${selectedRole.title}`
    : form.cv_link ? 'CV Link' : ''

  useEffect(() => {
    supabase.from('roles').select('id, title, department').eq('status', 'Open').then(({ data }) => {
      setRoles(data || [])
      if (data?.length > 0) setForm(f => ({ ...f, role_id: data[0].id }))
    })
  }, [])

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }
    if (!ANTHROPIC_KEY) {
      setError('VITE_ANTHROPIC_KEY is not set in your .env file.')
      return
    }
    setScanning(true)
    setError(null)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(',')[1]
      try {
        const extracted = await extractCVWithClaude(base64)
        setForm(f => ({
          ...f,
          full_name:      extracted.full_name     || f.full_name,
          whatsapp:       extracted.whatsapp      || f.whatsapp,
          email:          extracted.email         || f.email,
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const currentSalaryNum  = form.current_salary  ? parseInt(parseIDR(form.current_salary))  : null
    const expectedSalaryNum = form.expected_salary ? parseInt(parseIDR(form.expected_salary)) : null

    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .insert({
        full_name:       form.full_name,
        whatsapp:        form.whatsapp,
        email:           form.email,
        origin:          form.origin,
        current_salary:  currentSalaryNum,
        expected_salary: expectedSalaryNum,
        cv_link:         form.cv_link || null,
      })
      .select()
      .single()

    if (candError) { setError(candError.message); setLoading(false); return }

    const { error: appError } = await supabase
      .from('applications')
      .insert({ candidate_id: candidate.id, role_id: form.role_id, stage: 'New' })

    if (appError) { setError(appError.message); setLoading(false); return }

    setLoading(false)
    onSuccess()
  }

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 480 }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add Candidate</h2>
            <p style={{ fontSize: 11, color: 'var(--stone)', marginTop: 2 }}>
              Upload a CV or fill in manually
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Error */}
            {error && (
              <div style={{
                background: 'var(--alert-bg)',
                border: '1px solid rgba(192,97,74,0.2)',
                borderRadius: 6, padding: '10px 14px',
                fontSize: 12.5, color: 'var(--alert)',
                marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {/* CV Upload */}
            <div className="form-group">
              <label className="form-label">Upload CV (PDF) — AI extracts data automatically</label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                onChange={handleCVUpload}
                style={{ display: 'none' }}
              />
              <div
                className={`upload-zone${scanning ? ' scanning' : scanned ? ' scanned' : ''}`}
                onClick={() => fileRef.current?.click()}
              >
                {scanning ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--teal)' }}>
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>Scanning with Claude AI…</span>
                  </div>
                ) : scanned ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--teal)' }}>
                    <CheckCircle size={16} />
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>CV extracted! Review fields below</span>
                  </div>
                ) : (
                  <>
                    <div style={{
                      width: 36, height: 36,
                      background: 'var(--sand)',
                      borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 10px',
                      color: 'var(--stone)',
                    }}>
                      <Upload size={18} />
                    </div>
                    <p style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 3 }}>
                      Upload PDF — Claude AI will auto-fill the form
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--stone)' }}>Click or drag & drop</p>
                  </>
                )}
              </div>
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

            {/* CV Link */}
            <div className="form-group">
              <label className="form-label">CV Link (Google Drive / OneDrive)</label>
              <input
                value={form.cv_link}
                onChange={e => set('cv_link', e.target.value)}
                className="form-control"
                placeholder="https://drive.google.com/…"
              />
              {cvLinkLabel && form.cv_link && (
                <p className="form-hint">
                  Label: <strong>{cvLinkLabel}</strong>
                </p>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? (
                <><span className="spinner" style={{ width: 13, height: 13 }} /> Adding…</>
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
