/**
 * PrescreeningNotifyModal.jsx
 *
 * Modal that appears after moving a candidate to Screening on the Kanban.
 * Allows the recruiter to send the prescreening form link via:
 * - WhatsApp (wa.me deep link)
 * - Copy to clipboard (for email or other channels)
 * - mailto: link
 *
 * Logs the notification to the notification_log table.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { X, MessageCircle, Copy, Mail, Check, ExternalLink } from 'lucide-react'

export default function PrescreeningNotifyModal({ app, formUrl, onClose }) {
  const [lang, setLang] = useState('id') // 'id' = Bahasa Indonesia, 'en' = English
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  const candidate = app?.candidates || {}
  const role = app?.roles || {}
  const firstName = (candidate.full_name || '').split(' ')[0] || 'there'

  // ── Message templates ─────────────────────────────────────────────────
  const messages = {
    id: `Halo ${firstName}, ini Satya dari Samara Lombok.\n\nTerima kasih atas lamaran Anda untuk posisi *${role.title || 'ini'}*. Sebagai bagian dari proses seleksi, mohon lengkapi formulir prescreening berikut:\n\n${formUrl}\n\nMohon selesaikan dalam 3 hari kerja.\n\nTerima kasih! 🙏`,
    en: `Hi ${firstName}, this is Satya from Samara Lombok.\n\nThank you for applying for the *${role.title || 'this'}* role. As part of our screening process, please complete this prescreening form:\n\n${formUrl}\n\nPlease complete it within 3 business days.\n\nThank you!`,
  }

  const message = messages[lang]

  // ── Format WhatsApp number ────────────────────────────────────────────
  const formatWhatsApp = (raw) => {
    if (!raw) return null
    let number = raw.replace(/[\s\-\(\)]/g, '')
    if (number.startsWith('0')) number = '62' + number.slice(1)
    if (number.startsWith('+')) number = number.slice(1)
    return number
  }

  const whatsappNumber = formatWhatsApp(candidate.whatsapp)

  // ── Handlers ──────────────────────────────────────────────────────────
  const logNotification = async (channel) => {
    try {
      await supabase.from('notification_log').insert({
        application_id: app.id,
        channel,
        notification_type: 'prescreening_form',
        recipient: channel === 'whatsapp' ? candidate.whatsapp : candidate.email,
        message_preview: message.substring(0, 200),
        status: 'sent',
      })

      // Update prescreening status in responses table
      await supabase
        .from('prescreening_responses')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('application_id', app.id)
    } catch (err) {
      console.warn('[PrescreeningNotifyModal] log failed:', err?.message)
    }
  }

  const handleWhatsApp = async () => {
    if (!whatsappNumber) {
      alert('No WhatsApp number available for this candidate.')
      return
    }
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank')
    await logNotification('whatsapp')
    setSent(true)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleEmail = async () => {
    const subject = encodeURIComponent(`Samara Lombok — Prescreening Form for ${role.title || 'your application'}`)
    const body = encodeURIComponent(message.replace(/\*/g, '')) // strip WhatsApp bold markers
    window.open(`mailto:${candidate.email || ''}?subject=${subject}&body=${body}`, '_blank')
    await logNotification('email')
    setSent(true)
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* Header */}
        <div style={header}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--charcoal)' }}>
            Send Prescreening Form
          </h3>
          <button onClick={onClose} style={closeBtn}><X size={16} /></button>
        </div>

        {/* Candidate info */}
        <div style={{ padding: '12px 20px', background: 'var(--sand-light)', borderBottom: '1px solid var(--sand-dark)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--charcoal)' }}>
            <strong>{candidate.full_name}</strong> — {role.title}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11.5, color: 'var(--stone)' }}>
            {candidate.whatsapp && `WhatsApp: ${candidate.whatsapp}`}
            {candidate.whatsapp && candidate.email && ' · '}
            {candidate.email && `Email: ${candidate.email}`}
          </p>
        </div>

        {/* Language toggle */}
        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--stone)', fontWeight: 500 }}>Language:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[{ key: 'id', label: 'Bahasa' }, { key: 'en', label: 'English' }].map(l => (
              <button
                key={l.key}
                type="button"
                onClick={() => setLang(l.key)}
                style={{
                  padding: '3px 10px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
                  border: lang === l.key ? '1px solid var(--teal)' : '1px solid var(--sand-dark)',
                  background: lang === l.key ? 'rgba(74,124,116,0.08)' : 'transparent',
                  color: lang === l.key ? 'var(--teal)' : 'var(--stone)',
                  fontWeight: lang === l.key ? 600 : 400,
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message preview */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            background: '#f0f8f0', border: '1px solid #d4e8d4', borderRadius: 8,
            padding: '12px 14px', fontSize: 12.5, color: '#2C2A27',
            whiteSpace: 'pre-wrap', lineHeight: 1.55, maxHeight: 180, overflowY: 'auto',
          }}>
            {message}
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* WhatsApp */}
          <button type="button" onClick={handleWhatsApp} style={{ ...actionBtn, background: '#25D366', color: 'white' }}>
            <MessageCircle size={15} />
            Send via WhatsApp
            <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.7 }} />
          </button>

          {/* Email */}
          {candidate.email && (
            <button type="button" onClick={handleEmail} style={{ ...actionBtn, background: 'var(--teal)', color: 'white' }}>
              <Mail size={15} />
              Send via Email
              <ExternalLink size={11} style={{ marginLeft: 'auto', opacity: 0.7 }} />
            </button>
          )}

          {/* Copy link */}
          <button type="button" onClick={handleCopyLink} style={{ ...actionBtn, background: 'var(--sand-light)', color: 'var(--charcoal)', border: '1px solid var(--sand-dark)' }}>
            {copied ? <Check size={15} style={{ color: 'var(--teal)' }} /> : <Copy size={15} />}
            {copied ? 'Link Copied!' : 'Copy Form Link'}
          </button>
        </div>

        {/* Sent confirmation */}
        {sent && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{
              background: 'rgba(74,124,116,0.06)', border: '1px solid rgba(74,124,116,0.15)',
              borderRadius: 6, padding: '8px 12px', fontSize: 12, color: 'var(--teal)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Check size={13} /> Notification sent. You can close this dialog.
            </div>
          </div>
        )}

        {/* Close */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sand-dark)', textAlign: 'right' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>
            {sent ? 'Done' : 'Skip for now'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 999,
}

const modal = {
  background: 'white', borderRadius: 12, width: '100%', maxWidth: 460,
  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
  overflow: 'hidden',
}

const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 20px', borderBottom: '1px solid var(--sand-dark)',
}

const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--stone)', padding: 2, display: 'flex',
}

const actionBtn = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '10px 14px', borderRadius: 7,
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  border: 'none', fontFamily: 'inherit',
  transition: 'opacity 0.15s',
}
