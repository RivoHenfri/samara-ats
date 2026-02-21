import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  generateCompatibilityScore,
  getScoreColor, getScoreBg, getScoreLabel,
  getSeverityColor, getSeverityBg,
  PROMPT_VERSION, MODEL_VERSION,
} from '../lib/generateCompatibilityScore'
import {
  Zap, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, Loader2, ShieldAlert, Target, FileText,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ── ScoreBadge ─────────────────────────────────────────────────────────────────
// Exported for use in CandidatesList and CandidateCard.

export function ScoreBadge({ score, size = 'md' }) {
  const color = getScoreColor(score)
  const bg    = getScoreBg(score)
  const label = getScoreLabel(score)

  if (size === 'sm') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
        color, background: bg,
        borderRadius: 4, padding: '2px 6px',
        whiteSpace: 'nowrap',
      }}>
        {score != null ? score : '—'}
      </span>
    )
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11.5, fontWeight: 700,
      color, background: bg,
      borderRadius: 6, padding: '3px 9px',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{score != null ? score : '—'}</span>
      <span style={{ fontWeight: 600, opacity: 0.85 }}>{label}</span>
    </span>
  )
}

// ── ScoreBar ───────────────────────────────────────────────────────────────────

function ScoreBar({ label, score, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, color: 'var(--stone)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: color || getScoreColor(score) }}>
          {score != null ? score : '—'}
        </span>
      </div>
      <div style={{
        height: 6, borderRadius: 3,
        background: 'var(--sand-dark)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${score ?? 0}%`,
          background: color || getScoreColor(score),
          borderRadius: 3,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

// ── RiskFlagRow ────────────────────────────────────────────────────────────────

function RiskFlagRow({ item }) {
  const color = getSeverityColor(item.severity)
  const bg    = getSeverityBg(item.severity)
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '8px 10px',
      background: bg,
      border: `1px solid ${color}22`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 6, marginBottom: 6,
    }}>
      <AlertTriangle size={12} style={{ color, flexShrink: 0, marginTop: 1 }} />
      <div>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
          textTransform: 'uppercase', color,
        }}>
          {item.severity}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--stone)', marginLeft: 6 }}>
          {item.flag}
        </span>
        <p style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.5, marginTop: 2 }}>
          {item.detail}
        </p>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CompatibilityScore({ app, onScored }) {
  const { profile, isManager } = useAuth()

  const [versions,    setVersions]    = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [generating,  setGenerating]  = useState(false)
  const [error,       setError]       = useState(null)
  const [riskOpen,    setRiskOpen]    = useState(true)
  const [parsedCV,    setParsedCV]    = useState(null)

  useEffect(() => {
    fetchVersions()
    fetchParsedCV()
  }, [app.id])

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('application_scores')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setVersions(data || [])
    setSelectedIdx(0)
  }

  const fetchParsedCV = async () => {
    if (!app.candidates?.id) return
    const { data } = await supabase
      .from('cv_sources')
      .select('parsed_data')
      .eq('candidate_id', app.candidates.id)
      .eq('is_active', true)
      .maybeSingle()
    if (data?.parsed_data) setParsedCV(data.parsed_data)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const scoreData  = await generateCompatibilityScore(app, parsedCV)
      const genCount   = versions.length + 1
      const versionTag = `${PROMPT_VERSION} · gen ${genCount}`

      const { error: dbErr } = await supabase
        .from('application_scores')
        .insert({
          application_id:    app.id,
          overall_score:          scoreData.overall_score,
          must_have_score:        scoreData.must_have_score,
          nice_to_have_score:     scoreData.nice_to_have_score,
          salary_alignment_score: scoreData.salary_alignment_score,
          risk_flags:             scoreData.risk_flags       || [],
          executive_summary:      scoreData.executive_summary || '',
          interview_focus:        scoreData.interview_focus  || [],
          scored_by_name: profile?.full_name || 'HR',
          model_version:  MODEL_VERSION,
          prompt_version: versionTag,
        })

      if (dbErr) throw new Error(dbErr.message)
      await fetchVersions()
      if (onScored) onScored(scoreData.overall_score)
    } catch (err) {
      setError(err.message || 'Scoring failed. Check your API key and try again.')
    }
    setGenerating(false)
  }

  const current        = versions[selectedIdx]
  const score          = current?.overall_score ?? null
  const riskFlags      = current?.risk_flags     || []
  const interviewFocus = current?.interview_focus || []
  const hasHighRisk    = riskFlags.some(r => r.severity === 'high')
  const hasJobContext  = !!app.roles?.job_context?.trim()
  const hasCVData      = !!parsedCV

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (versions.length === 0) {
    return (
      <div style={{ padding: '28px 22px', textAlign: 'center' }}>

        {/* Hints */}
        {(!hasJobContext || !hasCVData) && (
          <div style={{
            background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.25)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16, textAlign: 'left',
          }}>
            {!hasJobContext && (
              <p style={{ fontSize: 11.5, color: '#8A6010', lineHeight: 1.6, marginBottom: !hasCVData ? 6 : 0 }}>
                <span style={{ fontWeight: 600 }}>Tip:</span> Add Job Context in the Roles page for
                precise must-have vs nice-to-have scoring.
              </p>
            )}
            {!hasCVData && (
              <p style={{ fontSize: 11.5, color: '#8A6010', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600 }}>Tip:</span> Upload and parse the candidate's CV
                for a richer skills-based evaluation.
              </p>
            )}
          </div>
        )}

        <div style={{
          width: 44, height: 44, background: 'var(--sand)',
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px', color: 'var(--stone)',
        }}>
          <Zap size={20} />
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
          No compatibility score yet
        </p>
        <p style={{ fontSize: 12, color: 'var(--stone)', marginBottom: 20, lineHeight: 1.6 }}>
          AI will compare the candidate profile against role requirements<br />
          and return a scored evaluation with risk flags and recruiter summary.
        </p>

        {error && (
          <div style={{
            background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
            borderRadius: 6, padding: '10px 14px', fontSize: 12.5,
            color: 'var(--alert)', marginBottom: 14, textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {isManager ? (
          <button onClick={handleGenerate} disabled={generating} className="btn btn-primary" style={{ margin: '0 auto' }}>
            {generating
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Scoring…</>
              : <><Zap size={13} /> Generate Score</>
            }
          </button>
        ) : (
          <p style={{ fontSize: 11.5, color: 'var(--stone-light)' }}>
            Manager or Admin access required to generate scores.
          </p>
        )}
      </div>
    )
  }

  // ── Score view ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 22px', borderBottom: '1px solid var(--sand-dark)',
        flexWrap: 'wrap',
      }}>
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          className="form-control"
          style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1, minWidth: 0 }}
        >
          {versions.map((v, i) => (
            <option key={v.id} value={i}>
              {i === 0 ? 'Latest · ' : ''}
              {v.prompt_version} · {format(new Date(v.created_at), 'dd MMM HH:mm')}
              {v.scored_by_name ? ` · ${v.scored_by_name}` : ''}
            </option>
          ))}
        </select>

        {isManager && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, fontSize: 11 }}
          >
            {generating
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Scoring…</>
              : <><RefreshCw size={12} /> Re-score</>
            }
          </button>
        )}
      </div>

      {/* Metadata strip */}
      <div style={{
        padding: '5px 22px', background: 'var(--sand-light)',
        borderBottom: '1px solid var(--sand-dark)',
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
      }}>
        {current?.model_version && (
          <span style={{ fontSize: 10.5, color: 'var(--stone)' }}>
            Model: <strong>{current.model_version}</strong>
          </span>
        )}
        <span style={{ fontSize: 10.5, color: 'var(--stone)' }}>
          Prompt: <strong>{current?.prompt_version}</strong>
        </span>
        <span style={{ fontSize: 10.5, color: 'var(--stone)' }}>
          {versions.length} evaluation{versions.length !== 1 ? 's' : ''} total
        </span>
        {!hasJobContext && (
          <span style={{ fontSize: 10.5, color: '#8A6010', fontStyle: 'italic' }}>
            No job context — add one in Roles for sharper scores
          </span>
        )}
        {!hasCVData && (
          <span style={{ fontSize: 10.5, color: '#8A6010', fontStyle: 'italic' }}>
            No parsed CV — upload one for skill-based scoring
          </span>
        )}
      </div>

      {error && (
        <div style={{
          margin: '12px 22px 0', background: 'var(--alert-bg)',
          border: '1px solid rgba(192,97,74,0.2)', borderRadius: 6,
          padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)',
        }}>
          {error}
        </div>
      )}

      <div style={{ padding: '18px 22px', overflowY: 'auto', maxHeight: '46vh' }}>

        {/* ── Overall score header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20,
          padding: '14px 16px',
          background: getScoreBg(score),
          border: `1px solid ${getScoreColor(score)}33`,
          borderRadius: 10,
        }}>
          {/* Circle badge */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: getScoreColor(score),
            color: '#fff',
            fontSize: 20, fontWeight: 800,
            boxShadow: `0 2px 8px ${getScoreColor(score)}44`,
          }}>
            {score ?? '—'}
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--charcoal)', lineHeight: 1.2 }}>
              {getScoreLabel(score)}
            </p>
            <p style={{ fontSize: 11, color: 'var(--stone)', marginTop: 3 }}>
              Overall compatibility · scored{' '}
              {formatDistanceToNow(new Date(current.created_at), { addSuffix: true })}
            </p>
            {hasHighRisk && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5,
                fontSize: 10.5, fontWeight: 700, color: 'var(--alert)',
                background: 'var(--alert-bg)', borderRadius: 4, padding: '2px 7px',
              }}>
                <ShieldAlert size={10} />
                {riskFlags.filter(r => r.severity === 'high').length} HIGH risk flag{riskFlags.filter(r => r.severity === 'high').length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* ── Score breakdown ── */}
        <div style={{
          padding: '14px 16px',
          background: 'var(--sand-light)',
          border: '1px solid var(--sand-dark)',
          borderRadius: 8, marginBottom: 16,
        }}>
          <p style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 12,
          }}>
            Score Breakdown
          </p>
          <ScoreBar label="Must-Have Match"    score={current?.must_have_score} />
          <ScoreBar label="Nice-to-Have Match" score={current?.nice_to_have_score} />
          <ScoreBar label="Salary Alignment"   score={current?.salary_alignment_score} />
          <p style={{ fontSize: 10, color: 'var(--stone-light)', marginTop: 8 }}>
            Weighted: must-have × 0.55 + nice-to-have × 0.25 + salary × 0.20
          </p>
        </div>

        {/* ── Risk flags ── */}
        {riskFlags.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setRiskOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '0 0 8px', marginBottom: 2,
              }}
            >
              <span style={{
                fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: hasHighRisk ? 'var(--alert)' : 'var(--stone)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <AlertTriangle size={11} />
                {riskFlags.length} Risk Flag{riskFlags.length !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 10, color: 'var(--stone-light)', flex: 1, textAlign: 'left' }}>
                {riskFlags.filter(r => r.severity === 'high').length > 0 &&
                  `${riskFlags.filter(r => r.severity === 'high').length} high`}
                {riskFlags.filter(r => r.severity === 'medium').length > 0 &&
                  ` · ${riskFlags.filter(r => r.severity === 'medium').length} medium`}
              </span>
              {riskOpen
                ? <ChevronUp size={13} style={{ color: 'var(--stone)', flexShrink: 0 }} />
                : <ChevronDown size={13} style={{ color: 'var(--stone)', flexShrink: 0 }} />
              }
            </button>
            {riskOpen && riskFlags.map((flag, i) => (
              <RiskFlagRow key={i} item={flag} />
            ))}
          </div>
        )}

        {riskFlags.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', marginBottom: 16,
            background: 'var(--teal-bg)', border: '1px solid rgba(74,124,116,0.2)',
            borderRadius: 6,
          }}>
            <span style={{ fontSize: 11.5, color: 'var(--teal)', fontWeight: 500 }}>
              No risk flags detected
            </span>
          </div>
        )}

        {/* ── Executive summary ── */}
        {current?.executive_summary && (
          <div style={{ marginBottom: 16 }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <FileText size={10} /> Executive Summary
            </p>
            <div style={{
              padding: '12px 14px',
              background: 'var(--sand-light)',
              border: '1px solid var(--sand-dark)',
              borderLeft: '3px solid var(--gold)',
              borderRadius: 8,
            }}>
              <p style={{ fontSize: 12.5, color: 'var(--charcoal)', lineHeight: 1.65 }}>
                {current.executive_summary}
              </p>
            </div>
          </div>
        )}

        {/* ── Interview focus ── */}
        {interviewFocus.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <p style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--stone)', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Target size={10} /> Interview Focus
            </p>
            <div style={{
              padding: '10px 14px',
              background: 'var(--sand-light)',
              border: '1px solid var(--sand-dark)',
              borderLeft: '3px solid var(--teal)',
              borderRadius: 8,
            }}>
              {interviewFocus.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  paddingBottom: i < interviewFocus.length - 1 ? 7 : 0,
                  marginBottom: i < interviewFocus.length - 1 ? 7 : 0,
                  borderBottom: i < interviewFocus.length - 1 ? '1px solid var(--sand-dark)' : 'none',
                }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--teal-bg)', color: 'var(--teal)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.55 }}>
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
