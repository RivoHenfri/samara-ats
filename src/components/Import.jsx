import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CheckCircle, FileSpreadsheet } from 'lucide-react'

// ─── Stage Mapping ─────────────────────────────────────
const STAGE_MAP = {
  'pre screening': 'Screening',
  'prescreening': 'Screening',
  'prescreeen': 'Screening',
  'prescreen': 'Screening',
  'pre-screening': 'Screening',
  'screening': 'Screening',
  'personality test': 'Screening',
  'initial interview': 'Interview',
  'interview user 1': 'Interview',
  'interview user 2': 'Interview',
  'interview': 'Interview',
  'offering': 'Offer',
  'offer': 'Offer',
  'hired': 'Hired',
  'join': 'Hired',
  'failed': 'Rejected',
  'rejected': 'Rejected',
  'passed with concern': 'Screening',
  'passed': 'Screening',
  'sent': 'Screening',
  '#n/a': 'New',
  'new': 'New',
}

// ─── Source Mapping (CSV values → DB enum) ─────────────
const SOURCE_MAP = {
  'jobstreet': 'Job Board',
  'glints': 'Job Board',
  'hoteljob.id': 'Job Board',
  'local job portal': 'Job Board',
  'linkedin': 'Social Media',
  'facebook': 'Social Media',
  'referral': 'Referral',
  'local community': 'Referral',
  'email': 'Other',
  'database': 'Internal',
  'walk-in': 'Walk-in',
  'walkin': 'Walk-in',
  'agency': 'Agency',
}

// ─── Division Mapping (dept → division) ────────────────
const DIVISION_MAP = {
  'hospitality': 'Hospitality',
  'culinary': 'Hospitality',
  'f&b': 'Hospitality',
  'food & beverage': 'Hospitality',
  'housekeeping': 'Hospitality',
  'front office': 'Hospitality',
  'mep': 'Construction',
  'construction': 'Construction',
  'engineering': 'Construction',
  'management': 'Operations',
  'executive office': 'Operations',
  'operations': 'Operations',
  'hr': 'Operations',
  'finance': 'Operations',
  'admin': 'Operations',
  'it': 'Operations',
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
  const key = raw.toString().toLowerCase().trim()
  return SOURCE_MAP[key] || 'Other'
}

function mapDivision(dept) {
  if (!dept) return 'Operations'
  const key = dept.toString().toLowerCase().trim()
  return DIVISION_MAP[key] || 'Operations'
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
    let imported = 0
    let skipped = 0
    let errors = 0
    const errDetails = []

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i]
      setProgress(Math.round(((i + 1) / preview.length) * 100))

      try {
        // 1. Find or create candidate
        let candidateId
        const { data: existingCandArr, error: findCandErr } = await supabase
          .from('candidates')
          .select('id')
          .eq('full_name', row.full_name)
          .limit(1)

        if (findCandErr) {
          errDetails.push(`${row.full_name}: find candidate failed — ${findCandErr.message}`)
          errors++; continue
        }

        if (existingCandArr && existingCandArr.length > 0) {
          candidateId = existingCandArr[0].id
        } else {
          const { data: newCand, error: insertCandErr } = await supabase
            .from('candidates')
            .insert({
              full_name: row.full_name,
              email: row.email || null,
              whatsapp: row.whatsapp || null,
              origin: 'Indonesian Expat',
            })
            .select('id')
            .single()
          if (insertCandErr) {
            errDetails.push(`${row.full_name}: insert candidate failed — ${insertCandErr.message}`)
            errors++; continue
          }
          candidateId = newCand.id
        }

        // 2. Find or create role
        let roleId
        const roleName = row.position || 'General Application'
        const dept = row.department || 'Operations'
        const division = mapDivision(dept)

        const { data: existingRoleArr, error: findRoleErr } = await supabase
          .from('roles')
          .select('id')
          .eq('title', roleName)
          .limit(1)

        if (findRoleErr) {
          errDetails.push(`${row.full_name}: find role failed — ${findRoleErr.message}`)
          errors++; continue
        }

        if (existingRoleArr && existingRoleArr.length > 0) {
          roleId = existingRoleArr[0].id
        } else {
          const { data: newRole, error: insertRoleErr } = await supabase
            .from('roles')
            .insert({
              title: roleName,
              department: dept,
              status: 'Open',
              priority: 'Core',
            })
            .select('id')
            .single()
          if (insertRoleErr) {
            errDetails.push(`${row.full_name}: insert role "${roleName}" failed — ${insertRoleErr.message}`)
            errors++; continue
          }
          roleId = newRole.id
        }

        // 3. Check duplicate application
        const { data: dupArr, error: dupErr } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .eq('role_id', roleId)
          .limit(1)

        if (dupErr) {
          errDetails.push(`${row.full_name}: duplicate check failed — ${dupErr.message}`)
          errors++; continue
        }
        if (dupArr && dupArr.length > 0) { skipped++; continue }

        // 4. Insert application
        const { data: newApp, error: insertAppErr } = await supabase
          .from('applications')
          .insert({
            candidate_id: candidateId,
            role_id: roleId,
            stage: row.stage || 'New',
            last_stage_change_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (insertAppErr) {
          errDetails.push(`${row.full_name}: insert application failed — ${insertAppErr.message}`)
          errors++; continue
        }

        // 5. Add note if exists
        if (row.notes && newApp) {
          await supabase.from('notes').insert({
            application_id: newApp.id,
            content: row.notes,
            created_by: 'Import',
          })
        }

        imported++
      } catch (err) {
        console.error('Row error:', row.full_name, err)
        errDetails.push(`${row.full_name}: unexpected error — ${err.message}`)
        errors++
      }
    }

    setImporting(false)
    setResults({ imported, skipped, errors })
    setErrorLog(errDetails)
    setPreview([])
    setFileName('')
  }

  const stageColor = (stage) => ({
    New: 'bg-gray-600', Screening: 'bg-blue-600', Interview: 'bg-yellow-600',
    Offer: 'bg-purple-600', Hired: 'bg-emerald-600', Rejected: 'bg-red-600',
  }[stage] || 'bg-gray-600')

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-2">Import Candidates</h1>
      <p className="text-gray-400 text-sm mb-8">Upload an Excel (.xlsx) or CSV file to bulk import candidates into the pipeline.</p>

      {results && (
        <div className="mb-6 bg-gray-800 rounded-xl p-5 flex items-start gap-4">
          <CheckCircle size={24} className={`mt-0.5 shrink-0 ${results.errors > 0 && results.imported === 0 ? 'text-red-400' : 'text-emerald-400'}`} />
          <div>
            <p className="text-white font-semibold">Import complete!</p>
            <p className="text-gray-400 text-sm mt-1">
              <span className="text-emerald-400 font-medium">{results.imported} imported</span>
              {results.skipped > 0 && <span className="ml-3 text-yellow-400">{results.skipped} skipped (duplicates)</span>}
              {results.errors > 0 && <span className="ml-3 text-red-400">{results.errors} errors</span>}
            </p>
            <p className="text-gray-500 text-xs mt-1">Go to Pipeline or Candidates to see your imported data.</p>
            {errorLog.length > 0 && (
              <details className="mt-3">
                <summary className="text-red-400 text-xs cursor-pointer hover:text-red-300">
                  Show error details ({errorLog.length})
                </summary>
                <div className="mt-2 max-h-40 overflow-auto bg-gray-900 rounded-lg p-3">
                  {errorLog.map((e, i) => (
                    <p key={i} className="text-red-400/80 text-xs font-mono mb-1">{e}</p>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Progress bar during import */}
      {importing && (
        <div className="mb-6 bg-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-medium">Importing candidates...</p>
            <p className="text-gray-400 text-sm">{progress}%</p>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div className="bg-emerald-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {preview.length === 0 && !results && !importing && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-400'
          }`}
        >
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-gray-500" />
          <p className="text-white font-medium mb-1">Drop your Excel or CSV file here</p>
          <p className="text-gray-500 text-sm">or click to browse</p>
          <p className="text-gray-600 text-xs mt-3">Supports .xlsx, .xls, .csv</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      )}

      {preview.length > 0 && !importing && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white font-medium">{fileName}</p>
              <p className="text-gray-400 text-sm">{preview.length} candidates ready to import</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => { setPreview([]); setFileName('') }}
                className="text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-gray-700 text-sm transition-colors">
                Cancel
              </button>
              <button onClick={handleImport} disabled={importing}
                className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {importing ? 'Importing...' : `Import ${preview.length} candidates`}
              </button>
            </div>
          </div>
          <div className="bg-gray-800 rounded-xl overflow-auto max-h-[60vh]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-800">
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 px-4 py-3">Name</th>
                  <th className="text-left text-gray-400 px-4 py-3">Position</th>
                  <th className="text-left text-gray-400 px-4 py-3">Dept</th>
                  <th className="text-left text-gray-400 px-4 py-3">Source</th>
                  <th className="text-left text-gray-400 px-4 py-3">Stage</th>
                  <th className="text-left text-gray-400 px-4 py-3">WhatsApp</th>
                  <th className="text-left text-gray-400 px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-4 py-2.5 text-white font-medium">{row.full_name}</td>
                    <td className="px-4 py-2.5 text-gray-300">{row.position || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400">{row.department || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-400">{row.source || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs text-white px-2 py-0.5 rounded-full ${stageColor(row.stage)}`}>
                        {row.stage}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">{row.whatsapp || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}