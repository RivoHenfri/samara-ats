import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { generateScreeningQuestions, getApplicationRisks, PROMPT_VERSION } from '../lib/generateScreeningQuestions'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Loader2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'technical',   label: 'Technical',   color: 'var(--teal)',  bg: 'var(--teal-bg)'  },
  { key: 'behavioral',  label: 'Behavioral',  color: 'var(--gold)',  bg: 'var(--gold-bg)'  },
  { key: 'situational', label: 'Situational', color: 'var(--stone)', bg: 'var(--sand)'     },
]

// ── QuestionCard ───────────────────────────────────────────────────────────────

function QuestionCard({ item, index, catColor }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: 'var(--sand-light)',
      border: '1px solid var(--sand-dark)',
      borderLeft: `3px solid ${catColor}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      {/* Question */}
      <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)', lineHeight: 1.55, marginBottom: 6 }}>
        {index + 1}. {item.question}
      </p>

      {/* Rationale toggle */}
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
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
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
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, color: 'var(--stone)', background: 'none',
          border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        {open ? 'Hide follow-up' : 'Show follow-up'}
      </button>
      {open && (
        <p style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.55, marginTop: 8,
          paddingTop: 8, borderTop: '1px solid rgba(192,97,74,0.15)', fontStyle: 'italic' }}>
          <span style={{ fontWeight: 600, fontStyle: 'normal' }}>Follow-up: </span>
          {item.follow_up}
        </p>
      )}
    </div>
  )
}

// ── CategorySection ────────────────────────────────────────────────────────────

function CategorySection({ category, questions }) {
  if (!questions?.length) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: category.color,
          background: category.bg, borderRadius: 4,
          padding: '2px 8px',
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

  useEffect(() => {
    fetchVersions()
  }, [app.id])

  const fetchVersions = async () => {
    const { data } = await supabase
      .from('screening_questions')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setVersions(data || [])
    setSelectedIdx(0)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const questions = await generateScreeningQuestions(app)
      const risks     = getApplicationRisks(app)
      const versionTag = `${PROMPT_VERSION} · gen ${versions.length + 1}`

      const { error: dbErr } = await supabase
        .from('screening_questions')
        .insert({
          application_id:    app.id,
          questions,
          risk_areas:        risks.map(r => ({ label: r })),
          prompt_version:    versionTag,
          generated_by_name: profile?.full_name || 'HR',
        })

      if (dbErr) throw new Error(dbErr.message)
      await fetchVersions()
    } catch (err) {
      setError(err.message || 'Generation failed. Check your API key and try again.')
    }
    setGenerating(false)
  }

  const current   = versions[selectedIdx]
  const questions = current?.questions || null
  const risks     = getApplicationRisks(app)

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (versions.length === 0) {
    return (
      <div style={{ padding: '28px 22px', textAlign: 'center' }}>

        {/* Risk preview */}
        {risks.length > 0 && (
          <div style={{
            background: 'var(--alert-bg)',
            border: '1px solid rgba(192,97,74,0.2)',
            borderRadius: 8, padding: '10px 14px',
            marginBottom: 20, textAlign: 'left',
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--alert)',
              letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> {risks.length} Risk Area{risks.length > 1 ? 's' : ''} Detected
            </p>
            {risks.map((r, i) => (
              <p key={i} style={{ fontSize: 11.5, color: 'var(--charcoal)', lineHeight: 1.55,
                paddingLeft: 8, borderLeft: '2px solid rgba(192,97,74,0.3)', marginBottom: i < risks.length - 1 ? 4 : 0 }}>
                {r}
              </p>
            ))}
          </div>
        )}

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
          AI will analyse the role and candidate profile to generate<br />
          tailored technical, behavioral, and situational questions.
        </p>

        {error && (
          <div style={{ background: 'var(--alert-bg)', border: '1px solid rgba(192,97,74,0.2)',
            borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)',
            marginBottom: 14, textAlign: 'left' }}>
            {error}
          </div>
        )}

        {isManager ? (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-primary"
            style={{ margin: '0 auto' }}
          >
            {generating ? (
              <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : (
              <><Sparkles size={13} /> Generate Questions</>
            )}
          </button>
        ) : (
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
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 22px', borderBottom: '1px solid var(--sand-dark)',
        flexWrap: 'wrap',
      }}>
        {/* Version selector */}
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(Number(e.target.value))}
          className="form-control"
          style={{ fontSize: 11.5, padding: '4px 8px', height: 28, flex: 1, minWidth: 0 }}
        >
          {versions.map((v, i) => (
            <option key={v.id} value={i}>
              {i === 0 ? 'Latest · ' : ''}{v.prompt_version} · {format(new Date(v.created_at), 'dd MMM yyyy HH:mm')}
              {v.generated_by_name ? ` · ${v.generated_by_name}` : ''}
            </option>
          ))}
        </select>

        {/* Regenerate */}
        {isManager && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0, fontSize: 11.5 }}
            title="Generate a new version of questions"
          >
            {generating ? (
              <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : (
              <><RefreshCw size={12} /> Regenerate</>
            )}
          </button>
        )}
      </div>

      {error && (
        <div style={{ margin: '12px 22px 0', background: 'var(--alert-bg)',
          border: '1px solid rgba(192,97,74,0.2)', borderRadius: 6,
          padding: '10px 14px', fontSize: 12.5, color: 'var(--alert)' }}>
          {error}
        </div>
      )}

      {/* Risk badges */}
      {questions?.risk_probes?.length > 0 && (
        <div style={{ padding: '10px 22px 0', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {questions.risk_probes.map((rp, i) => (
            <span key={i} style={{
              fontSize: 10.5, fontWeight: 600, color: 'var(--alert)',
              background: 'var(--alert-bg)', borderRadius: 4,
              padding: '2px 8px',
              display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <AlertTriangle size={9} /> {rp.risk}
            </span>
          ))}
        </div>
      )}

      {/* Question sections */}
      <div style={{ padding: '16px 22px', overflowY: 'auto', maxHeight: '42vh' }}>
        {CATEGORIES.map(cat => (
          <CategorySection
            key={cat.key}
            category={cat}
            questions={questions?.[cat.key]}
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
                {questions.risk_probes.length} flagged area{questions.risk_probes.length !== 1 ? 's' : ''}
              </span>
            </div>
            {questions.risk_probes.map((item, i) => (
              <RiskProbeCard key={i} item={item} index={i} />
            ))}
          </div>
        )}

        <p style={{ fontSize: 10.5, color: 'var(--stone-light)', textAlign: 'center', paddingBottom: 4 }}>
          Generated {formatDistanceToNow(new Date(current.created_at), { addSuffix: true })} by {current.generated_by_name || 'HR'} · {current.prompt_version}
        </p>
      </div>
    </div>
  )
}
