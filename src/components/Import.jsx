import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CheckCircle, FileSpreadsheet } from 'lucide-react'

// ── Stage / Source / Division maps (unchanged) ────────────────
const STAGE_MAP = {
  'pre screening': 'Screening', 'prescreening': 'Screening',
  'prescreeen': 'Screening', 'prescreen': 'Screening',
  'pre-screening': 'Screening', 'screening': 'Screening',
  'personality test': 'Screening', 'initial interview': 'Interview',
  'interview user 1': 'Interview', 'interview user 2': 'Interview',
  'interview': 'Interview', 'offering': 'Offer', 'offer': 'Offer',
  'hired': 'Hired', 'join': 'Hired', 'failed': 'Rejected',
  'rejected': 'Rejected', 'passed with concern': 'Screening',
  'passed': 'Screening', 'sent': 'Screening', '#n/a': 'New', 'new': 'New',
}

const SOURCE_MAP = {
  'jobstreet': 'Job Board', 'glints': 'Job Board',
  'hoteljob.id': 'Job Board', 'local job portal': 'Job Board',
  'linkedin': 'Social Media', 'facebook': 'Social Media',
  'referral': 'Referral', 'local community': 'Referral',
  'email': 'Other', 'database': 'Internal',
  'walk-in': 'Walk-in', 'walkin': 'Walk-in', 'agency': 'Agency',
}

const DIVISION_MAP = {
  'hospitality': 'Hospitality', 'culinary': 'Hospitality',
  'f&b': 'Hospitality', 'food & beverage': 'Hospitality',
  'housekeeping': 'Hospitality', 'front office': 'Hospitality',
  'mep': 'Construction', 'construction': 'Construction',
  'engineering': 'Construction', 'management': 'Operations',
  'executive office': 'Operations', 'operations': 'Operations',
  'hr': 'Operations', 'finance': 'Operations',
  'admin': 'Operations', 'it': 'Operations',
  'security': 'Operations',
}

function mapStage(raw) {
  if (!raw) return 'New'
  const key = raw.toString().toLowerCase().trim()
  for (const [k, v] of Object.entries(STAGE_MAP)) {
    if (key.includes(k)) return v
  }
  return 'New'
}

function mapSource(raw) {
  if (!raw) return 'Other'
  return SOURCE_MAP[raw.toString().toLowerCase().trim()] || 'Other'
}

function mapDivision(dept) {
  if (!dept) return 'Operations'
  return DIVISION_MAP[dept.toString().toLowerCase().trim()] || 'Operations'
}

function normalizePhone(raw) {
  if (!raw) return null
  let n = raw.toString().replace(/[\s\-\(\)\+]/g, '')
  if (n.startsWith('62')) return n
  if (n.startsWith('0')) return '62' + n.slice(1)
  if (n.length > 8) return '62' + n
  return n
}

function parseRows(data) {
  let headerIdx = 0
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i].map(c => (c || '').toString().toLowerCase())
    if (row.some(c => c.includes('name'))) { headerIdx = i; break }
  }
  const headers = data[headerIdx].map(h => (h || '').toString().trim())
  const rows = data.slice(headerIdx + 1)
  const get = (row, ...keys) => {
    for (const key of keys) {
      const idx = headers.findIndex(h => h.toLowerCase().includes(key.toLowerCase()))
      if (idx !== -1 && row[idx] !== undefined && row[idx] !== '') return row[idx].toString().trim()
    }
    return null
  }
  return rows
    .map(row => ({
      full_name: get(row, 'candidate name', 'name'),
      email: get(row, 'email'),
      whatsapp: normalizePhone(get(row, 'phone', 'whatsapp', 'mobile')),
      position: get(row, 'position', 'role', 'job title'),
      department: get(row, 'dept', 'department'),
      source: get(row, 'source'),
      stage: mapStage(get(row, 'last recruitment stage', 'stage', 'status', 'prescreen', 'result')),
      notes: get(row, 'failed remark', 'comment', 'notes', 'remark'),
    }))
    .filter(r => r.full_name && r.full_name.length > 1)
}

// Stage badge class
const stageClass = {
  New: 'stage-new', Screening: 'stage-screening',
  Interview: 'stage-interview', Offer: 'stage-offer',
  Hired: 'stage-hired', Rejected: 'stage-rejected',
}

// ── IMPORT PAGE ───────────────────────────────────────────────
export default function Import() {
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [errorLog, setErrorLog] = useState([])
  const fileRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    setResults(null)
    setErrorLog([])
    const reader = new FileReader()
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: 'binary' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
      setPreview(parseRows(data))
    }
    reader.readAsBinaryString(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    setImporting(true)
    setProgress(0)
    let imported = 0, skipped = 0, errors = 0
    const errDetails = []

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      setProgress(Math.round(((i + 1) / preview.length) * 100))

      try {
        // 1. Find or create candidate
        let candidateId
        const { data: existingCandArr, error: findCandErr } = await supabase
          .from('candidates').select('id').eq('full_name', row.full_name).limit(1)
        if (findCandErr) { errDetails.push(`${row.full_name}: find failed — ${findCandErr.message}`); errors++; continue }

        if (existingCandArr?.length > 0) {
          candidateId = existingCandArr[0].id
        } else {
          const { data: newCand, error: insertCandErr } = await supabase
            .from('candidates')
            .insert({ full_name: row.full_name, email: row.email || null, whatsapp: row.whatsapp || null, origin: 'Indonesian (Non-Lombok)' })
            .select('id').single()
          if (insertCandErr) { errDetails.push(`${row.full_name}: insert failed — ${insertCandErr.message}`); errors++; continue }
          candidateId = newCand.id
        }

        // 2. Find or create role
        let roleId
        const roleName = row.position || 'General Application'
        const dept = row.department || 'Operations'
        const { data: existingRoleArr, error: findRoleErr } = await supabase
          .from('roles').select('id').eq('title', roleName).limit(1)
        if (findRoleErr) { errDetails.push(`${row.full_name}: find role failed — ${findRoleErr.message}`); errors++; continue }

        if (existingRoleArr?.length > 0) {
          roleId = existingRoleArr[0].id
        } else {
          const { data: newRole, error: insertRoleErr } = await supabase
            .from('roles').insert({ title: roleName, department: dept, status: 'Open', priority: 'Core', priority_level: 'Normal' })
            .select('id').single()
          if (insertRoleErr) { errDetails.push(`${row.full_name}: insert role failed — ${insertRoleErr.message}`); errors++; continue }
          roleId = newRole.id
        }

        // 3. Check duplicate
        const { data: dupArr, error: dupErr } = await supabase
          .from('applications').select('id').eq('candidate_id', candidateId).eq('role_id', roleId).limit(1)
        if (dupErr) { errDetails.push(`${row.full_name}: dup check failed — ${dupErr.message}`); errors++; continue }
        if (dupArr?.length > 0) { skipped++; continue }

        // 4. Insert application
        const { data: newApp, error: insertAppErr } = await supabase
          .from('applications')
          .insert({ candidate_id: candidateId, role_id: roleId, stage: row.stage || 'New', last_stage_change_at: new Date().toISOString() })
          .select('id').single()
        if (insertAppErr) { errDetails.push(`${row.full_name}: insert app failed — ${insertAppErr.message}`); errors++; continue }

        // 5. Add note
        if (row.notes && newApp) {
          await supabase.from('notes').insert({ application_id: newApp.id, content: row.notes, created_by: 'Import' })
        }
        imported++
      } catch (err) {
        errDetails.push(`${row.full_name}: unexpected — ${err.message}`)
        errors++
      }
    }

    setImporting(false)
    setResults({ imported, skipped, errors })
    setErrorLog(errDetails)
    setPreview([])
    setFileName('')
  }

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">Import Candidates</h1>
        {preview.length > 0 && !importing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setPreview([]); setFileName('') }} className="btn btn-ghost btn-sm">
              Cancel
            </button>
            <button onClick={handleImport} className="btn btn-primary btn-sm">
              Import {preview.length} candidates
            </button>
          </div>
        )}
      </div>

      <div className="page-body" style={{ maxWidth: 960 }}>
        <p style={{ fontSize: 12, color: 'var(--stone)', marginBottom: 20 }}>
          Upload an Excel (.xlsx) or CSV file to bulk import candidates into the pipeline.
        </p>

        {/* Result summary */}
        {results && (
          <div className="card" style={{ marginBottom: 18, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <CheckCircle size={22} color={results.errors > 0 && results.imported === 0 ? 'var(--alert)' : 'var(--teal)'} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Import complete!</p>
              <p style={{ fontSize: 12.5 }}>
                <span style={{ color: 'var(--teal)', fontWeight: 600 }}>{results.imported} imported</span>
                {results.skipped > 0 && <span style={{ marginLeft: 14, color: 'var(--gold)' }}>{results.skipped} skipped (duplicates)</span>}
                {results.errors > 0 && <span style={{ marginLeft: 14, color: 'var(--alert)' }}>{results.errors} errors</span>}
              </p>
              {errorLog.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 11, color: 'var(--alert)', cursor: 'pointer' }}>
                    Show error details ({errorLog.length})
                  </summary>
                  <div style={{
                    marginTop: 8, maxHeight: 160, overflowY: 'auto',
                    background: 'var(--sand-light)', borderRadius: 6,
                    padding: '10px 14px',
                  }}>
                    {errorLog.map((e, i) => (
                      <p key={i} style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--alert)', marginBottom: 3 }}>{e}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="card" style={{ padding: '16px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12.5 }}>
              <span style={{ color: 'var(--charcoal)', fontWeight: 500 }}>Importing candidates…</span>
              <span style={{ color: 'var(--stone)' }}>{progress}%</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Upload zone */}
        {preview.length === 0 && !results && !importing && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--gold)' : 'var(--sand-dark)'}`,
              borderRadius: 14,
              padding: '64px 32px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--gold-bg)' : 'white',
              transition: 'border-color 0.18s, background 0.18s',
            }}
          >
            <FileSpreadsheet size={44} color="var(--stone-light)" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 600, color: 'var(--charcoal)', marginBottom: 5 }}>
              Drop your Excel or CSV file here
            </p>
            <p style={{ fontSize: 12, color: 'var(--stone)' }}>or click to browse</p>
            <p style={{ fontSize: 11, color: 'var(--stone-light)', marginTop: 8 }}>Supports .xlsx, .xls, .csv</p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* Preview table */}
        {preview.length > 0 && !importing && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{fileName}</p>
                <p style={{ fontSize: 12, color: 'var(--stone)' }}>{preview.length} candidates ready</p>
              </div>
            </div>
            <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Dept</th>
                    <th>Source</th>
                    <th>Stage</th>
                    <th>WhatsApp</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{row.full_name}</td>
                      <td>{row.position || '—'}</td>
                      <td>{row.department || '—'}</td>
                      <td>{row.source || '—'}</td>
                      <td>
                        <span className={`stage-badge ${stageClass[row.stage] ?? 'stage-new'}`}>
                          {row.stage}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.whatsapp || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--stone)', maxWidth: 180 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.notes || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
