import { useState, useEffect } from 'react'
import { Clock, MessageCircle, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CandidateDetail from './CandidateDetail'
import { ScoreBadge } from './CompatibilityScore'

// ── WhatsApp message templates (unchanged) ────────────────────
export function getWhatsAppMessage(candidate, role, stage, lang) {
  const name = candidate?.full_name?.split(' ')[0] || 'there'
  const roleTitle = role?.title || 'the position'

  const templates = {
    New: {
      en: `Hi ${name}, this is Satya from Samara Lombok. We received your application for ${roleTitle} and would love to learn more about you. Are you available for a quick chat?`,
      id: `Halo ${name}, perkenalkan saya Satya dari Samara Lombok. Kami menerima lamaran Anda untuk posisi ${roleTitle} dan ingin mengenal Anda lebih lanjut. Apakah Anda ada waktu untuk ngobrol sebentar?`,
    },
    Screening: {
      en: `Hi ${name}, this is Satya from Samara Lombok. We'd like to schedule a screening call for the ${roleTitle} role. When are you available this week?`,
      id: `Halo ${name}, ini Satya dari Samara Lombok. Kami ingin menjadwalkan sesi screening untuk posisi ${roleTitle}. Kapan Anda tersedia minggu ini?`,
    },
    Interview: {
      en: `Hi ${name}, this is Satya from Samara Lombok. Great news — we'd like to invite you for an interview for the ${roleTitle} position. Please let us know your availability.`,
      id: `Halo ${name}, ini Satya dari Samara Lombok. Kabar baik — kami ingin mengundang Anda untuk interview posisi ${roleTitle}. Mohon informasikan ketersediaan waktu Anda.`,
    },
    Offer: {
      en: `Hi ${name}, this is Satya from Samara Lombok. We're excited to move forward with you for the ${roleTitle} role. Can we schedule a call to discuss the offer details?`,
      id: `Halo ${name}, ini Satya dari Samara Lombok. Kami senang ingin melanjutkan proses dengan Anda untuk posisi ${roleTitle}. Bisakah kita jadwalkan panggilan untuk membahas detail penawaran?`,
    },
    Hired: {
      en: `Hi ${name}, congratulations and welcome to Samara Lombok! We're thrilled to have you joining us as ${roleTitle}. We'll be in touch soon with your onboarding details.`,
      id: `Halo ${name}, selamat dan selamat datang di Samara Lombok! Kami sangat senang Anda bergabung sebagai ${roleTitle}. Kami akan segera menghubungi Anda dengan detail onboarding.`,
    },
    Rejected: {
      en: `Hi ${name}, this is Satya from Samara Lombok. Thank you for your interest in the ${roleTitle} role. After careful consideration, we'll be moving forward with other candidates. We wish you all the best!`,
      id: `Halo ${name}, ini Satya dari Samara Lombok. Terima kasih atas minat Anda pada posisi ${roleTitle}. Setelah pertimbangan matang, kami akan melanjutkan dengan kandidat lain. Semoga sukses selalu!`,
    },
  }

  const template = templates[stage] || templates.New
  return lang === 'id' ? template.id : template.en
}

// ── WhatsApp button ───────────────────────────────────────────
function WhatsAppButton({ candidate, role, stage }) {
  const [lang, setLang] = useState('id')

  const handleClick = (e) => {
    e.stopPropagation()
    const raw = candidate?.whatsapp || ''
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)
    const message = getWhatsAppMessage(candidate, role, stage, lang)
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    setLang(lang === 'id' ? 'en' : 'id')
  }

  if (!candidate?.whatsapp) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <button onClick={handleToggle} className="lang-toggle">
        {lang === 'id' ? 'ID' : 'EN'}
      </button>
      <button
        onClick={handleClick}
        className="wa-btn"
        title={`WhatsApp (${lang === 'id' ? 'Bahasa' : 'English'}) — ${stage}`}
      >
        <MessageCircle size={12} />
      </button>
    </div>
  )
}

// ── Stale check ───────────────────────────────────────────────
function isStagnant(app) {
  if (!app?.updated_at) return false
  const hrs = (Date.now() - new Date(app.updated_at)) / (1000 * 60 * 60)
  return hrs > 48
}

// ── Division tag class ────────────────────────────────────────
function deptTag(dept) {
  if (!dept) return 'tag-src'
  const d = dept.toLowerCase()
  if (d === 'hospitality') return 'tag-hosp'
  if (d === 'operations') return 'tag-ops'
  if (d === 'construction') return 'tag-const'
  return 'tag-src'
}

// ── CANDIDATE CARD ────────────────────────────────────────────
export default function CandidateCard({ app, onDragStart, selected, onSelect }) {
  if (!app) return null

  const navigate = useNavigate()
  const [showDetail, setShowDetail] = useState(false)
  const [noteCount, setNoteCount] = useState(0)
  const [score, setScore] = useState(undefined) // undefined = not fetched yet, null = no score
  const stale = isStagnant(app)
  const isLombok = app.candidates?.origin === 'Lombok Local'

  useEffect(() => { fetchNoteCount(); fetchScore() }, [app.id])

  const fetchNoteCount = async () => {
    try {
      const { count } = await supabase
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('application_id', app.id)
      setNoteCount(count || 0)
    } catch { /* non-fatal */ }
  }

  const fetchScore = async () => {
    try {
      const { data } = await supabase
        .from('application_scores')
        .select('overall_score, created_at')
        .eq('application_id', app.id)
        .order('created_at', { ascending: false })
        .limit(1)
      setScore(data?.[0]?.overall_score ?? null)
    } catch { /* non-fatal */ }
  }

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(app)}
        onClick={(e) => onSelect && onSelect(app, e.nativeEvent)}
        className={`k-card${stale ? ' stale' : ''}`}
        style={{
          cursor: onSelect ? 'pointer' : 'grab',
          ...(selected ? { outline: '2px solid var(--teal)' } : {})
        }}
      >
        {/* Stale / Lombok badge */}
        {stale
          ? <span className="k-stale-badge">48h</span>
          : isLombok
            ? <span className="k-lombok-badge">🌴</span>
            : null
        }

        {/* Name */}
        <p
          className="k-card-name"
          onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}
        >
          {app.candidates?.full_name}
        </p>

        {/* Role */}
        <p className="k-card-role">{app.roles?.title}</p>

        {/* Footer row */}
        <div className="k-card-foot">
          {/* Origin tag */}
          <span className={`tag ${isLombok ? 'tag-lombok' : 'tag-src'}`}>
            {isLombok ? '🌴 Local' : '📍 Outside'}
          </span>

          {/* Department */}
          {app.roles?.department && (
            <span className={`tag ${deptTag(app.roles.department)}`}>
              {app.roles.department}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Suitability score from form */}
            {app.candidates?.suitability_score != null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '1px 5px', borderRadius: 8,
                fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                background: app.candidates.suitability_score >= 20 ? 'rgba(74,124,116,0.12)'
                  : app.candidates.suitability_score >= 10 ? 'rgba(184,150,90,0.12)' : 'rgba(154,143,128,0.12)',
                color: app.candidates.suitability_score >= 20 ? 'var(--teal)'
                  : app.candidates.suitability_score >= 10 ? 'var(--gold)' : 'var(--stone)',
              }}>
                FORM: {app.candidates.suitability_score}
              </span>
            )}

            {/* AI Score badge */}
            {score != null && score !== undefined && (
              <ScoreBadge score={score} size="sm" />
            )}

            {/* Note count */}
            {noteCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  color: 'var(--stone)', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 10,
                  transition: 'color 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.color = 'var(--charcoal)'}
                onMouseOut={e => e.currentTarget.style.color = 'var(--stone)'}
              >
                <FileText size={10} />
                {noteCount}
              </button>
            )}

            {/* View Brief */}
            <button
              onClick={(e) => { e.stopPropagation(); navigate(`/candidates/${app.id}/brief`) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                color: 'var(--stone)', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 10,
                transition: 'color 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--teal)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--stone)'}
              title="View Brief"
            >
              <FileText size={12} />
            </button>

            {/* Time indicator */}
            {stale ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--alert)', fontSize: 10, fontWeight: 600 }}>
                <Clock size={10} />
                {formatDistanceToNow(new Date(app.updated_at), { addSuffix: true })}
              </span>
            ) : (
              <WhatsAppButton candidate={app.candidates} role={app.roles} stage={app.stage} />
            )}
          </div>
        </div>
      </div>

      {showDetail && (
        <CandidateDetail
          app={app}
          onClose={() => { setShowDetail(false); fetchNoteCount() }}
        />
      )}
    </>
  )
}
