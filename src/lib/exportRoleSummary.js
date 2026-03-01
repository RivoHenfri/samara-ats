/**
 * exportRoleSummary.js
 *
 * Generates and downloads an .xlsx spreadsheet for a role's candidate summary.
 * Columns match the recruiter's existing spreadsheet layout with clickable
 * hyperlinks to Candidate Briefs.
 *
 * Uses the xlsx library (already in package.json for Import).
 */

import * as XLSX from 'xlsx'

// ── Verdict label mapping ────────────────────────────────────────────────────
const VERDICT_LABELS = {
  passed: 'Passed',
  failed: 'Failed',
  passed_with_concern: 'Passed with concern',
}

// ── Prescreen status label mapping ───────────────────────────────────────────
const PRESCREEN_LABELS = {
  not_sent: 'Not Sent',
  pending: 'Pending',
  sent: 'Sent',
  started: 'In Progress',
  completed: 'Completed',
  expired: 'Expired',
}

/**
 * Format date as YYMMDD for link display text (matching recruiter's convention).
 * e.g. 2026-02-22 → "260222"
 */
function formatDateCode(dateStr) {
  if (!dateStr) return '------'
  const d = new Date(dateStr)
  if (isNaN(d)) return '------'
  const yy = String(d.getFullYear()).slice(2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

/**
 * Make a filename-safe string.
 */
function safeName(str) {
  return (str || 'Export').replace(/[^a-zA-Z0-9_\- ]/g, '').trim()
}

/**
 * Export a role summary as .xlsx and trigger browser download.
 *
 * @param {string} roleTitle - e.g. "Group Accountant"
 * @param {Array} applications - Enriched array with shape:
 *   { id, created_at, prescreening_status, screening_verdict, screening_comment,
 *     candidates: { full_name }, score: number|null, aiComment: string }
 */
export function exportRoleSummary(roleTitle, applications) {
  const origin = window.location.origin

  // ── Build header row ─────────────────────────────────────────────────────
  const headers = [
    'Name',
    'Role',
    'Prescreen Invitation',
    'Screening Verdict',
    'Screening Comment',
    'Score',
    'AI Comment',
    'Link to Brief',
  ]

  // ── Build data rows ──────────────────────────────────────────────────────
  const rows = applications.map(app => {
    const name = app.candidates?.full_name || 'Unknown'
    const dateCode = formatDateCode(app.created_at)
    const briefUrl = `${origin}/candidates/${app.id}/brief`
    const displayText = `${dateCode} - ${roleTitle} - ${name}`

    return [
      name,
      roleTitle,
      PRESCREEN_LABELS[app.prescreening_status] || app.prescreening_status || 'Not Sent',
      VERDICT_LABELS[app.screening_verdict] || '',
      app.screening_comment || '',
      app.score ?? '',
      app.aiComment || '',
      displayText,                         // placeholder — hyperlink applied below
      briefUrl,                            // hidden column for reference (will be removed)
    ]
  })

  // ── Create worksheet ─────────────────────────────────────────────────────
  const wsData = [headers, ...rows.map(r => r.slice(0, 8))] // exclude hidden URL column
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // ── Apply hyperlinks to "Link to Brief" column (column H, index 7) ─────
  rows.forEach((row, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 7 }) // +1 for header row
    const briefUrl = row[8] // the hidden URL
    const displayText = row[7]

    if (ws[cellRef]) {
      ws[cellRef].l = { Target: briefUrl, Tooltip: 'Open Candidate Brief' }
    } else {
      ws[cellRef] = { t: 's', v: displayText, l: { Target: briefUrl, Tooltip: 'Open Candidate Brief' } }
    }
  })

  // ── Column widths ────────────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 28 },   // Name
    { wch: 22 },   // Role
    { wch: 16 },   // Prescreen Invitation
    { wch: 20 },   // Screening Verdict
    { wch: 50 },   // Screening Comment
    { wch: 8 },    // Score
    { wch: 60 },   // AI Comment
    { wch: 45 },   // Link to Brief
  ]

  // ── Create workbook and download ─────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Summary')

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const today = new Date().toISOString().slice(0, 10)
  const filename = `${safeName(roleTitle)}_Summary_${today}.xlsx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
