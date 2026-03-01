/**
 * PrescreeningPage.jsx
 *
 * Public candidate-facing prescreening form.
 * Route: /prescreening/:token (no auth required)
 *
 * Follows the same styling and patterns as ApplyPage.jsx.
 */

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, CheckCircle, ClipboardList } from 'lucide-react'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── IDR formatting (reused from ApplyPage) ──────────────────────────────────
function formatIDR(raw) {
  const num = String(raw).replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}
function parseIDR(formatted) {
  return (formatted || '').replace(/\./g, '').replace(/,/g, '')
}

// ── MBTI validation ─────────────────────────────────────────────────────────
function isValidMBTI(val) {
  return /^[EI][NS][TF][JP]$/i.test(val)
}

export default function PrescreeningPage() {
  const { token } = useParams()

  const [loading, setLoading]     = useState(true)
  const [fetchErr, setFetchErr]   = useState(null)
  const [template, setTemplate]   = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [alreadyDone, setAlreadyDone] = useState(false)

  const [form, setForm]           = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Load form template ────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/prescreening-submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ action: 'load', access_token: token }),
        })

        const data = await res.json()

        if (!res.ok) {
          if (data.already_completed) {
            setAlreadyDone(true)
          } else {
            setFetchErr(data.error || 'Could not load the form.')
          }
          setLoading(false)
          return
        }

        setTemplate(data.template)
        setCandidateName(data.candidate_name || '')
        setRoleTitle(data.role_title || '')
        setDepartment(data.department || '')

        // Pre-populate existing responses (if candidate started and came back)
        if (data.existing_responses && Object.keys(data.existing_responses).length > 0) {
          setForm(data.existing_responses)
        }
      } catch {
        setFetchErr('Network error — please check your connection and try again.')
      }
      setLoading(false)
    }
    load()
  }, [token])

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitErr(null)

    // Client-side MBTI validation
    const mbtiField = (template?.fixed_fields || []).find(f => f.field_key === 'mbti_type' && f.enabled !== false)
    if (mbtiField && form.mbti_type && !isValidMBTI(form.mbti_type)) {
      setSubmitErr('Please enter a valid MBTI type (e.g. INTJ, ENFP).')
      setSubmitting(false)
      return
    }

    try {
      // Clean up currency fields before sending
      const cleanedForm = { ...form }
      if (cleanedForm.current_salary) {
        cleanedForm.current_salary = parseIDR(String(cleanedForm.current_salary))
      }
      if (cleanedForm.expected_salary) {
        cleanedForm.expected_salary = parseIDR(String(cleanedForm.expected_salary))
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/prescreening-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'submit',
          access_token: token,
          responses: cleanedForm,
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

  // ── Loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.fullPage}>
      <div style={s.center}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#4A7C74' }} />
        <p style={{ marginTop: 12, color: '#9A8F80', fontSize: 14 }}>Loading prescreening form…</p>
      </div>
    </div>
  )

  // ── Error ────────────────────────────────────────────────────────────
  if (fetchErr) return (
    <div style={s.fullPage}>
      <div style={s.center}>
        <AlertTriangle size={28} style={{ color: '#C0614A' }} />
        <p style={{ marginTop: 12, color: '#2C2A27', fontSize: 15, fontWeight: 500 }}>{fetchErr}</p>
      </div>
    </div>
  )

  // ── Already completed ────────────────────────────────────────────────
  if (alreadyDone) return (
    <div style={s.fullPage}>
      <div style={{ ...s.container, ...s.center, minHeight: '80vh' }}>
        <CheckCircle size={36} style={{ color: '#4A7C74' }} />
        <p style={{ marginTop: 16, color: '#2C2A27', fontSize: 18, fontWeight: 600, textAlign: 'center' }}>
          You've already submitted this form
        </p>
        <p style={{ marginTop: 6, color: '#9A8F80', fontSize: 13, textAlign: 'center' }}>
          Thank you for completing the prescreening. We'll be in touch!
        </p>
      </div>
    </div>
  )

  // ── Success state ────────────────────────────────────────────────────
  if (submitted) return (
    <div style={s.fullPage}>
      <div style={s.container}>
        <div style={{ ...s.card, textAlign: 'center', padding: '56px 40px', marginTop: 80 }}>
          <CheckCircle size={44} style={{ color: '#4A7C74', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2C2A27', margin: '0 0 10px' }}>
            Prescreening Submitted!
          </h2>
          <p style={{ fontSize: 14, color: '#9A8F80', margin: '0 0 6px', lineHeight: 1.6 }}>
            Thank you, <strong style={{ color: '#2C2A27' }}>{candidateName}</strong>.
          </p>
          <p style={{ fontSize: 14, color: '#9A8F80', margin: 0, lineHeight: 1.6 }}>
            Your prescreening for the <strong style={{ color: '#2C2A27' }}>{roleTitle}</strong> role has been received. We'll review your responses and get back to you soon.
          </p>
        </div>
      </div>
    </div>
  )

  // ── Render form ──────────────────────────────────────────────────────

  // Default fields used when no template has been configured for the role
  const DEFAULT_FIELDS = [
    { field_key: 'current_salary',    type: 'currency',      label: 'Current Monthly Salary (IDR)',  required: false },
    { field_key: 'expected_salary',   type: 'currency',      label: 'Expected Monthly Salary (IDR)', required: true  },
    { field_key: 'notice_period',     type: 'select',        label: 'Notice Period',                 required: true,
      options: ['Immediately available', '1 week', '2 weeks', '1 month', '2 months', '3 months'] },
    { field_key: 'availability_date', type: 'date',          label: 'Earliest Start Date',           required: false },
    { field_key: 'previous_application', type: 'yes_no_detail', label: 'Have you applied to Samara Lombok before?', required: true,
      detail_prompt: 'When and for which role?' },
    { field_key: 'has_relatives',     type: 'yes_no_detail', label: 'Do you have any relatives currently working at Samara Lombok?', required: true,
      detail_prompt: 'Please state their name and department.' },
    { field_key: 'mbti_type',         type: 'mbti',          label: 'MBTI Personality Type',         required: false },
  ]

  const fixedFields = template?.fixed_fields
    ? template.fixed_fields.filter(f => f.enabled !== false)
    : DEFAULT_FIELDS
  const customQuestions = template?.custom_questions || []

  return (
    <div style={s.fullPage}>
      <div style={s.container}>

        {/* Header */}
        <header style={{ padding: '36px 0 28px', borderBottom: '1px solid #EBE7E1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {department && <span style={s.deptBadge}>{department}</span>}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2C2A27', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            Prescreening — {roleTitle}
          </h1>
          <p style={{ fontSize: 14, color: '#9A8F80', margin: 0, lineHeight: 1.5 }}>
            Hi <strong style={{ color: '#2C2A27' }}>{candidateName}</strong>, please complete this form to help us learn more about you.
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '28px 0 80px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {submitErr && (
            <div style={s.errorBanner}>
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              {submitErr}
            </div>
          )}

          {/* Fixed fields */}
          {fixedFields.map(field => (
            <FieldRenderer
              key={field.field_key}
              field={field}
              value={form[field.field_key]}
              detailValue={form[`${field.field_key}_detail`]}
              onChange={val => set(field.field_key, val)}
              onDetailChange={val => set(`${field.field_key}_detail`, val)}
            />
          ))}

          {/* Custom questions */}
          {customQuestions.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid #EBE7E1', paddingTop: 20, marginTop: 4 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#2C2A27', margin: 0 }}>
                  Additional Questions
                </h2>
              </div>
              {customQuestions.map((q, i) => (
                <Field key={i} label={q.question} required={q.required}>
                  {q.type === 'textarea' ? (
                    <textarea
                      value={form[`custom_q_${i}`] || ''}
                      onChange={e => set(`custom_q_${i}`, e.target.value)}
                      style={{ ...s.input, minHeight: 100, resize: 'vertical' }}
                      placeholder="Type your answer…"
                      required={q.required}
                    />
                  ) : q.type === 'select' ? (
                    <select
                      value={form[`custom_q_${i}`] || ''}
                      onChange={e => set(`custom_q_${i}`, e.target.value)}
                      style={s.input}
                      required={q.required}
                    >
                      <option value="">Select…</option>
                      {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : q.type === 'number' ? (
                    <input
                      type="number"
                      value={form[`custom_q_${i}`] || ''}
                      onChange={e => set(`custom_q_${i}`, e.target.value)}
                      style={s.input}
                      placeholder="Enter a number"
                      required={q.required}
                    />
                  ) : (
                    <input
                      value={form[`custom_q_${i}`] || ''}
                      onChange={e => set(`custom_q_${i}`, e.target.value)}
                      style={s.input}
                      placeholder="Type your answer…"
                      required={q.required}
                    />
                  )}
                </Field>
              ))}
            </>
          )}

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
                : <><ClipboardList size={15} style={{ marginRight: 7 }} />Submit Prescreening</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field Renderer ──────────────────────────────────────────────────────────

function FieldRenderer({ field, value, detailValue, onChange, onDetailChange }) {
  switch (field.type) {
    case 'currency':
      return (
        <Field label={field.label} required={field.required}>
          <input
            value={value ? formatIDR(String(value)) : ''}
            onChange={e => onChange(formatIDR(e.target.value))}
            style={s.input}
            placeholder="e.g. 7.000.000"
            required={field.required}
          />
        </Field>
      )

    case 'select':
      return (
        <Field label={field.label} required={field.required}>
          <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={s.input}
            required={field.required}
          >
            <option value="">Select…</option>
            {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
      )

    case 'date':
      return (
        <Field label={field.label} required={field.required}>
          <input
            type="date"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={s.input}
            required={field.required}
          />
        </Field>
      )

    case 'textarea':
      return (
        <Field label={field.label} required={field.required}>
          <textarea
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={{ ...s.input, minHeight: 80, resize: 'vertical' }}
            placeholder="Type your answer…"
            required={field.required}
          />
        </Field>
      )

    case 'yes_no_detail':
      return (
        <Field label={field.label} required={field.required}>
          <div style={{ display: 'flex', gap: 16, marginBottom: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#2C2A27', cursor: 'pointer' }}>
              <input
                type="radio"
                name={field.field_key}
                value="yes"
                checked={value === 'yes'}
                onChange={() => onChange('yes')}
                style={{ accentColor: '#4A7C74' }}
              />
              Yes
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#2C2A27', cursor: 'pointer' }}>
              <input
                type="radio"
                name={field.field_key}
                value="no"
                checked={value === 'no'}
                onChange={() => onChange('no')}
                style={{ accentColor: '#4A7C74' }}
              />
              No
            </label>
          </div>
          {value === 'yes' && (
            <input
              value={detailValue || ''}
              onChange={e => onDetailChange(e.target.value)}
              style={s.input}
              placeholder={field.detail_prompt || 'Please provide details…'}
              required={field.required}
            />
          )}
        </Field>
      )

    case 'mbti':
      return (
        <Field label={field.label} required={field.required}>
          <input
            value={value || ''}
            onChange={e => onChange(e.target.value.toUpperCase())}
            style={{ ...s.input, maxWidth: 140, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}
            placeholder="e.g. INTJ"
            maxLength={4}
            required={field.required}
          />
          <p style={s.hint}>
            Enter your 4-letter MBTI type (e.g. INTJ, ENFP). Take a free test at{' '}
            <a href="https://www.16personalities.com" target="_blank" rel="noopener noreferrer" style={{ color: '#4A7C74' }}>
              16personalities.com
            </a>{' '}
            if you don't know yours.
          </p>
        </Field>
      )

    default:
      return (
        <Field label={field.label} required={field.required}>
          <input
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={s.input}
            placeholder="Type your answer…"
            required={field.required}
          />
        </Field>
      )
  }
}

// ── Field wrapper (same as ApplyPage) ───────────────────────────────────────

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

// ── Styles (same as ApplyPage) ──────────────────────────────────────────────

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
    cursor: 'pointer',
  },
}
