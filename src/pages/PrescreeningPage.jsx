/**
 * PrescreeningPage.jsx — Luxury Redesign v2
 *
 * Public candidate-facing prescreening form.
 * Route: /prescreening/:token (no auth required)
 *
 * Design: Samara Lombok luxury-minimal (Cormorant Garamond + DM Sans)
 * UX: Paginated multi-step, gold progress bar, pill toggles, MBTI URL flow
 */

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, ExternalLink } from 'lucide-react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── IDR formatting ────────────────────────────────────────────────────────────
function formatIDR(raw) {
  const num = String(raw).replace(/\D/g, '')
  return num ? parseInt(num).toLocaleString('id-ID') : ''
}
function parseIDR(formatted) {
  return (formatted || '').replace(/\./g, '').replace(/,/g, '')
}

// ── CSS keyframe injection ────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes progressFill {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
  * { box-sizing: border-box; }
  select, input, textarea, button { font-family: "DM Sans", system-ui, sans-serif; }
  input[type="date"]::-webkit-calendar-picker-indicator { opacity: 0.5; cursor: pointer; }
`

function InjectStyles() {
  return <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  cream: '#FAF8F5',
  sage: '#4A7C74',
  sageDark: '#3A6259',
  sageLight: 'rgba(74,124,116,0.10)',
  gold: '#C9A96E',
  goldLight: 'rgba(201,169,110,0.15)',
  dark: '#2C2A27',
  muted: '#9A8F80',
  border: '#E8E2D9',
  white: '#FFFFFF',
  errorBg: 'rgba(192,97,74,0.07)',
  errorBorder: 'rgba(192,97,74,0.20)',
  error: '#C0614A',
  display: '"Cormorant Garamond", Georgia, serif',
  body: '"DM Sans", system-ui, sans-serif',
}

// ── Grouped sections definition ───────────────────────────────────────────────
// Returns array of section configs for this template
function buildSections(fixedFields, customQuestions) {
  const sections = []

  // Section: Availability
  const availFields = fixedFields.filter(f =>
    ['notice_period', 'availability_date'].includes(f.field_key)
  )
  if (availFields.length > 0) {
    sections.push({ id: 'availability', title: 'Availability', subtitle: 'Let us know when you could join us.', fields: availFields })
  }

  // Section: Compensation
  const compFields = fixedFields.filter(f =>
    ['current_salary', 'expected_salary'].includes(f.field_key)
  )
  if (compFields.length > 0) {
    sections.push({ id: 'compensation', title: 'Compensation', subtitle: 'Your salary details are kept confidential and used only for matching purposes.', fields: compFields })
  }

  // Section: Background
  const bgFields = fixedFields.filter(f =>
    ['previous_application', 'has_relatives'].includes(f.field_key)
  )
  if (bgFields.length > 0) {
    sections.push({ id: 'background', title: 'Background Check', subtitle: 'Just a few quick questions to help us maintain our team integrity.', fields: bgFields })
  }

  // Section: Cultural Alignment (MBTI)
  const mbtiField = fixedFields.find(f => f.field_key === 'mbti_type')
  if (mbtiField) {
    sections.push({ id: 'mbti', title: 'Cultural Alignment', subtitle: 'At Samara, we believe in the power of self-awareness. Understanding your personality helps us build better teams.', fields: [mbtiField] })
  }

  // Remaining fixed fields not categorised
  const categorised = ['notice_period', 'availability_date', 'current_salary', 'expected_salary', 'previous_application', 'has_relatives', 'mbti_type']
  const otherFixed = fixedFields.filter(f => !categorised.includes(f.field_key))
  if (otherFixed.length > 0) {
    sections.push({ id: 'other', title: 'Additional Details', subtitle: '', fields: otherFixed })
  }

  // Section: Custom questions from HR
  if (customQuestions.length > 0) {
    sections.push({ id: 'custom', title: 'From the Hiring Team', subtitle: 'Please take a moment to answer these role-specific questions.', fields: [], custom: customQuestions })
  }

  return sections
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PrescreeningPage() {
  const { token } = useParams()

  const [loading, setLoading] = useState(true)
  const [fetchErr, setFetchErr] = useState(null)
  const [template, setTemplate] = useState(null)
  const [candidateName, setCandidateName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [form, setForm] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState(null)
  const [submitted, setSubmitted] = useState(false)

  // Pagination
  const [step, setStep] = useState(0) // 0 = welcome
  const topRef = useRef(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  // ── Load ───────────────────────────────────────────────────────────────
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
          if (data.already_completed) setAlreadyDone(true)
          else setFetchErr(data.error || 'Could not load the form.')
          setLoading(false)
          return
        }
        setTemplate(data.template)
        setCandidateName(data.candidate_name || '')
        setRoleTitle(data.role_title || '')
        setDepartment(data.department || '')
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
    try {
      const cleanedForm = { ...form }
      if (cleanedForm.current_salary) cleanedForm.current_salary = parseIDR(String(cleanedForm.current_salary))
      if (cleanedForm.expected_salary) cleanedForm.expected_salary = parseIDR(String(cleanedForm.expected_salary))

      const res = await fetch(`${SUPABASE_URL}/functions/v1/prescreening-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'submit', access_token: token, responses: cleanedForm }),
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

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' })

  const goNext = () => { setStep(s => s + 1); scrollTop() }
  const goPrev = () => { setStep(s => s - 1); scrollTop() }

  // ── Loading ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={s.fullPage}>
      <InjectStyles />
      <div style={s.centerFull}>
        <div style={{ width: 40, height: 40, border: `3px solid ${T.border}`, borderTopColor: T.sage, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 16, color: T.muted, fontSize: 14, fontFamily: T.body }}>Loading your form…</p>
      </div>
    </div>
  )

  // ── Error ───────────────────────────────────────────────────────────────
  if (fetchErr) return (
    <div style={s.fullPage}>
      <InjectStyles />
      <div style={s.centerFull}>
        <AlertTriangle size={32} style={{ color: T.error }} />
        <p style={{ marginTop: 14, color: T.dark, fontSize: 15, fontFamily: T.body, textAlign: 'center', maxWidth: 300 }}>{fetchErr}</p>
      </div>
    </div>
  )

  // ── Already completed ───────────────────────────────────────────────────
  if (alreadyDone) return (
    <div style={s.fullPage}>
      <InjectStyles />
      <div style={s.centerFull}>
        <div style={s.completedCard}>
          <CheckCircle size={40} style={{ color: T.sage, marginBottom: 20 }} />
          <h2 style={{ fontFamily: T.display, fontSize: 28, fontWeight: 400, color: T.dark, margin: '0 0 10px', lineHeight: 1.2 }}>
            Already Submitted
          </h2>
          <p style={{ color: T.muted, fontSize: 14, fontFamily: T.body, lineHeight: 1.7, margin: 0 }}>
            Thank you for completing the prescreening.<br />Our team will be in touch with you soon.
          </p>
        </div>
      </div>
    </div>
  )

  // ── Success ─────────────────────────────────────────────────────────────
  if (submitted) return (
    <div style={s.fullPage}>
      <InjectStyles />
      <div style={s.centerFull}>
        <div style={{ ...s.completedCard, animation: 'fadeSlideUp 0.5s ease forwards' }}>
          <div style={s.successLeaf}>🌿</div>
          <h2 style={{ fontFamily: T.display, fontSize: 30, fontWeight: 400, color: T.dark, margin: '0 0 12px', lineHeight: 1.2 }}>
            Thank you, {candidateName.split(' ')[0]}.
          </h2>
          <p style={{ color: T.muted, fontSize: 14, fontFamily: T.body, lineHeight: 1.8, margin: '0 0 6px' }}>
            Your prescreening for the <strong style={{ color: T.dark }}>{roleTitle}</strong> role has been received.
          </p>
          <p style={{ color: T.muted, fontSize: 14, fontFamily: T.body, lineHeight: 1.8, margin: 0 }}>
            Our team will review your responses and reach out within <strong style={{ color: T.dark }}>2–3 business days</strong>.
          </p>
          <div style={s.goldDivider} />
          <p style={{ color: T.gold, fontSize: 12, fontFamily: T.body, letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
            Samara Lombok · Human Resources
          </p>
        </div>
      </div>
    </div>
  )

  // ── Build sections ───────────────────────────────────────────────────────
  const DEFAULT_FIELDS = [
    { field_key: 'current_salary', type: 'currency', label: 'Current Monthly Salary (IDR)', required: false },
    { field_key: 'expected_salary', type: 'currency', label: 'Expected Monthly Salary (IDR)', required: true },
    {
      field_key: 'notice_period', type: 'select', label: 'Notice Period', required: true,
      options: ['Immediately available', '1 week', '2 weeks', '1 month', '2 months', '3 months']
    },
    { field_key: 'availability_date', type: 'date', label: 'Earliest Start Date', required: false },
    {
      field_key: 'previous_application', type: 'yes_no_detail', label: 'Have you applied to Samara Lombok before?', required: true,
      detail_prompt: 'When and for which role?'
    },
    {
      field_key: 'has_relatives', type: 'yes_no_detail', label: 'Do you have any relatives currently working at Samara Lombok?', required: true,
      detail_prompt: 'Please state their name and department.'
    },
    { field_key: 'mbti_type', type: 'mbti_url', label: 'Personality Profile URL', required: false },
  ]

  const fixedFields = template?.fixed_fields ? template.fixed_fields.filter(f => f.enabled !== false) : DEFAULT_FIELDS
  const customQuestions = template?.custom_questions || []
  const sections = buildSections(fixedFields, customQuestions)
  const totalSteps = sections.length + 1 // +1 for welcome
  const progress = step === 0 ? 0 : Math.round((step / totalSteps) * 100)

  return (
    <div style={s.fullPage}>
      <InjectStyles />
      <div ref={topRef} />

      {/* ── Gold Progress Bar ── */}
      {step > 0 && (
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
      )}

      <div style={s.pageContainer}>

        {/* ── STEP 0: Welcome ── */}
        {step === 0 && (
          <div style={{ animation: 'fadeSlideUp 0.4s ease forwards' }}>
            {/* Brand mark */}
            <div style={s.brandHeader}>
              <div style={s.logoMark}>
                <span style={{ fontSize: 22 }}>🌿</span>
              </div>
              <span style={s.brandName}>SAMARA LOMBOK</span>
            </div>

            {/* Welcome card */}
            <div style={s.welcomeCard}>
              {department && <span style={s.deptBadge}>{department}</span>}
              <h1 style={s.welcomeTitle}>
                Prescreening for<br /><em>{roleTitle}</em>
              </h1>
              <div style={s.goldRule} />
              <p style={s.welcomeGreeting}>
                Dear <strong style={{ color: T.dark }}>{candidateName}</strong>,
              </p>
              <p style={s.welcomeBody}>
                Thank you for your interest in joining the Samara family.
                This brief form helps our team learn more about you before
                we connect — it should take no more than <strong style={{ color: T.dark }}>3–5 minutes</strong> to complete.
              </p>
              <p style={s.welcomeBody}>
                Please answer each question honestly. Your information is
                handled with complete confidentiality.
              </p>
              <div style={s.stepMeta}>
                <span style={s.stepMetaText}>{sections.length} section{sections.length !== 1 ? 's' : ''} · ~{Math.max(2, Math.ceil(sections.length * 0.8))} min</span>
              </div>
              <button onClick={goNext} style={s.btnPrimary}>
                Begin Prescreening
                <ChevronRight size={16} style={{ marginLeft: 8 }} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEPS 1..n: Sections ── */}
        {step > 0 && step <= sections.length && (() => {
          const section = sections[step - 1]
          const isLast = step === sections.length
          return (
            <div key={section.id} style={{ animation: 'fadeSlideUp 0.35s ease forwards' }}>

              {/* Section header */}
              <div style={s.sectionHeader}>
                <p style={s.stepCounter}>Step {step} of {sections.length}</p>
                <h2 style={s.sectionTitle}>{section.title}</h2>
                {section.subtitle && <p style={s.sectionSubtitle}>{section.subtitle}</p>}
              </div>

              {/* Fields */}
              <form
                onSubmit={isLast ? handleSubmit : (e) => { e.preventDefault(); goNext() }}
                style={s.formBody}
              >
                {submitErr && isLast && (
                  <div style={s.errorBanner}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    {submitErr}
                  </div>
                )}

                {/* Fixed fields for this section */}
                {section.fields.map(field => (
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
                {section.custom && section.custom.map((q, i) => (
                  <CustomQuestion
                    key={i}
                    q={q}
                    index={i}
                    value={form[`custom_q_${i}`]}
                    onChange={val => set(`custom_q_${i}`, val)}
                  />
                ))}

                {/* Navigation */}
                <div style={s.navRow}>
                  <button type="button" onClick={goPrev} style={s.btnBack}>
                    <ChevronLeft size={16} style={{ marginRight: 4 }} />
                    Back
                  </button>
                  {isLast ? (
                    <button type="submit" disabled={submitting} style={{ ...s.btnPrimary, ...(submitting ? { opacity: 0.7, cursor: 'not-allowed' } : {}) }}>
                      {submitting
                        ? <><Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite', marginRight: 8 }} />Submitting…</>
                        : <>Submit & Continue My Application <ChevronRight size={16} style={{ marginLeft: 8 }} /></>
                      }
                    </button>
                  ) : (
                    <button type="submit" style={s.btnPrimary}>
                      Continue
                      <ChevronRight size={16} style={{ marginLeft: 8 }} />
                    </button>
                  )}
                </div>
              </form>
            </div>
          )
        })()}

      </div>
    </div>
  )
}

// ── Field Renderer ────────────────────────────────────────────────────────────

function FieldRenderer({ field, value, detailValue, onChange, onDetailChange }) {
  switch (field.type) {
    case 'currency':
      return (
        <Field label={field.label} required={field.required} hint="Enter amount in Indonesian Rupiah (IDR)">
          <div style={s.currencyWrap}>
            <span style={s.currencyPrefix}>Rp</span>
            <input
              value={value ? formatIDR(String(value)) : ''}
              onChange={e => onChange(formatIDR(e.target.value))}
              style={{ ...s.input, paddingLeft: 44 }}
              placeholder="e.g. 7.000.000"
              required={field.required}
              inputMode="numeric"
            />
          </div>
        </Field>
      )

    case 'select':
      return (
        <Field label={field.label} required={field.required}>
          <div style={s.selectWrap}>
            <select
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              style={s.select}
              required={field.required}
            >
              <option value="">Select an option…</option>
              {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <ChevronRight size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.muted, pointerEvents: 'none' }} />
          </div>
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
            style={{ ...s.input, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
            placeholder="Type your answer…"
            required={field.required}
          />
        </Field>
      )

    case 'yes_no_detail':
      return (
        <Field label={field.label} required={field.required}>
          <div style={s.pillGroup}>
            <PillButton
              active={value === 'yes'}
              onClick={() => onChange(value === 'yes' ? '' : 'yes')}
              label="Yes"
            />
            <PillButton
              active={value === 'no'}
              onClick={() => onChange(value === 'no' ? '' : 'no')}
              label="No"
            />
          </div>
          {value === 'yes' && (
            <div style={{ marginTop: 12, animation: 'fadeSlideUp 0.25s ease forwards' }}>
              <input
                value={detailValue || ''}
                onChange={e => onDetailChange(e.target.value)}
                style={s.input}
                placeholder={field.detail_prompt || 'Please provide details…'}
                required={field.required}
              />
            </div>
          )}
        </Field>
      )

    case 'mbti_url':
      return (
        <MbtiUrlField
          value={value || ''}
          onChange={onChange}
          required={field.required}
        />
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

// ── MBTI URL Field ────────────────────────────────────────────────────────────

function MbtiUrlField({ value, onChange, required }) {
  const [urlError, setUrlError] = useState('')

  const validate = (val) => {
    if (!val) { setUrlError(''); return }
    const isUrl = /^https?:\/\/.+/.test(val)
    setUrlError(isUrl ? '' : 'Please paste a valid URL (starting with https://)')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Explainer */}
      <div style={s.mbtiInfoBox}>
        <p style={{ margin: 0, fontSize: 14, fontFamily: T.body, color: T.dark, lineHeight: 1.7 }}>
          At Samara, understanding personality helps us build high-performing, culturally aligned teams.
          We use the <strong>16 Personalities</strong> assessment — it's free, takes ~10 minutes, and the results are insightful for you too.
        </p>
      </div>

      {/* CTA Button */}
      <a
        href="https://www.16personalities.com/free-personality-test"
        target="_blank"
        rel="noopener noreferrer"
        style={s.mbtiExternalBtn}
      >
        <ExternalLink size={15} style={{ marginRight: 8 }} />
        Take the Personality Test ↗
      </a>

      {/* Instruction */}
      <Field label="Personality Profile URL" required={required}>
        <p style={{ marginBottom: 8, fontSize: 13, color: T.muted, fontFamily: T.body, lineHeight: 1.6 }}>
          Once you complete the test, copy the URL of your result page and paste it below.<br />
          <span style={{ color: T.muted, fontSize: 12, opacity: 0.8 }}>
            e.g. <em>https://www.16personalities.com/profiles/...</em>
          </span>
        </p>
        <input
          type="url"
          value={value}
          onChange={e => { onChange(e.target.value); validate(e.target.value) }}
          style={{ ...s.input, ...(urlError ? { borderColor: T.error } : {}) }}
          placeholder="https://www.16personalities.com/profiles/..."
          required={required}
        />
        {urlError && (
          <p style={{ fontSize: 12, color: T.error, margin: '4px 0 0', fontFamily: T.body }}>{urlError}</p>
        )}
      </Field>
    </div>
  )
}

// ── Custom Question Renderer ──────────────────────────────────────────────────

function CustomQuestion({ q, index, value, onChange }) {
  return (
    <Field label={`${index + 1}. ${q.question}`} required={q.required}>
      {q.type === 'textarea' ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{ ...s.input, minHeight: 100, resize: 'vertical', lineHeight: 1.6 }}
          placeholder="Share your thoughts…"
          required={q.required}
        />
      ) : q.type === 'select' ? (
        <div style={s.selectWrap}>
          <select
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            style={s.select}
            required={q.required}
          >
            <option value="">Select an option…</option>
            {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronRight size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: T.muted, pointerEvents: 'none' }} />
        </div>
      ) : q.type === 'number' ? (
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={s.input}
          placeholder="Enter a number"
          required={q.required}
          inputMode="numeric"
        />
      ) : (
        <input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={s.input}
          placeholder="Type your answer…"
          required={q.required}
        />
      )}
    </Field>
  )
}

// ── Field Wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={s.fieldLabel}>
        {label}
        {required && <span style={{ color: T.gold, marginLeft: 4 }}>*</span>}
      </label>
      {hint && <p style={s.fieldHint}>{hint}</p>}
      {children}
    </div>
  )
}

// ── Pill Button ───────────────────────────────────────────────────────────────

function PillButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...s.pill,
        ...(active ? s.pillActive : s.pillInactive),
      }}
    >
      {label}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  fullPage: {
    minHeight: '100vh',
    background: T.cream,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: T.body,
  },
  centerFull: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '0 24px',
  },
  progressTrack: {
    position: 'sticky',
    top: 0,
    width: '100%',
    height: 4,
    background: T.border,
    zIndex: 100,
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${T.sage}, ${T.gold})`,
    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '0 2px 2px 0',
  },
  pageContainer: {
    width: '100%',
    maxWidth: 600,
    padding: '0 20px 80px',
  },
  brandHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '32px 0 24px',
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: T.sageLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontFamily: T.body,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.18em',
    color: T.dark,
    textTransform: 'uppercase',
  },
  welcomeCard: {
    background: T.white,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: '40px 36px 44px',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  deptBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    color: T.sage,
    background: T.sageLight,
    borderRadius: 4,
    padding: '3px 9px',
    letterSpacing: '0.04em',
    marginBottom: 20,
    fontFamily: T.body,
    textTransform: 'uppercase',
  },
  welcomeTitle: {
    fontFamily: T.display,
    fontSize: 36,
    fontWeight: 400,
    color: T.dark,
    margin: '0 0 20px',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  goldRule: {
    width: 40,
    height: 2,
    background: T.gold,
    borderRadius: 1,
    marginBottom: 24,
  },
  welcomeGreeting: {
    fontFamily: T.body,
    fontSize: 15,
    color: T.dark,
    margin: '0 0 12px',
    lineHeight: 1.7,
  },
  welcomeBody: {
    fontFamily: T.body,
    fontSize: 14,
    color: T.muted,
    margin: '0 0 14px',
    lineHeight: 1.8,
  },
  stepMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
    marginTop: 8,
  },
  stepMetaText: {
    fontSize: 12,
    color: T.muted,
    fontFamily: T.body,
    letterSpacing: '0.04em',
  },
  sectionHeader: {
    padding: '32px 0 28px',
    borderBottom: `1px solid ${T.border}`,
    marginBottom: 28,
  },
  stepCounter: {
    fontFamily: T.body,
    fontSize: 12,
    color: T.gold,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 600,
    margin: '0 0 8px',
  },
  sectionTitle: {
    fontFamily: T.display,
    fontSize: 30,
    fontWeight: 400,
    color: T.dark,
    margin: '0 0 10px',
    lineHeight: 1.2,
  },
  sectionSubtitle: {
    fontFamily: T.body,
    fontSize: 14,
    color: T.muted,
    margin: 0,
    lineHeight: 1.7,
  },
  formBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 500,
    color: T.dark,
    fontFamily: T.body,
    lineHeight: 1.4,
  },
  fieldHint: {
    fontSize: 12,
    color: T.muted,
    margin: '-4px 0 0',
    fontFamily: T.body,
    lineHeight: 1.5,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 16,
    color: T.dark,
    background: T.white,
    outline: 'none',
    fontFamily: T.body,
    lineHeight: 1.5,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    WebkitAppearance: 'none',
  },
  currencyWrap: {
    position: 'relative',
  },
  currencyPrefix: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 14,
    color: T.muted,
    fontFamily: T.body,
    pointerEvents: 'none',
    zIndex: 1,
  },
  selectWrap: {
    position: 'relative',
  },
  select: {
    width: '100%',
    padding: '12px 40px 12px 16px',
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 16,
    color: T.dark,
    background: T.white,
    outline: 'none',
    fontFamily: T.body,
    lineHeight: 1.5,
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
  },
  pillGroup: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  pill: {
    flex: '1 1 120px',
    minHeight: 48,
    border: `1.5px solid ${T.border}`,
    borderRadius: 10,
    fontSize: 15,
    fontFamily: T.body,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    outline: 'none',
    padding: '10px 20px',
  },
  pillActive: {
    background: T.sage,
    color: T.white,
    borderColor: T.sage,
    boxShadow: `0 2px 8px rgba(74,124,116,0.25)`,
  },
  pillInactive: {
    background: T.white,
    color: T.dark,
  },
  mbtiInfoBox: {
    background: T.sageLight,
    border: `1px solid rgba(74,124,116,0.15)`,
    borderRadius: 10,
    padding: '16px 18px',
  },
  mbtiExternalBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '12px 20px',
    border: `1.5px solid ${T.sage}`,
    borderRadius: 10,
    color: T.sage,
    fontFamily: T.body,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    background: 'transparent',
    transition: 'background 0.15s, color 0.15s',
    alignSelf: 'flex-start',
    cursor: 'pointer',
    letterSpacing: '0.01em',
  },
  navRow: {
    display: 'flex',
    gap: 12,
    paddingTop: 8,
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    background: T.sage,
    color: T.white,
    border: 'none',
    borderRadius: 12,
    padding: '14px 24px',
    fontSize: 15,
    fontWeight: 600,
    fontFamily: T.body,
    cursor: 'pointer',
    minHeight: 52,
    transition: 'background 0.15s, transform 0.1s',
    letterSpacing: '0.01em',
  },
  btnBack: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    color: T.muted,
    border: `1.5px solid ${T.border}`,
    borderRadius: 12,
    padding: '14px 20px',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: T.body,
    cursor: 'pointer',
    minHeight: 52,
    transition: 'border-color 0.15s, color 0.15s',
    flexShrink: 0,
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: T.errorBg,
    border: `1px solid ${T.errorBorder}`,
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 13,
    color: T.error,
    fontFamily: T.body,
    lineHeight: 1.5,
  },
  completedCard: {
    background: T.white,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    padding: '48px 40px 44px',
    maxWidth: 460,
    width: '100%',
    textAlign: 'center',
    margin: '0 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  successLeaf: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: T.sageLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 28,
    marginBottom: 24,
  },
  goldDivider: {
    width: 40,
    height: 1,
    background: T.gold,
    margin: '24px auto 20px',
    opacity: 0.6,
  },
}
