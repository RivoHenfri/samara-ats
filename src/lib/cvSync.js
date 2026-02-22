/**
 * CV Sync — Auto-populate candidate profile from parsed CV data.
 *
 * Only fills in fields that are currently empty/null on the candidate record
 * so that manual edits are never overwritten.
 */

import { supabase } from './supabase'

/**
 * Merge parsed CV data into the candidates table.
 * @param {string} candidateId
 * @param {object} parsedData — output of parseCVWithClaude
 * @returns {{ updated: string[], skipped: string[] }}
 */
export async function syncParsedDataToCandidate(candidateId, parsedData) {
  if (!candidateId || !parsedData) return { updated: [], skipped: [] }

  // Fetch current candidate record
  const { data: candidate } = await supabase
    .from('candidates')
    .select('full_name, email, whatsapp, current_salary')
    .eq('id', candidateId)
    .maybeSingle()

  if (!candidate) return { updated: [], skipped: [] }

  const updates = {}
  const updated = []
  const skipped = []

  // full_name — only if blank or placeholder-like
  if (parsedData.full_name && (!candidate.full_name || candidate.full_name.trim() === '')) {
    updates.full_name = parsedData.full_name.trim()
    updated.push('full_name')
  } else if (parsedData.full_name) {
    skipped.push('full_name')
  }

  // email — only if blank
  if (parsedData.email && !candidate.email) {
    updates.email = parsedData.email.trim().toLowerCase()
    updated.push('email')
  } else if (parsedData.email) {
    skipped.push('email')
  }

  // whatsapp — only if blank
  if (parsedData.whatsapp && !candidate.whatsapp) {
    updates.whatsapp = parsedData.whatsapp.trim()
    updated.push('whatsapp')
  } else if (parsedData.whatsapp) {
    skipped.push('whatsapp')
  }

  // current_salary — only if null
  if (parsedData.current_salary != null && !candidate.current_salary) {
    updates.current_salary = parsedData.current_salary
    updated.push('current_salary')
  } else if (parsedData.current_salary != null) {
    skipped.push('current_salary')
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('candidates')
      .update(updates)
      .eq('id', candidateId)
  }

  return { updated, skipped }
}

/**
 * Validate parsed CV data and return warnings for missing or inconsistent fields.
 * @param {object} parsedData
 * @returns {{ field: string, status: 'ok'|'missing'|'warning', message: string }[]}
 */
export function validateParsedData(parsedData) {
  if (!parsedData) return []

  const checks = []

  // Required fields
  checks.push({
    field: 'Name',
    status: parsedData.full_name ? 'ok' : 'missing',
    message: parsedData.full_name ? parsedData.full_name : 'Name not found in CV',
  })

  checks.push({
    field: 'Email',
    status: parsedData.email ? 'ok' : 'missing',
    message: parsedData.email ? parsedData.email : 'Email not found in CV',
  })

  checks.push({
    field: 'Phone',
    status: parsedData.whatsapp ? 'ok' : 'missing',
    message: parsedData.whatsapp ? parsedData.whatsapp : 'Phone number not found in CV',
  })

  // Work history
  const hasHistory = parsedData.employment_history?.length > 0
  checks.push({
    field: 'Work History',
    status: hasHistory ? 'ok' : 'missing',
    message: hasHistory
      ? `${parsedData.employment_history.length} position(s) found`
      : 'No work history found',
  })

  // Skills
  const hasSkills = parsedData.skills?.length > 0
  checks.push({
    field: 'Skills',
    status: hasSkills ? 'ok' : 'warning',
    message: hasSkills
      ? `${parsedData.skills.length} skill(s) extracted`
      : 'No skills detected',
  })

  // Education
  const hasEdu = parsedData.education?.length > 0
  checks.push({
    field: 'Education',
    status: hasEdu ? 'ok' : 'warning',
    message: hasEdu
      ? `${parsedData.education.length} entry(ies)`
      : 'No education listed',
  })

  // Salary
  checks.push({
    field: 'Salary',
    status: parsedData.current_salary != null ? 'ok' : 'warning',
    message: parsedData.current_salary != null
      ? `Rp ${parseInt(parsedData.current_salary).toLocaleString('id-ID')}`
      : 'Salary not mentioned in CV',
  })

  // Consistency warnings
  if (parsedData.current_salary && parsedData.current_salary < 500000) {
    checks.push({
      field: 'Salary',
      status: 'warning',
      message: 'Salary seems unrealistically low — verify manually',
    })
  }

  if (parsedData.employment_gaps?.length > 0) {
    const longest = Math.max(...parsedData.employment_gaps.map(g => g.duration_months || 0))
    if (longest > 6) {
      checks.push({
        field: 'Gaps',
        status: 'warning',
        message: `Employment gap of ${longest} months detected`,
      })
    }
  }

  return checks
}
