/**
 * CandidateBrief.jsx
 *
 * Unified candidate view that aggregates all data into a single,
 * print-friendly layout for interviewers. Combines:
 * - Candidate profile
 * - CV summary (from parsed_data)
 * - Prescreening form responses
 * - MBTI result
 * - AI compatibility score + risk flags
 * - Interview focus areas
 * - Screening questions
 */

import { useState, useEffect, forwardRef } from 'react'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

function displayIDR(num) {
  if (!num) return '—'
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

const CandidateBrief = forwardRef(function CandidateBrief({ applicationId }, ref) {
  const [data, setData] = useState(null)
  const [cv, setCV] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Fetch application with all joins
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

        // Fetch parsed CV
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

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#9A8F80' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 12, fontSize: 13 }}>Loading candidate brief…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#C0614A' }}>
        <p style={{ fontSize: 14, fontWeight: 500 }}>Candidate data not found.</p>
      </div>
    )
  }

  const candidate = data.candidates
  const role = data.roles
  const score = data.application_scores?.[0] || (Array.isArray(data.application_scores) ? null : data.application_scores)
  const latestScore = Array.isArray(data.application_scores) ? data.application_scores[data.application_scores.length - 1] : data.application_scores
  const questions = Array.isArray(data.screening_questions) ? data.screening_questions[data.screening_questions.length - 1] : data.screening_questions
  const prescreen = Array.isArray(data.prescreening_responses) ? data.prescreening_responses[0] : data.prescreening_responses
  const prescreenResponses = prescreen?.responses || {}
  const prescreenTemplate = prescreen?.template_snapshot || {}

  return (
    <div ref={ref} style={pageStyle}>

      {/* ═══ 1. HEADER ═══ */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#2C2A27', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
              {candidate.full_name}
            </h1>
            <p style={{ fontSize: 14, color: '#6B6560', margin: 0 }}>
              {role.title} · {role.department}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={stageBadge(data.stage)}>{data.stage}</span>
            <p style={{ fontSize: 11, color: '#9A8F80', marginTop: 4 }}>
              Applied {formatDate(data.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ 2. PROFILE SUMMARY ═══ */}
      <div style={sectionStyle}>
        <SectionTitle>Profile</SectionTitle>
        <div style={gridStyle}>
          <InfoCell label="Origin" value={candidate.origin || '—'} />
          <InfoCell label="WhatsApp" value={candidate.whatsapp || '—'} />
          <InfoCell label="Email" value={candidate.email || '—'} />
          <InfoCell label="Current Salary" value={displayIDR(candidate.current_salary)} />
          <InfoCell label="Expected Salary" value={displayIDR(candidate.expected_salary)} />
          <InfoCell label="Availability" value={candidate.availability_to_start || '—'} />
        </div>
      </div>

      {/* ═══ 3. MBTI ═══ */}
      {prescreenResponses.mbti_type && (
        <div style={sectionStyle}>
          <SectionTitle>MBTI Type</SectionTitle>
          <span style={{
            fontSize: 20, fontWeight: 700, letterSpacing: '0.12em',
            color: '#4A7C74', background: 'rgba(74,124,116,0.08)',
            padding: '4px 14px', borderRadius: 6,
          }}>
            {prescreenResponses.mbti_type.toUpperCase()}
          </span>
        </div>
      )}

      {/* ═══ 4. CV SUMMARY ═══ */}
      {cv && (
        <div style={sectionStyle}>
          <SectionTitle>CV Summary</SectionTitle>
          <div style={gridStyle}>
            {cv.current_role && <InfoCell label="Current Role" value={cv.current_role} />}
            {cv.experience_years && <InfoCell label="Experience" value={`${cv.experience_years} years`} />}
            {cv.average_tenure_months && <InfoCell label="Avg. Tenure" value={`${cv.average_tenure_months} months`} />}
          </div>

          {/* Skills */}
          {cv.skills?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={subLabelStyle}>Skills</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cv.skills.map((s, i) => (
                  <span key={i} style={skillTag}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Employment history */}
          {cv.employment_history?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={subLabelStyle}>Employment History</p>
              {cv.employment_history.map((job, i) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 12.5, color: '#2C2A27', lineHeight: 1.5 }}>
                  <strong>{job.role || job.title}</strong> at {job.company}
                  <span style={{ color: '#9A8F80', marginLeft: 6 }}>
                    {job.start} — {job.end || 'Present'}
                    {job.duration_months ? ` (${job.duration_months}mo)` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {cv.education?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={subLabelStyle}>Education</p>
              {cv.education.map((edu, i) => (
                <div key={i} style={{ fontSize: 12.5, color: '#2C2A27', marginBottom: 4 }}>
                  {edu.degree} in {edu.field} — {edu.institution} {edu.year ? `(${edu.year})` : ''}
                </div>
              ))}
            </div>
          )}

          {/* Flags */}
          {cv.flags?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={subLabelStyle}>CV Flags</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cv.flags.map((flag, i) => (
                  <span key={i} style={{
                    fontSize: 11, color: '#C0614A', background: 'rgba(192,97,74,0.08)',
                    padding: '2px 8px', borderRadius: 4,
                  }}>
                    {flag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ 5. PRESCREENING ANSWERS ═══ */}
      {prescreen?.status === 'completed' && (
        <div style={sectionStyle}>
          <SectionTitle>Prescreening Responses</SectionTitle>

          {/* Fixed fields */}
          {(prescreenTemplate.fixed_fields || [])
            .filter(f => f.enabled !== false)
            .map(field => {
              const val = prescreenResponses[field.field_key]
              const detail = prescreenResponses[`${field.field_key}_detail`]
              if (field.field_key === 'mbti_type') return null // shown separately above

              let displayVal = val || '—'
              if (field.type === 'currency' && val) displayVal = displayIDR(val)
              else if (field.type === 'yes_no_detail') {
                displayVal = val === 'yes' ? `Yes — ${detail || '(no details)'}` : val === 'no' ? 'No' : '—'
              }

              return (
                <div key={field.field_key} style={{ marginBottom: 8 }}>
                  <p style={subLabelStyle}>{field.label}</p>
                  <p style={{ fontSize: 13, color: '#2C2A27', margin: 0, lineHeight: 1.5 }}>{displayVal}</p>
                </div>
              )
            })}

          {/* Custom questions */}
          {(prescreenTemplate.custom_questions || []).map((q, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <p style={subLabelStyle}>{q.question}</p>
              <p style={{ fontSize: 13, color: '#2C2A27', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {prescreenResponses[`custom_q_${i}`] || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ═══ 6. AI COMPATIBILITY SCORE ═══ */}
      {latestScore && (
        <div style={sectionStyle}>
          <SectionTitle>AI Compatibility Score</SectionTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: 'white',
              background: latestScore.overall_score >= 70 ? '#4A7C74'
                : latestScore.overall_score >= 40 ? '#B8860B' : '#C0614A',
            }}>
              {latestScore.overall_score}
            </div>
            <div style={{ flex: 1 }}>
              <ScoreBar label="Must-Have" value={latestScore.must_have_score} />
              <ScoreBar label="Nice-to-Have" value={latestScore.nice_to_have_score} />
              <ScoreBar label="Salary Fit" value={latestScore.salary_alignment_score} />
            </div>
          </div>

          {latestScore.executive_summary && (
            <div style={{ marginBottom: 12 }}>
              <p style={subLabelStyle}>Executive Summary</p>
              <p style={{ fontSize: 13, color: '#2C2A27', margin: 0, lineHeight: 1.6 }}>
                {latestScore.executive_summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══ 7. RISK FLAGS ═══ */}
      {latestScore?.risk_flags?.length > 0 && (
        <div style={sectionStyle}>
          <SectionTitle>Risk Flags</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {latestScore.risk_flags.map((rf, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 10px', borderRadius: 6,
                background: rf.severity === 'high' ? 'rgba(192,97,74,0.06)'
                  : rf.severity === 'medium' ? 'rgba(184,134,11,0.06)'
                  : 'rgba(154,143,128,0.06)',
                border: `1px solid ${rf.severity === 'high' ? 'rgba(192,97,74,0.15)'
                  : rf.severity === 'medium' ? 'rgba(184,134,11,0.15)'
                  : 'rgba(154,143,128,0.15)'}`,
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  color: rf.severity === 'high' ? '#C0614A' : rf.severity === 'medium' ? '#B8860B' : '#9A8F80',
                  minWidth: 48,
                }}>
                  {rf.severity}
                </span>
                <div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#2C2A27' }}>{rf.flag}</span>
                  {rf.detail && (
                    <p style={{ fontSize: 12, color: '#6B6560', margin: '2px 0 0', lineHeight: 1.4 }}>{rf.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 8. INTERVIEW FOCUS ═══ */}
      {latestScore?.interview_focus?.length > 0 && (
        <div style={sectionStyle}>
          <SectionTitle>Interview Focus Areas</SectionTitle>
          <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {latestScore.interview_focus.map((area, i) => (
              <li key={i} style={{ fontSize: 13, color: '#2C2A27', lineHeight: 1.5 }}>{area}</li>
            ))}
          </ol>
        </div>
      )}

      {/* ═══ 9. SCREENING QUESTIONS ═══ */}
      {questions?.questions && (
        <div style={sectionStyle}>
          <SectionTitle>Screening Questions</SectionTitle>
          {Object.entries(questions.questions).map(([category, qList]) => {
            if (!Array.isArray(qList) || qList.length === 0) return null
            return (
              <div key={category} style={{ marginBottom: 14 }}>
                <p style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#4A7C74', margin: '0 0 6px',
                }}>
                  {category.replace(/_/g, ' ')}
                </p>
                {qList.map((q, i) => (
                  <div key={i} style={{ marginBottom: 6, paddingLeft: 12 }}>
                    <p style={{ fontSize: 12.5, color: '#2C2A27', margin: 0, lineHeight: 1.5 }}>
                      {i + 1}. {q.question || q}
                    </p>
                    {q.rationale && (
                      <p style={{ fontSize: 11, color: '#9A8F80', margin: '1px 0 0', fontStyle: 'italic' }}>
                        {q.rationale}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '16px 24px', borderTop: '1px solid #EBE7E1',
        fontSize: 10.5, color: '#9A8F80', textAlign: 'center',
      }}>
        Generated by Samara ATS · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  )
})

export default CandidateBrief

// ── Helper Components ───────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return (
    <h3 style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.14em', color: '#9A8F80', margin: '0 0 10px',
      paddingBottom: 6, borderBottom: '1px solid #EBE7E1',
    }}>
      {children}
    </h3>
  )
}

function InfoCell({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: 10.5, color: '#9A8F80', margin: '0 0 2px', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: 13, color: '#2C2A27', margin: 0, fontWeight: 500 }}>{value}</p>
    </div>
  )
}

function ScoreBar({ label, value }) {
  if (value == null) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 10.5, color: '#9A8F80', minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#EBE7E1', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${value}%`, height: '100%', borderRadius: 3,
          background: value >= 70 ? '#4A7C74' : value >= 40 ? '#B8860B' : '#C0614A',
        }} />
      </div>
      <span style={{ fontSize: 11, color: '#2C2A27', fontWeight: 600, minWidth: 24, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function stageBadge(stage) {
  const colors = {
    New: { bg: 'rgba(154,143,128,0.1)', color: '#9A8F80' },
    Screening: { bg: 'rgba(74,124,116,0.1)', color: '#4A7C74' },
    'Interview Pending': { bg: 'rgba(184,134,11,0.08)', color: '#B8860B' },
    'Interview Scheduled': { bg: 'rgba(74,124,116,0.1)', color: '#4A7C74' },
    'Interview Completed': { bg: 'rgba(74,124,116,0.15)', color: '#4A7C74' },
    Offer: { bg: 'rgba(184,134,11,0.12)', color: '#8A6010' },
    Hired: { bg: 'rgba(74,124,116,0.15)', color: '#4A7C74' },
    Rejected: { bg: 'rgba(192,97,74,0.1)', color: '#C0614A' },
  }
  const c = colors[stage] || colors.New
  return {
    fontSize: 11, fontWeight: 600,
    padding: '3px 10px', borderRadius: 4,
    color: c.color, background: c.bg,
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const pageStyle = {
  maxWidth: 800,
  margin: '0 auto',
  background: 'white',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}

const sectionStyle = {
  padding: '20px 24px',
  borderBottom: '1px solid #EBE7E1',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '10px 20px',
}

const subLabelStyle = {
  fontSize: 10.5, fontWeight: 600, color: '#9A8F80',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  margin: '0 0 3px',
}

const skillTag = {
  fontSize: 11, color: '#4A7C74',
  background: 'rgba(74,124,116,0.08)',
  padding: '2px 8px', borderRadius: 3,
}
