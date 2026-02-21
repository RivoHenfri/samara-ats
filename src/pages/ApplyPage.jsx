import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Loader2, AlertTriangle, CheckCircle, ChevronLeft,
  Briefcase, MapPin, ExternalLink,
} from 'lucide-react'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const ORIGINS = ['Lombok Local', 'Indonesian (Non-Lombok)', 'International']

// ── IDR formatting ────────────────────────────────────────────────────────────
function formatIDR(raw) {
  const num = raw.replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}
function parseIDR(formatted) {
  return (formatted || '').replace(/\./g, '').replace(/,/g, '')
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ApplyPage() {
  const { roleId } = useParams()

  const [role, setRole]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [fetchErr, setFetchErr] = useState(null)

  const [form, setForm] = useState({
    full_name:       '',
    email:           '',
    whatsapp:        '',
    origin:          'Lombok Local',
    expected_salary: '',
    cv_link:         '',
    cover_letter:    '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr]   = useState(null)
  const [submitted, setSubmitted]   = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Fetch role ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      setFetchErr(null)

      const { data, error } = await supabase
        .from('roles')
        .select('id, title, department, job_context, status, tenants(id, name, slug)')
        .eq('id', roleId)
        .single()

      if (error || !data) {
        setFetchErr('This job listing could not be found. The link may be outdated.')
      } else {
        setRole(data)
      }
      setLoading(false)
    }
    load()
  }, [roleId])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitErr(null)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/careers-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          role_id:         role.id,
          full_name:       form.full_name.trim(),
          email:           form.email.trim()    || null,
          whatsapp:        form.whatsapp.trim() || null,
          origin:          form.origin,
          expected_salary: form.expected_salary
                           ? parseInt(parseIDR(form.expected_salary))
                           : null,
          cover_letter:    form.cover_letter.trim() || null,
          cv_link:         form.cv_link.trim()      || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitErr(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setSubmitted(true)
    } catch {
      setSubmitErr('Network error — please check your connection and try again.')
      setSubmitting(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.fullPage}>
      <div style={s.center}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#4A7C74' }} />
        <p style={{ marginTop: 12, color: '#9A8F80', fontSize: 14 }}>Loading…</p>
      </div>
    </div>
  )

  // ── Not found ──────────────────────────────────────────────────────────────
  if (fetchErr) return (
    <div style={s.fullPage}>
      <div style={s.center}>
        <AlertTriangle size={28} style={{ color: '#C0614A' }} />
        <p style={{ marginTop: 12, color: '#2C2A27', fontSize: 15, fontWeight: 500 }}>{fetchErr}</p>
      </div>
    </div>
  )

  const tenantSlug = role.tenants?.slug

  // ── Role closed ────────────────────────────────────────────────────────────
  if (role.status !== 'Open') return (
    <div style={s.fullPage}>
      <div style={{ ...s.container, ...s.center, minHeight: '80vh' }}>
        <AlertTriangle size={28} style={{ color: '#B8860B' }} />
        <p style={{ marginTop: 12, color: '#2C2A27', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
          This position is no longer accepting applications.
        </p>
        <p style={{ marginTop: 6, color: '#9A8F80', fontSize: 13, textAlign: 'center' }}>
          Check back for other open roles.
        </p>
        {tenantSlug && (
          <Link to={`/careers/${tenantSlug}`} style={s.backLink}>
            ← View all open positions
          </Link>
        )}
      </div>
    </div>
  )

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={s.fullPage}>
      <div style={s.container}>
        <div style={{ ...s.card, textAlign: 'center', padding: '56px 40px', marginTop: 80 }}>
          <CheckCircle size={44} style={{ color: '#4A7C74', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2C2A27', margin: '0 0 10px' }}>
            Application Received!
          </h2>
          <p style={{ fontSize: 14, color: '#9A8F80', margin: '0 0 6px', lineHeight: 1.6 }}>
            Your application for <strong style={{ color: '#2C2A27' }}>{role.title}</strong> has been submitted.
          </p>
          <p style={{ fontSize: 14, color: '#9A8F80', margin: '0 0 32px', lineHeight: 1.6 }}>
            We'll review your details and be in touch soon.
          </p>
          {tenantSlug && (
            <Link to={`/careers/${tenantSlug}`} style={s.btnGhost}>
              View all open positions →
            </Link>
          )}
        </div>
      </div>
    </div>
  )

  // ── Application form ───────────────────────────────────────────────────────
  const coverLen = form.cover_letter.length

  return (
    <div style={s.fullPage}>
      <div style={s.container}>

        {/* Back nav */}
        {tenantSlug && (
          <div style={{ paddingTop: 32 }}>
            <Link to={`/careers/${tenantSlug}`} style={s.backLink}>
              <ChevronLeft size={14} style={{ marginTop: 1 }} />
              {role.tenants?.name || 'Careers'}
            </Link>
          </div>
        )}

        {/* Role header */}
        <header style={{ padding: '28px 0 32px', borderBottom: '1px solid #EBE7E1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={s.deptBadge}>{role.department}</span>
            <span style={{ color: '#C4BDB5', fontSize: 12 }}>·</span>
            <MapPin size={12} style={{ color: '#9A8F80' }} />
            <span style={{ fontSize: 12, color: '#9A8F80' }}>Lombok, Indonesia</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#2C2A27', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            {role.title}
          </h1>
          {role.job_context && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ fontSize: 13, color: '#4A7C74', cursor: 'pointer', userSelect: 'none', fontWeight: 500 }}>
                About this role <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 3 }} />
              </summary>
              <p style={{ fontSize: 13, color: '#6B6560', lineHeight: 1.65, marginTop: 10, whiteSpace: 'pre-wrap' }}>
                {role.job_context}
              </p>
            </details>
          )}
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 0 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2C2A27', margin: 0 }}>
            Your details
          </h2>

          {/* Error */}
          {submitErr && (
            <div style={s.errorBanner}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              {submitErr}
            </div>
          )}

          {/* Full name */}
          <Field label="Full Name" required>
            <input
              required
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              style={s.input}
              placeholder="e.g. Budi Santoso"
              maxLength={200}
            />
          </Field>

          {/* Email */}
          <Field label="Email Address">
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              style={s.input}
              placeholder="you@email.com"
            />
          </Field>

          {/* WhatsApp */}
          <Field label="WhatsApp Number">
            <input
              value={form.whatsapp}
              onChange={e => set('whatsapp', e.target.value)}
              style={s.input}
              placeholder="e.g. 08123456789"
            />
          </Field>

          {/* Origin */}
          <Field label="Where are you based?" required>
            <select
              value={form.origin}
              onChange={e => set('origin', e.target.value)}
              style={s.input}
            >
              {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>

          {/* Expected salary */}
          <Field label="Expected Monthly Salary (IDR)">
            <input
              value={form.expected_salary}
              onChange={e => set('expected_salary', formatIDR(e.target.value))}
              style={s.input}
              placeholder="e.g. 7.000.000"
            />
            <p style={s.hint}>Optional — your answer will not be used to filter your application.</p>
          </Field>

          {/* CV link */}
          <Field label="CV / Resume Link">
            <input
              type="url"
              value={form.cv_link}
              onChange={e => set('cv_link', e.target.value)}
              style={s.input}
              placeholder="https://drive.google.com/… or Dropbox / OneDrive link"
            />
            <p style={s.hint}>Share a Google Drive, Dropbox, or OneDrive link (set to "Anyone with the link can view").</p>
          </Field>

          {/* Cover letter */}
          <Field label="Cover Letter">
            <textarea
              value={form.cover_letter}
              onChange={e => set('cover_letter', e.target.value)}
              style={{ ...s.input, minHeight: 140, resize: 'vertical' }}
              placeholder="Tell us why you're a great fit for this role…"
              maxLength={5000}
            />
            <p style={{ ...s.hint, textAlign: 'right' }}>
              {coverLen > 0 && <span style={{ color: coverLen > 4800 ? '#C0614A' : '#9A8F80' }}>{coverLen}/5 000 characters</span>}
            </p>
          </Field>

          {/* Submit */}
          <div style={{ paddingTop: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{
                ...s.btnPrimary,
                opacity: submitting ? 0.7 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting
                ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite', marginRight: 7 }} />Submitting…</>
                : <><Briefcase size={15} style={{ marginRight: 7 }} />Submit Application</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={s.label}>
        {label}
        {required && <span style={{ color: '#C0614A', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  fullPage: {
    minHeight: '100vh',
    background: '#FAF8F5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  container: {
    width: '100%',
    maxWidth: 640,
    padding: '0 20px',
  },
  card: {
    background: 'white',
    border: '1px solid #EBE7E1',
    borderRadius: 12,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    color: '#9A8F80',
    textDecoration: 'none',
    fontWeight: 500,
  },
  deptBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: '#4A7C74',
    background: 'rgba(74, 124, 116, 0.08)',
    borderRadius: 4,
    padding: '2px 7px',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#2C2A27',
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1px solid #DDD8D0',
    borderRadius: 7,
    fontSize: 14,
    color: '#2C2A27',
    background: 'white',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  hint: {
    fontSize: 11.5,
    color: '#9A8F80',
    margin: '3px 0 0',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(192, 97, 74, 0.07)',
    border: '1px solid rgba(192, 97, 74, 0.2)',
    borderRadius: 7,
    padding: '10px 14px',
    fontSize: 13,
    color: '#C0614A',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#4A7C74',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    padding: '11px 24px',
    fontSize: 14,
    fontWeight: 600,
    width: '100%',
    transition: 'background 0.15s',
    fontFamily: 'inherit',
  },
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    color: '#4A7C74',
    textDecoration: 'none',
    fontWeight: 500,
    padding: '8px 16px',
    border: '1px solid rgba(74, 124, 116, 0.3)',
    borderRadius: 7,
  },
}
