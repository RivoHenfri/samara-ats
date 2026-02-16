import { useState, useEffect } from 'react'
import { Clock, MessageCircle, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../lib/supabase'
import CandidateDetail from './CandidateDetail'

function getWhatsAppMessage(candidate, role, stage, lang) {
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

function WhatsAppButton({ candidate, role, stage }) {
  const [lang, setLang] = useState('id')

  const handleClick = (e) => {
    e.stopPropagation()
    const raw = candidate?.whatsapp || ''
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)
    const message = getWhatsAppMessage(candidate, role, stage, lang)
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    setLang(lang === 'id' ? 'en' : 'id')
  }

  if (!candidate?.whatsapp) return null

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleToggle}
        className="text-xs px-1.5 py-0.5 rounded bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors font-mono leading-none"
      >
        {lang === 'id' ? 'ID' : 'EN'}
      </button>
      <button
        onClick={handleClick}
        className="p-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
        title={`WhatsApp (${lang === 'id' ? 'Bahasa' : 'English'}) — ${stage}`}
      >
        <MessageCircle size={13} />
      </button>
    </div>
  )
}

export default function CandidateCard({ app, onDragStart }) {
  if (!app) return null

  const [showDetail, setShowDetail] = useState(false)
  const [noteCount, setNoteCount] = useState(0)

  useEffect(() => {
    fetchNoteCount()
  }, [app.id])

  const fetchNoteCount = async () => {
    const { count } = await supabase
      .from('notes')
      .select('id', { count: 'exact' })
      .eq('application_id', app.id)
    setNoteCount(count || 0)
  }

  const isStagnant = () => {
    if (!app?.updated_at) return false
    const updated = new Date(app.updated_at)
    const hours = (Date.now() - updated) / (1000 * 60 * 60)
    return hours > 48
  }

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(app)}
        className={`bg-gray-700 rounded-lg p-3 cursor-grab active:cursor-grabbing border ${
          isStagnant() ? 'border-orange-500/60' : 'border-transparent'
        } hover:border-gray-500 transition-colors`}
      >
        {/* Name + WA button row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <p
            className="text-white text-sm font-medium leading-tight hover:text-emerald-400 cursor-pointer transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}
          >
            {app.candidates?.full_name}
          </p>
          <WhatsAppButton
            candidate={app.candidates}
            role={app.roles}
            stage={app.stage}
          />
        </div>

        {/* Role */}
        <p className="text-gray-400 text-xs mb-2">{app.roles?.title}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            app.candidates?.origin === 'Lombok Local'
              ? 'bg-emerald-900/50 text-emerald-400'
              : 'bg-gray-600 text-gray-400'
          }`}>
            {app.candidates?.origin === 'Lombok Local' ? '🏝️ Local' : '📍 Outside'}
          </span>

          <div className="flex items-center gap-2">
            {/* Note count badge */}
            {noteCount > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowDetail(true) }}
                className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <FileText size={11} />
                <span className="text-xs">{noteCount}</span>
              </button>
            )}

            {isStagnant() && (
              <span className="flex items-center gap-1 text-orange-400 text-xs">
                <Clock size={10} />
                {formatDistanceToNow(new Date(app.updated_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {showDetail && (
        <CandidateDetail
          app={app}
          onClose={() => { setShowDetail(false); fetchNoteCount() }}
        />
      )}
    </>
  )
}