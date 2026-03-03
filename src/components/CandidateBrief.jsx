/**
 * CandidateBrief.jsx
 *
 * Unified candidate view matching the DM Sans design system (HTML template).
 * Sections: Hero · Profile · CV Summary · Employment · Education · Certificates · Flags
 */

import { useState, useEffect, forwardRef, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'
import './CandidateBrief.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayIDR(num) {
  if (!num) return null
  return 'Rp ' + parseInt(num).toLocaleString('id-ID')
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return dateStr }
}

function formatMonthYear(yyyyMM) {
  if (!yyyyMM || yyyyMM === 'Present') return 'Present'
  try {
    const [y, m] = yyyyMM.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1)
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  } catch { return yyyyMM }
}

// Classify a flag string as 'danger' or 'warning'
function flagSeverity(flagText) {
  const lower = (flagText || '').toLowerCase()
  if (lower.includes('instabilit') || lower.includes('unclear if still') || lower.includes('terminated') || lower.includes('fired'))
    return 'danger'
  return 'warning'
}

// Map AI risk_flag severity to our flag type
function riskSeverity(sev) {
  return sev === 'high' ? 'danger' : 'warning'
}

// ── Avatar with photo upload ──────────────────────────────────────────────────
function Avatar() {
  const [photo, setPhoto] = useState(null)
  const inputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPhoto(ev.target.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="avatar" onClick={() => inputRef.current?.click()} title="Click to upload photo">
      {photo ? (
        <img src={photo} alt="Candidate" />
      ) : (
        <>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span>Add Photo</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  )
}

// ── Stage badge style ─────────────────────────────────────────────────────────
const STAGE_EMOJI = {
  New: '🆕',
  Screening: '⏳',
  'Interview Pending': '📅',
  'Interview Scheduled': '📅',
  'Interview Completed': '✅',
  Offer: '📄',
  Hired: '🎉',
  Rejected: '❌',
}

// Using inline overrides only for colors on the badge to keep the class structure
const STAGE_STYLE = {
  Screening: { bg: 'var(--amber-light)', color: '#92650A', border: '#F0CC85' },
  New: { bg: '#F3F4F6', color: 'var(--text-muted)', border: 'var(--border)' },
  'Interview Pending': { bg: 'var(--amber-light)', color: '#92650A', border: '#F0CC85' },
  'Interview Scheduled': { bg: 'var(--teal-light)', color: '#1A5C53', border: 'var(--teal-mid)' },
  'Interview Completed': { bg: 'var(--teal-light)', color: '#1A5C53', border: 'var(--teal-mid)' },
  Offer: { bg: 'var(--amber-light)', color: '#92650A', border: '#F0CC85' },
  Hired: { bg: 'var(--teal-light)', color: '#1A5C53', border: 'var(--teal-mid)' },
  Rejected: { bg: '#FDECEA', color: '#9B1C1C', border: '#FECACA' },
}

// ── Main component ────────────────────────────────────────────────────────────
const CandidateBrief = forwardRef(function CandidateBrief({ applicationId }, ref) {
  const [data, setData] = useState(null)
  const [cv, setCV] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: app } = await supabase
        .from('applications')
        .select(`
          *,
          candidates!inner(*),
          roles!inner(id, title, department),
          application_scores(*),
          screening_questions(*),
          prescreening_responses(*)
        `)
        .eq('id', applicationId)
        .single()

      if (app) {
        setData(app)
        const { data: cvData } = await supabase
          .from('cv_sources')
          .select('parsed_data')
          .eq('candidate_id', app.candidates.id)
          .eq('is_active', true)
          .maybeSingle()
        setCV(cvData?.parsed_data || null)
      }
      setLoading(false)
    }
    load()
  }, [applicationId])

  if (loading) return (
    <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-muted)', fontFamily: "'DM Sans', sans-serif" }}>
      <Loader2 size={26} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 12, fontSize: 13 }}>Loading candidate brief…</p>
    </div>
  )

  if (!data) return (
    <div style={{ padding: 80, textAlign: 'center', color: 'var(--red)', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ fontSize: 14, fontWeight: 500 }}>Candidate data not found.</p>
    </div>
  )

  const candidate = data.candidates
  const role = data.roles
  const latestScore = Array.isArray(data.application_scores)
    ? data.application_scores[data.application_scores.length - 1]
    : data.application_scores
  const questions = Array.isArray(data.screening_questions)
    ? data.screening_questions[data.screening_questions.length - 1]
    : data.screening_questions
  const prescreen = Array.isArray(data.prescreening_responses)
    ? data.prescreening_responses[0]
    : data.prescreening_responses
  const prescreenResponses = prescreen?.responses || {}
  const prescreenTemplate = prescreen?.template_snapshot || {}

  const stageStyle = STAGE_STYLE[data.stage] || STAGE_STYLE.New
  const emoji = STAGE_EMOJI[data.stage] || ''

  // Merge CV flags + risk flags
  const allFlags = [
    ...(cv?.flags || []).map(f => ({ text: f, type: flagSeverity(f) })),
    ...(latestScore?.risk_flags || []).map(rf => ({ text: rf.detail ? `${rf.flag} — ${rf.detail}` : rf.flag, type: riskSeverity(rf.severity) })),
  ]

  const profileItems = [
    { label: 'Origin', value: candidate.origin || null, colClass: '' },
    { label: 'WhatsApp', value: candidate.whatsapp || null, colClass: '' },
    { label: 'Email', value: candidate.email || null, isEmail: true, colClass: 'profile-item-col-3' },
    { label: 'Current Salary', value: displayIDR(candidate.current_salary), colClass: 'profile-item-last-row' },
    { label: 'Expected Salary', value: displayIDR(candidate.expected_salary), colClass: 'profile-item-last-row' },
    { label: 'Availability', value: candidate.availability_to_start || null, colClass: 'profile-item-col-3 profile-item-last-row' },
  ]

  const numRoles = cv?.employment_history?.length ?? null

  return (
    <div ref={ref} className="candidate-brief-wrapper">
      <div className="page">

        {/* ── HERO ── */}
        <div className="hero">
          <div className="hero-left">
            <Avatar />
            <div className="hero-text">
              <span className="division-tag">{role.department}</span>
              <h1>{candidate.full_name}</h1>
              <span className="role">
                {role.title}
                {cv?.current_role && cv.current_role !== role.title ? ` · ${cv.current_role}` : ''}
              </span>
            </div>
          </div>
          <div className="hero-right">
            <span className="status-badge" style={{ background: stageStyle.bg, color: stageStyle.color, borderColor: stageStyle.border }}>
              {emoji} {data.stage}
            </span>
            <span className="apply-date">Applied {formatDate(data.created_at)}</span>
          </div>
        </div>

        {/* ── PROFILE ── */}
        <div className="card">
          <div className="section-label">Profile</div>
          <div className="profile-grid">
            {profileItems.map((item, i) => (
              <div key={i} className={`profile-item ${item.colClass}`}>
                <div className="profile-label">{item.label}</div>
                {item.isEmail && item.value ? (
                  <div className="profile-value">
                    <a href={`mailto:${item.value}`}>{item.value}</a>
                  </div>
                ) : item.value ? (
                  <div className="profile-value">{item.value}</div>
                ) : (
                  <div className="profile-value muted">Not stated</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CV SUMMARY ── */}
        {cv && (
          <div className="card">
            <div className="section-label">CV Summary</div>
            <div className="metrics-row">
              <div className="metric-box">
                <div className="metric-value">{cv.experience_years != null ? `${cv.experience_years} yrs` : '—'}</div>
                <div className="metric-label">Total Experience</div>
              </div>
              <div className="metric-box">
                <div className="metric-value">{cv.average_tenure_months != null ? `${Math.round(cv.average_tenure_months)} mo` : '—'}</div>
                <div className="metric-label">Avg. Tenure</div>
              </div>
              <div className="metric-box">
                <div className="metric-value">{numRoles != null ? numRoles : '—'}</div>
                <div className="metric-label">Previous Roles</div>
              </div>
            </div>

            {cv.skills?.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: 4 }}>Skills</div>
                <div className="skills-wrap">
                  {cv.skills.map((s, i) => (
                    <span key={i} className="skill-tag">{s}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── EMPLOYMENT HISTORY ── */}
        {cv?.employment_history?.length > 0 && (
          <div className="card">
            <div className="section-label">Employment History</div>
            <div className="timeline">
              {cv.employment_history.map((job, i) => {
                const isCurrent = !job.end || job.end === 'Present'
                const responsibilities = job.responsibilities || job.duties || []
                return (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot ${(!job.end || job.end === 'Present') && i === 0 ? 'current' : ''}`}></div>
                    <div className="timeline-content">
                      <div className="timeline-title">{job.role || job.title}</div>
                      <div className="timeline-company">{job.company}</div>
                      {job.location ? (
                        <div className="timeline-location">📍 {job.location}</div>
                      ) : (
                        <div className="timeline-location location-not-stated">📍 Location not stated in CV</div>
                      )}

                      <div className="timeline-meta">
                        <span>{formatMonthYear(job.start)} – {formatMonthYear(job.end)}</span>
                        {job.duration_months > 0 && (
                          <span className="tenure-pill">
                            {job.duration_months >= 60
                              ? `${Math.floor(job.duration_months / 12)} yr${Math.floor(job.duration_months / 12) > 1 ? 's' : ''} ${job.duration_months % 12 > 0 ? `${job.duration_months % 12} mo` : ''}`
                              : `${job.duration_months} mo`}
                          </span>
                        )}
                      </div>

                      {responsibilities.length > 0 && (
                        <div className="responsibilities" style={{ marginTop: 12 }}>
                          <ul className="timeline-responsibilities">
                            {responsibilities.map((r, ri) => (
                              <li key={ri}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── EDUCATION ── */}
        {cv?.education?.length > 0 && (
          <div className="card">
            <div className="section-label">Education</div>
            {cv.education.map((edu, i) => (
              <div key={i} className="edu-row">
                <div>
                  <div className="edu-degree">
                    {edu.degree}{edu.field ? ` in ${edu.field}` : ''}
                  </div>
                  <div className="edu-school">{edu.institution}</div>
                  {edu.gpa && (
                    <span className="edu-gpa">GPA {edu.gpa}{edu.honor ? ` – ${edu.honor}` : ''}</span>
                  )}
                </div>
                {edu.year && <div className="edu-year">{edu.year}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── CERTIFICATES ── */}
        {cv?.certificates?.length > 0 && (
          <div className="card">
            <div className="section-label">Certificates</div>
            <div className="timeline" style={{ gap: 0 }}>
              {cv.certificates.map((cert, i) => (
                <div key={i} className="cert-item">
                  <div>
                    <div className="cert-name">{cert.name || cert.title}</div>
                    {(cert.issuer || cert.institution) && (
                      <div className="cert-issuer">{cert.issuer || cert.institution}</div>
                    )}
                  </div>
                  {(cert.year || cert.date) && (
                    <div className="cert-year">{cert.year || cert.date}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PRESCREENING ── */}
        {prescreen?.status === 'completed' && (() => {
          const fields = (prescreenTemplate.fixed_fields || []).filter(f => f.enabled !== false && f.field_key !== 'mbti_type')
          const customs = prescreenTemplate.custom_questions || []
          if (!fields.length && !customs.length && !prescreenResponses.mbti_type) return null
          return (
            <div className="card">
              <div className="section-label">Prescreening Responses</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {prescreenResponses.mbti_type && (
                  <div>
                    <div className="pre-label">MBTI Type</div>
                    <span className="skill-tag" style={{ fontSize: 16, fontFamily: 'var(--monoFont)', padding: '3px 12px', borderRadius: 6 }}>
                      {prescreenResponses.mbti_type.toUpperCase()}
                    </span>
                  </div>
                )}
                {fields.map(field => {
                  const val = prescreenResponses[field.field_key]
                  const detail = prescreenResponses[`${field.field_key}_detail`]
                  let displayVal = val || null
                  if (field.type === 'currency' && val) displayVal = displayIDR(val)
                  else if (field.type === 'yes_no_detail') {
                    displayVal = val === 'yes' ? `Yes — ${detail || '(no details)'}` : val === 'no' ? 'No' : null
                  }
                  return (
                    <div key={field.field_key}>
                      <div className="pre-label">{field.label}</div>
                      <div className={`pre-value ${!displayVal ? 'muted' : ''}`}>{displayVal || 'Not stated'}</div>
                    </div>
                  )
                })}
                {customs.map((q, i) => {
                  const val = prescreenResponses[`custom_q_${i}`]
                  return (
                    <div key={i}>
                      <div className="pre-label">{q.question}</div>
                      <div className={`pre-value ${!val ? 'muted' : ''}`} style={{ whiteSpace: 'pre-wrap' }}>{val || 'Not stated'}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ── AI COMPATIBILITY SCORE ── */}
        {latestScore && (
          <div className="card">
            <div className="section-label">AI Compatibility Score</div>

            <div className="score-circle-container" style={{ marginBottom: latestScore.executive_summary ? 16 : 0 }}>
              <div className={`score-circle ${latestScore.overall_score >= 70 ? 'good' : latestScore.overall_score >= 40 ? 'mid' : 'bad'}`}>
                {latestScore.overall_score}
              </div>

              <div style={{ flex: 1, minWidth: 200 }}>
                {[
                  { label: 'Must-Have', value: latestScore.must_have_score },
                  { label: 'Nice-to-Have', value: latestScore.nice_to_have_score },
                  { label: 'Salary Fit', value: latestScore.salary_alignment_score },
                ].map(({ label, value }) => value != null && (
                  <div key={label} className="score-bar-row">
                    <span className="score-label">{label}</span>
                    <div className="score-track">
                      <div className={`score-fill ${value >= 70 ? 'good' : value >= 40 ? 'mid' : 'bad'}`} style={{ width: `${value}%` }} />
                    </div>
                    <span className="score-value-text">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {latestScore.executive_summary && (
              <div className="responsibilities">
                <div className="resp-label">Executive Summary</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                  {latestScore.executive_summary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INTERVIEW FOCUS ── */}
        {latestScore?.interview_focus?.length > 0 && (
          <div className="card">
            <div className="section-label">Interview Focus Areas</div>
            <ul className="ol-list">
              {latestScore.interview_focus.map((area, i) => (
                <li key={i} className="ol-item">
                  <span className="ol-num">{i + 1}</span>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── SCREENING QUESTIONS ── */}
        {questions?.questions && (
          <div className="card">
            <div className="section-label">Screening Questions</div>
            {Object.entries(questions.questions).map(([cat, qList]) => {
              if (!Array.isArray(qList) || !qList.length) return null
              return (
                <div key={cat} className="q-list">
                  <div className="q-cat-title">{cat.replace(/_/g, ' ')}</div>
                  {qList.map((q, i) => (
                    <div key={i} className="q-item">
                      <p className="q-text">
                        <span className="q-num">{i + 1}.</span>
                        {q.question || q}
                      </p>
                      {q.rationale && (
                        <p className="q-rationale">{q.rationale}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        )}

        {/* ── CV FLAGS ── */}
        {allFlags.length > 0 && (
          <div className="card">
            <div className="section-label">CV Flags</div>
            <div className="flags-list">
              {allFlags.map((flag, i) => (
                <div key={i} className={`flag-item ${flag.type}`}>
                  <span className="flag-icon">{flag.type === 'danger' ? '🔴' : '⚠️'}</span>
                  <span className="flag-text">{flag.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="footer">
          <span>Generated by Samara ATS</span>
          <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </div>

      </div>
    </div>
  )
})

export default CandidateBrief
