import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { generateScreeningQuestions, getApplicationRisks, PROMPT_VERSION, MODEL_VERSION } from '../lib/generateScreeningQuestions'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Loader2, GitCompare, Check, X } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'technical',   label: 'Technical',    color: 'var(--teal)',  bg: 'var(--teal-bg)'  },
  { key: 'behavioral',  label: 'Behavioral',   color: 'var(--gold)',  bg: 'var(--gold-bg)'  },
  { key: 'gap_probes',  label: 'Gap Probes',   color: 'var(--stone)', bg: 'var(--sand)'     },
]

// ── Weight badge ───────────────────────────────────────────────────────────────

const weightStyle = {
  High:   { color: '#4A7C74', background: 'rgba(74,124,116,0.12)' },
  Medium: { color: '#8A6010', background: 'rgba(184,150,90,0.12)' },
  Low:    { color: '#9A8F80', background: 'rgba(154,143,128,0.12)' },
}

// ── QuestionCard ───────────────────────────────────────────────────────────────

function QuestionCard({ item, index, catColor, compareItem }) {
  const [open, setOpen] = useState(false)
  const isCompare = compareItem !== undefined

  return (
    <div style={{
      background: isCompare ? 'var(--sand)' : 'var(--sand-light)',
      border: `1px solid ${isCompare ? 'var(--sand-dark)' : 'var(--sand-dark)'}`,
      borderLeft: `3px solid ${catColor}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
      opacity: isCompare ? 0.75 : 1,
    }}>
      {isCompare && (
        <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--stone)', letterSpacing: '0.1em',
          textTransform: 'uppercase', marginBottom: 5 }}>Previous version</p>
      )}
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', lineHeight: 1.55, marginBottom: 4 }}>
        {index + 1}. {item.question}
      </p>
      {item.maps_to && (
        <p style={{ fontSize: 10.5, color: 'var(--stone)', marginBottom: 5, fontStyle: 'italic' }}>
          Tests: {item.maps_to}
        </p>
      )}
      {item.gap && (
        <p style={{ fontSize: 10.5, color: 'var(--stone)', marginBottom: 5, fontStyle: 'italic' }}>
          Gap: {item.gap}
        </p>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--stone)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {open ? 'Hide rationale' : 'Why this question'}
      </button>

      {open && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--sand-dark)' }}>
          <p style={{ fontSize: 11.5, color: 'var(--stone)', lineHeight: 1.55, marginBottom: 6 }}>
            <span style={{ fontWeight: 600 }}>Rationale: </span>{item.rationale}
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 600 }}>Follow-up: </span>
            <span style={{ fontStyle: 'italic' }}>{item.follow_up}</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── RiskProbeCard ──────────────────────────────────────────────────────────────

function RiskProbeCard({ item, index }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: 'var(--alert-bg)',
      border: '1px solid rgba(192,97,74,0.2)',
      borderLeft: '3px solid var(--alert)',
      borderRadius: 8, padding: '12px 14px', marginBottom: 8,
    }}>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--alert)', letterSpacing: '0.1em',
        textTransform: 'uppercase', marginBottom: 5 }}>
        Risk: {item.risk}
      </p>
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', lineHeight: 1.55, marginBottom: 6 }}>
        {index + 1}. {item.question}
      </p>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
          color: 'var(--stone)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {open ? 'Hide follow-up' : 'Show follow-up'}
      </button>
      {open && (
        <p style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.55, marginTop: 8,
          paddingTop: 8, borderTop: '1px solid rgba(192,97,74,0.15)', fontStyle: 'italic' }}>
          <span style={{ fontWeight: 600, fontStyle: 'normal' }}>Follow-up: </span>{item.follow_up}
        </p>
      )}
    </div>
  )
}

// ── ScorecardCard ──────────────────────────────────────────────────────────────

function ScorecardCard({ item }) {
  const ws = weightStyle[item.weight] || weightStyle.Low
  return (
    <div style={{
      background: 'var(--sand-light)',
      border: '1px solid var(--sand-dark)',
      borderRadius: 8, padding: '12px 14px', marginBottom: 8,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', flex: 1 }}>
          {item.criterion}
        </p>
        <span style={{ ...ws, fontSize: 10, fontWeight: 700, borderRadius: 4,
          padding: '2px 7px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {item.weight}
        </span>
        {item.must_have && (
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--alert)',
            background: 'var(--alert-bg)', borderRadius: 4, padding: '2px 7px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', gap: 3 }}>
            <Check size={9} /> Must-Have
          </span>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--stone)', lineHeight: 1.6 }}>
        <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>Look for: </span>
        {item.what_to_look_for}
      </p>
    </div>
  )
}

// ── CategorySection ────────────────────────────────────────────────────────────

function CategorySection({ category, questions, compareQuestions }) {
  if (!questions?.length) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: category.color,
          background: category.bg, borderRadius: 4, padding: '2px 8px',
        }}>
          {category.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--stone-light)' }}>
          {questions.length} question{questions.length !== 1 ? 's' : ''}
        </span>
      </div>
      {questions.map((item, i) => (
        <QuestionCard key={i} item={item} index={i} catColor={category.color} />
      ))}
      {/* Compare version questions (dimmed, below) */}
      {compareQuestions?.length > 0 && (
        <div style={{ marginTop: 4 }}>
          {compareQuestions.map((item, i) => (
            <QuestionCard key={`cmp-${i}`} item={item} index={i} catColor={category.color} compareItem />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ScreeningQuestions({ app }) {
  const { profile, isManager } = useAuth()

  const [versions,    setVersions]    = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [generating,  setGenerating]  = useState(false)
  const [error,       setError]       = useState(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIdx,  setCompareIdx]  = useState(1)
  const [activeSection, setActiveSection] = useState('questions') // 'questions' | 'scorecard'

  useEffect(() => { fetchVersions() }, [app.id])

  // ── Real-time: auto-refresh when system inserts questions in background ───────
  useEffect(() => {
    const channel = supabase
      .channel(`questions-auto-${app.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'screening_questions', filter: `application_id=eq.${app.id}` },
        () => { fetchVersions() }
      )
      .subscribe()
    return () => { channel.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.id])

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('screening_questions')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setVersions(data || [])
    setSelectedIdx(0)
    setCompareMode(false)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const questions      = await generateScreeningQuestions(app)
      const risks          = getApplicationRisks(app)
      const genCount       = versions.length + 1
      const versionTag     = `${PROMPT_VERSION} · gen ${genCount}`
      const hasJobContext  = !!app.roles?.job_context?.trim()

      const { error: dbErr } = await supabase
        .from('screening_questions')
        .insert({
          application_id:    app.id,
          questions,
          risk_areas:        risks.map(r => ({ label: r })),
          prompt_version:    versionTag,
          model_version:     MODEL_VERSION,
          generated_by_name: profile?.full_name || 'HR',
        })

      if (dbErr) throw new Error(dbErr.message)
      await fetchVersions()
    } catch (err) {
      setError(err.message || 'Generation failed. Check your API key and try again.')
    }
    setGenerating(false)
  }

  const current        = versions[selectedIdx]
  const compareVersion = compareMode ? versions[compareIdx] : null
  const questions      = current?.questions || null
  const compareQs      = compareVersion?.questions || null
  const risks          = getApplicationRisks(app)
  const hasJobContext   = !!app.roles?.job_context?.trim()
  const scorecard      = questions?.scorecard || []
  const mustHaveCount  = scorecard.filter(s => s.must_have).length

  // When in Interview with no questions, auto-generation is running in background
  const autoGenInProgress = versions.length === 0 && app.stage === 'Interview'

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (versions.length === 0) {
    return (
      <div style={{ padding: '28px 22px', textAlign: 'center' }}>

        {/* Auto-generating banner (Interview stage) */}
        {autoGenInProgress && (
          <div style={{
            background: 'rgba(74,124,116,0.08)', border: '1px solid rgba(74,124,116,0.25)',
            borderRadius: 8, padding: '12px 14px', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
          }}>
            <Loader2 size={16} style={{ color: 'var(--teal)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--teal)', marginBottom: 2 }}>
                AI is generating questions automatically
              </p>
              <p style={{ fontSize: 11.5, color: 'var(--stone)', lineHeight: 1.5 }}>
                Triggered by Interview stage entry — this page will update when ready.
              </p>
            </div>
          </div>
        )}

        {/* Job context hint (only when not auto-generating) */}
        {!autoGenInProgress && !hasJobContext && (
          <div style={{
            background: 'rgba(184,150,90,0.08)', border: '1px solid rgba(184,150,90,0.25)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16, textAlign: 'left',
          }}>
            <p style={{ fontSize: 11.5, color: '#8A6010', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600 }}>Tip:</span> Add a Job Context in the Roles page
              to get highly targeted, role-specific questions instead of generic ones.
            </p>
          </div>
        )}

        {/* Risk preview */}
        {risks.length > 0 && (
          <div style={{
            background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 20, textAlign: 'left',
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--alert)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> {risks.length} Risk Area{risks.length > 1 ? 's' : ''} Detected
            </p>
            {risks.map((r, i) => (
              <p key={i} style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.55,
                paddingLeft: 8, borderLeft: '2px solid rgba(192,97,74,0.3)',
                marginBottom: i < risks.length - 1 ? 4 : 0 }}>
                {r}
              </p>
            ))}
          </div>
        )}

        {!autoGenInProgress && (
          <>
            <div style={{
              width: 44, height: 44, background: 'var(--sand)',
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', color: 'var(--stone)',
            }}>
              <Sparkles size={20} />
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              No questions generated yet
            </p>
            <p style={{ fontSize: 12, color: 'var(--stone)', marginBottom: 20, lineHeight: 1.6 }}>
              Move the candidate to <strong>Interview</strong> to trigger automatic question generation,<br />
              or generate manually below.
            </p>
          </>
        )}

        {error && (
          <div style={{ background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
            borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)',
            marginBottom: 14, textAlign: 'left' }}>
            {error}
          </div>
        )}

        {isManager && (
          <button onClick={handleGenerate} disabled={generating} className="btn btn-ghost btn-sm" style={{ margin: '0 auto' }}>
            {generating
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><Sparkles size={13} /> {autoGenInProgress ? 'Generate Now Instead' : 'Generate Questions'}</>
            }
          </button>
        )}
        {!isManager && !autoGenInProgress && (
          <p style={{ fontSize: 11.5, color: 'var(--stone-light)' }}>
            Manager or Admin access required to generate questions.
          </p>
        )}
      </div>
    )
  }

  // ── Questions view ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Controls bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '10px 22px', borderBottom: '1px solid var(--sand-dark)',
        flexWrap: 'wrap',
      }}>
        {/* Version selector */}
        <select
          value={selectedIdx}
          onChange={e => { setSelectedIdx(Number(e.target.value)); setCompareMode(false) }}
          className="form-control"
          style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1, minWidth: 0 }}
        >
          {versions.map((v, i) => (
            <option key={v.id} value={i}>
              {i === 0 ? 'Latest · ' : ''}{v.prompt_version} · {format(new Date(v.created_at), 'dd MMM HH:mm')}
              {v.generated_by_name ? ` · ${v.generated_by_name}` : ''}
            </option>
          ))}
        </select>

        {/* Compare toggle (only when 2+ versions) */}
        {versions.length >= 2 && !compareMode && (
          <button
            onClick={() => { setCompareMode(true); setCompareIdx(selectedIdx === 0 ? 1 : 0) }}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, fontSize: 11 }}
            title="Compare with another version"
          >
            <GitCompare size={12} /> Compare
          </button>
        )}
        {compareMode && (
          <button
            onClick={() => setCompareMode(false)}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, fontSize: 11, color: 'var(--teal)' }}
          >
            <X size={12} /> Exit Compare
          </button>
        )}

        {/* Regenerate */}
        {isManager && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, fontSize: 11 }}
          >
            {generating
              ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><RefreshCw size={12} /> Regenerate</>
            }
          </button>
        )}
      </div>

      {/* Compare version selector */}
      {compareMode && (
        <div style={{
          padding: '8px 22px', borderBottom: '1px solid var(--sand-dark)',
          background: 'rgba(74,124,116,0.05)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--stone)', flexShrink: 0 }}>Compare with:</span>
          <select
            value={compareIdx}
            onChange={e => setCompareIdx(Number(e.target.value))}
            className="form-control"
            style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1 }}
          >
            {versions.map((v, i) => i !== selectedIdx && (
              <option key={v.id} value={i}>
                {v.prompt_version} · {format(new Date(v.created_at), 'dd MMM HH:mm')}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 10.5, color: 'var(--stone-light)', flexShrink: 0 }}>
            (dimmed below each category)
          </span>
        </div>
      )}

      {/* Metadata strip */}
      <div style={{
        padding: '6px 22px', background: 'var(--sand-light)',
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
          {versions.length} generation{versions.length !== 1 ? 's' : ''} total
        </span>
        {!hasJobContext && (
          <span style={{ fontSize: 10.5, color: '#8A6010', fontStyle: 'italic' }}>
            No job context — add one in Roles for better questions
          </span>
        )}
      </div>

      {error && (
        <div style={{ margin: '12px 22px 0', background: 'var(--alert-bg)',
          border: '1px solid rgba(192,97,74,0.2)', borderRadius: 6,
          padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)' }}>
          {error}
        </div>
      )}

      {/* Section tabs: Questions | Scorecard */}
      <div style={{ display: 'flex', padding: '0 22px', borderBottom: '1px solid var(--sand-dark)' }}>
        {[
          { key: 'questions', label: 'Questions' },
          { key: 'scorecard', label: `Scorecard${mustHaveCount > 0 ? ` (${mustHaveCount} must-have)` : ''}` },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            style={{
              padding: '8px 12px', fontSize: 11, background: 'none', border: 'none',
              fontWeight: activeSection === s.key ? 600 : 400,
              color: activeSection === s.key ? 'var(--teal)' : 'var(--stone)',
              borderBottom: activeSection === s.key ? '2px solid var(--teal)' : '2px solid transparent',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Risk badges */}
      {activeSection === 'questions' && questions?.risk_probes?.length > 0 && (
        <div style={{ padding: '8px 22px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {questions.risk_probes.map((rp, i) => (
            <span key={i} style={{
              fontSize: 10.5, fontWeight: 600, color: 'var(--alert)',
              background: 'var(--alert-bg)', borderRadius: 4, padding: '2px 8px',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <AlertTriangle size={9} /> {rp.risk}
            </span>
          ))}
        </div>
      )}

      {/* Questions section */}
      {activeSection === 'questions' && (
        <div style={{ padding: '16px 22px', overflowY: 'auto', maxHeight: '40vh' }}>
          {CATEGORIES.map(cat => (
            <CategorySection
              key={cat.key}
              category={cat}
              questions={questions?.[cat.key]}
              compareQuestions={compareMode ? compareQs?.[cat.key] : undefined}
            />
          ))}

          {/* Risk probes */}
          {questions?.risk_probes?.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--alert)',
                  background: 'var(--alert-bg)', borderRadius: 4, padding: '2px 8px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <AlertTriangle size={9} /> Risk Probes
                </span>
                <span style={{ fontSize: 11, color: 'var(--stone-light)' }}>
                  {questions.risk_probes.length} flagged
                </span>
              </div>
              {questions.risk_probes.map((item, i) => (
                <RiskProbeCard key={i} item={item} index={i} />
              ))}
              {/* Compare risk probes */}
              {compareMode && compareQs?.risk_probes?.length > 0 && (
                <>
                  <p style={{ fontSize: 10.5, color: 'var(--stone)', margin: '8px 0 6px', fontStyle: 'italic' }}>
                    Previous version:
                  </p>
                  {compareQs.risk_probes.map((item, i) => (
                    <div key={`cmp-risk-${i}`} style={{ opacity: 0.65 }}>
                      <RiskProbeCard item={item} index={i} />
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          <p style={{ fontSize: 10.5, color: 'var(--stone-light)', textAlign: 'center', paddingBottom: 4 }}>
            Generated {formatDistanceToNow(new Date(current.created_at), { addSuffix: true })} · {current.generated_by_name || 'HR'}
          </p>
        </div>
      )}

      {/* Scorecard section */}
      {activeSection === 'scorecard' && (
        <div style={{ padding: '16px 22px', overflowY: 'auto', maxHeight: '40vh' }}>
          {scorecard.length === 0 ? (
            <p style={{ color: 'var(--stone-light)', fontSize: 12.5, textAlign: 'center', padding: '20px 0' }}>
              No scorecard in this version. Regenerate to get one.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: 'var(--charcoal)' }}>
                  {scorecard.length} Criteria
                </span>
                {mustHaveCount > 0 && (
                  <span style={{ fontSize: 10.5, color: 'var(--alert)', fontWeight: 600 }}>
                    · {mustHaveCount} must-have
                  </span>
                )}
                <span style={{ fontSize: 10.5, color: 'var(--stone-light)' }}>
                  · {scorecard.length - mustHaveCount} nice-to-have
                </span>
              </div>
              {/* Must-haves first */}
              {scorecard.filter(s => s.must_have).map((item, i) => (
                <ScorecardCard key={`mh-${i}`} item={item} />
              ))}
              {scorecard.filter(s => !s.must_have).length > 0 && (
                <>
                  <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--stone-light)', letterSpacing: '0.1em',
                    textTransform: 'uppercase', margin: '12px 0 8px' }}>
                    Nice-to-Have
                  </p>
                  {scorecard.filter(s => !s.must_have).map((item, i) => (
                    <ScorecardCard key={`nth-${i}`} item={item} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
