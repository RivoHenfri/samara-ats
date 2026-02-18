import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { X, Upload, Loader2, CheckCircle } from 'lucide-react'

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_KEY

async function extractCVWithClaude(base64PDF) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [
        {
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
        },
      ],
    }),
  })
  const data = await response.json()
  const text = data.content?.[0]?.text || '{}'
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return {}
  }
}

function formatIDR(value) {
  const num = value.replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}

function parseIDR(formatted) {
  return formatted.replace(/\./g, '').replace(/,/g, '')
}

export default function AddCandidateModal({ onClose, onSuccess }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const fileRef = useRef()

  const [form, setForm] = useState({
    full_name: '',
    whatsapp: '',
    email: '',
    origin: 'Lombok Local',
    role_id: '',
    current_salary: '',
    expected_salary: '',
    cv_link: '',
  })

  const selectedRole = roles.find(r => r.id === form.role_id)
  const cvLinkLabel = form.full_name && selectedRole
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
          full_name: extracted.full_name || f.full_name,
          whatsapp: extracted.whatsapp || f.whatsapp,
          email: extracted.email || f.email,
          current_salary: extracted.current_salary
            ? parseInt(extracted.current_salary).toLocaleString('id-ID')
            : f.current_salary,
        }))
        setScanned(true)
      } catch (err) {
        setError('CV scan failed. You can fill in the form manually.')
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const currentSalaryNum = form.current_salary ? parseInt(parseIDR(form.current_salary)) : null
    const expectedSalaryNum = form.expected_salary ? parseInt(parseIDR(form.expected_salary)) : null

    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .insert({
        full_name: form.full_name,
        whatsapp: form.whatsapp,
        email: form.email,
        origin: form.origin,
        current_salary: currentSalaryNum,
        expected_salary: expectedSalaryNum,
        cv_link: form.cv_link || null,
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
          <h2 className="text-lg font-semibold text-white">Add Candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm">{error}</div>}

          {/* CV Upload */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Upload CV (PDF) — auto-fills form</label>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={handleCVUpload} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current.click()}
              disabled={scanning}
              className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-60 text-white py-2.5 rounded-lg transition-colors text-sm border border-dashed border-gray-500"
            >
              {scanning ? (
                <><Loader2 size={15} className="animate-spin" /> Scanning CV...</>
              ) : scanned ? (
                <><CheckCircle size={15} className="text-emerald-400" /> <span className="text-emerald-400">CV scanned! Check fields below</span></>
              ) : (
                <><Upload size={15} /> Choose PDF</>
              )}
            </button>
          </div>

          {/* Full Name */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
            <input
              required
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. Budi Santoso"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">WhatsApp</label>
            <input
              value={form.whatsapp}
              onChange={e => set('whatsapp', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. 08123456789"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. budi@email.com"
            />
          </div>

          {/* Origin */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Origin *</label>
            <select
              value={form.origin}
              onChange={e => set('origin', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
            >
              <option>Lombok Local</option>
              <option>Indonesian Expat</option>
              <option>International</option>
            </select>
          </div>

          {/* Applying For */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Applying For *</label>
            <select
              value={form.role_id}
              onChange={e => set('role_id', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.title} — {r.department}</option>
              ))}
            </select>
          </div>

          {/* Salary fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Current Salary (IDR)</label>
              <input
                value={form.current_salary}
                onChange={e => set('current_salary', formatIDR(e.target.value))}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none font-mono text-sm"
                placeholder="e.g. 5.000.000"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-1 block">Expected Salary (IDR)</label>
              <input
                value={form.expected_salary}
                onChange={e => set('expected_salary', formatIDR(e.target.value))}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none font-mono text-sm"
                placeholder="e.g. 7.000.000"
              />
            </div>
          </div>

          {/* CV Link */}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">CV Link (Google Drive / OneDrive)</label>
            <input
              value={form.cv_link}
              onChange={e => set('cv_link', e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none text-sm"
              placeholder="https://drive.google.com/..."
            />
            {cvLinkLabel && form.cv_link && (
              <p className="text-xs text-emerald-400 mt-1">
                Link label: <span className="font-medium">{cvLinkLabel}</span>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white py-2 rounded-lg transition-colors"
            >
              {loading ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}