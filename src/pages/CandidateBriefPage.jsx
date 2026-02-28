/**
 * CandidateBriefPage.jsx
 *
 * Full-page view of the Candidate Brief with PDF export.
 * Route: /candidates/:appId/brief (protected, requires auth)
 */

import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import CandidateBrief from '../components/CandidateBrief'
import { exportBriefAsPDF } from '../lib/exportCandidateBrief'

export default function CandidateBriefPage() {
  const { appId } = useParams()
  const navigate = useNavigate()
  const briefRef = useRef(null)
  const [exporting, setExporting] = useState(false)

  // We'll capture candidate and role names from the brief component
  // via a callback or by reading the DOM. For simplicity, use DOM.
  const handleExport = async () => {
    if (!briefRef.current) return
    setExporting(true)

    try {
      // Extract names from the brief DOM
      const h1 = briefRef.current.querySelector('h1')
      const candidateName = h1?.textContent || 'Candidate'
      const roleP = briefRef.current.querySelector('h1 + p')
      const roleName = roleP?.textContent?.split('·')?.[0]?.trim() || 'Role'

      await exportBriefAsPDF(briefRef.current, candidateName, roleName)
    } catch (err) {
      console.error('[CandidateBriefPage] PDF export failed:', err)
      alert('PDF export failed. Please try again.')
    }

    setExporting(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3F0' }}>

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: '1px solid #EBE7E1',
        padding: '10px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#4A7C74', fontWeight: 500,
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: '#9A8F80', fontWeight: 500 }}>
            Candidate Brief
          </span>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#4A7C74', color: 'white',
              border: 'none', borderRadius: 6,
              padding: '7px 16px', fontSize: 12.5, fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {exporting
              ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Exporting…</>
              : <><Download size={13} />Export PDF</>
            }
          </button>
        </div>
      </div>

      {/* Brief content */}
      <div style={{ padding: '24px 16px 80px' }}>
        <div style={{
          background: 'white', borderRadius: 10,
          border: '1px solid #EBE7E1',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}>
          <CandidateBrief ref={briefRef} applicationId={appId} />
        </div>
      </div>
    </div>
  )
}
