/**
 * CandidateBriefPage.jsx
 *
 * Full-page shell for the Candidate Brief with PDF export.
 * Route: /candidates/:appId/brief (protected, requires auth)
 *
 * The CandidateBrief component renders its own background + padding,
 * so this page is a minimal transparent shell with a sticky top bar.
 */

import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileDown, Loader2, FileText, FileCode } from 'lucide-react'
import CandidateBrief from '../components/CandidateBrief'
import { useReactToPrint } from 'react-to-print'
import briefStyles from '../components/CandidateBrief.css?raw'

const TEAL = '#2A7B6F'
const BORDER = '#E5E9EB'
const MUTED = '#6B7280'
const MONO = "'DM Mono', 'DM Sans', monospace"
const SANS = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif"

export default function CandidateBriefPage() {
  const { appId } = useParams()
  const navigate = useNavigate()
  const briefRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: briefRef,
    documentTitle: 'Candidate_Brief',
    onBeforePrint: () => {
      return new Promise((resolve) => {
        setExporting(true)
        setTimeout(resolve, 50)
      })
    },
    onAfterPrint: () => setExporting(false),
  })

  const handleExport = () => {
    handlePrint()
  }

  const handleExportWord = () => {
    if (!briefRef.current) return
    setExportingWord(true)

    setTimeout(() => {
      try {
        const content = briefRef.current.innerHTML

        const html = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head>
            <meta charset='utf-8'>
            <title>Candidate_Brief</title>
            <style>
              ${briefStyles}
              body { font-family: 'DM Sans', sans-serif; background: #FFF !important; }
              .candidate-brief-wrapper { padding: 0 !important; background: #FFF !important; }
              .page { max-width: 100% !important; padding: 0 !important; gap: 14px; }
              .avatar span, .avatar svg { display: none !important; }
            </style>
          </head>
          <body>
            <div class="candidate-brief-wrapper">
              ${content}
            </div>
          </body>
          </html>
        `

        const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        document.body.appendChild(link)
        link.href = url
        link.download = 'Candidate_Brief_' + appId + '.doc'
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('Failed to export to Word:', err)
      } finally {
        setExportingWord(false)
      }
    }, 50)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#F7F9F9', fontFamily: SANS }}>

      {/* ── Sticky top bar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: `1px solid ${BORDER} `,
        height: 52, padding: '0 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: MUTED, fontWeight: 500, fontFamily: SANS,
            padding: '0 4px', transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#1A1A1A'}
          onMouseLeave={e => e.currentTarget.style.color = MUTED}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileText size={13} style={{ color: MUTED }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, fontFamily: MONO, letterSpacing: '0.04em' }}>
              Candidate Brief
            </span>
          </div>
          <div style={{ width: 1, height: 18, background: BORDER, marginLeft: 6, marginRight: 6 }} />

          <button
            onClick={handleExportWord}
            disabled={exportingWord || exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'white', color: TEAL,
              border: `1px solid ${TEAL}`, borderRadius: 8,
              padding: '6.5px 14px', fontSize: 12.5, fontWeight: 600,
              cursor: (exportingWord || exporting) ? 'not-allowed' : 'pointer',
              fontFamily: SANS, opacity: (exportingWord || exporting) ? 0.75 : 1,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!exportingWord && !exporting) e.currentTarget.style.background = '#F0F7F6' }}
            onMouseLeave={e => { if (!exportingWord && !exporting) e.currentTarget.style.background = 'white' }}
          >
            {exportingWord
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Exporting…</>
              : <><FileText size={13} /> Export Word</>}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting || exportingWord}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: TEAL, color: 'white',
              border: '1px solid transparent', borderRadius: 8,
              padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
              cursor: (exporting || exportingWord) ? 'not-allowed' : 'pointer',
              fontFamily: SANS, opacity: (exporting || exportingWord) ? 0.75 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!exporting && !exportingWord) e.currentTarget.style.background = '#216158' }}
            onMouseLeave={e => { if (!exporting && !exportingWord) e.currentTarget.style.background = TEAL }}
          >
            {exporting
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Exporting…</>
              : <><FileDown size={13} /> Export PDF</>}
          </button>
        </div>
      </div>

      {/* ── Brief content — component handles its own bg + padding ── */}
      <CandidateBrief ref={briefRef} applicationId={appId} />
    </div >
  )
}
