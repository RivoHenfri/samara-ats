/**
 * PrescreeningTemplateEditor.jsx
 *
 * Renders inside the role edit modal. Allows recruiters to:
 * - Toggle standard prescreening fields (salary, notice period, MBTI, etc.)
 * - Add/edit/reorder custom technical questions
 * - Request AI-suggested questions based on role context
 * - Save template to prescreening_templates table
 */

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { suggestPrescreeningQuestions } from '../lib/generatePrescreeningQuestions'
import { Wand2, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Loader2, Check, Eye, EyeOff } from 'lucide-react'

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Answer' },
  { value: 'textarea', label: 'Long Answer' },
  { value: 'select', label: 'Multiple Choice' },
  { value: 'number', label: 'Number' },
]

export default function PrescreeningTemplateEditor({ roleId, tenantId }) {
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Local editable state
  const [fixedFields, setFixedFields] = useState([])
  const [customQuestions, setCustomQuestions] = useState([])

  // ── Load template ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('prescreening_templates')
        .select('*')
        .eq('role_id', roleId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data) {
        setTemplate(data)
        setFixedFields(data.fixed_fields || [])
        setCustomQuestions(data.custom_questions || [])
      } else {
        // Use defaults — parse from the default JSONB value
        setFixedFields([
          { field_key: 'current_salary', label: 'Current Monthly Salary (IDR)', type: 'currency', required: true },
          { field_key: 'expected_salary', label: 'Expected Monthly Salary (IDR)', type: 'currency', required: true },
          { field_key: 'notice_period', label: 'Notice Period', type: 'select', required: true, options: ['Immediately', '2 weeks', '1 month', '2 months', '3+ months'] },
          { field_key: 'availability_date', label: 'Earliest Available Start Date', type: 'date', required: true },
          { field_key: 'certifications', label: 'Relevant Certifications / Licenses', type: 'textarea', required: false },
          { field_key: 'previously_applied', label: 'Have you previously applied to Samara?', type: 'yes_no_detail', required: true, detail_prompt: 'Which role and when?' },
          { field_key: 'relatives_at_company', label: 'Do you have friends or relatives working at Samara?', type: 'yes_no_detail', required: true, detail_prompt: 'Please provide their name(s) and position(s).' },
          { field_key: 'mbti_type', label: 'MBTI Personality Type', type: 'mbti', required: false },
        ])
        setCustomQuestions([])
      }
      setLoading(false)
    }
    load()
  }, [roleId])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    const payload = {
      role_id: roleId,
      tenant_id: tenantId || '00000000-0000-0000-0000-000000000001',
      is_active: true,
      fixed_fields: fixedFields,
      custom_questions: customQuestions,
    }

    if (template?.id) {
      await supabase
        .from('prescreening_templates')
        .update(payload)
        .eq('id', template.id)
    } else {
      const { data } = await supabase
        .from('prescreening_templates')
        .insert(payload)
        .select()
        .single()
      if (data) setTemplate(data)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // ── Toggle fixed field ───────────────────────────────────────────────────
  const toggleField = (index, prop) => {
    setFixedFields(prev => prev.map((f, i) =>
      i === index ? { ...f, [prop]: !f[prop] } : f
    ))
  }

  // ── Custom question CRUD ─────────────────────────────────────────────────
  const addCustomQuestion = () => {
    setCustomQuestions(prev => [...prev, {
      question: '',
      type: 'textarea',
      required: true,
      options: [],
      source: 'manual',
      rationale: '',
    }])
  }

  const updateQuestion = (index, updates) => {
    setCustomQuestions(prev => prev.map((q, i) =>
      i === index ? { ...q, ...updates } : q
    ))
  }

  const removeQuestion = (index) => {
    setCustomQuestions(prev => prev.filter((_, i) => i !== index))
  }

  const moveQuestion = (index, direction) => {
    const newIdx = index + direction
    if (newIdx < 0 || newIdx >= customQuestions.length) return
    const arr = [...customQuestions]
    ;[arr[index], arr[newIdx]] = [arr[newIdx], arr[index]]
    setCustomQuestions(arr)
  }

  // ── AI suggestion ────────────────────────────────────────────────────────
  const handleAiSuggest = async () => {
    setAiLoading(true)
    try {
      // Fetch role context and scoring criteria
      const { data: role } = await supabase
        .from('roles')
        .select('title, department, job_context')
        .eq('id', roleId)
        .single()

      const { data: jd } = await supabase
        .from('job_descriptions')
        .select('scoring_criteria')
        .eq('role_id', roleId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const suggestions = await suggestPrescreeningQuestions(
        role,
        jd?.scoring_criteria || null,
        customQuestions
      )

      // Append AI suggestions to existing custom questions
      setCustomQuestions(prev => [...prev, ...suggestions])
    } catch (err) {
      console.error('[PrescreeningTemplateEditor] AI suggestion failed:', err)
      alert('Failed to generate AI suggestions. Please try again.')
    }
    setAiLoading(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--stone)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 12, marginTop: 8 }}>Loading template…</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Section: Standard Fields ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={h4Style}>Standard Fields</h4>
          <span style={{ fontSize: 11, color: 'var(--stone)' }}>
            Toggle fields on/off for this role's prescreening form
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {fixedFields.map((field, i) => (
            <div key={field.field_key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', background: 'var(--sand-light)',
              border: '1px solid var(--sand-dark)', borderRadius: 6,
              opacity: field.enabled === false ? 0.5 : 1,
            }}>
              {/* Enable toggle */}
              <input
                type="checkbox"
                checked={field.enabled !== false}
                onChange={() => toggleField(i, 'enabled')}
                style={{ accentColor: 'var(--teal)', cursor: 'pointer' }}
              />
              {/* Label */}
              <span style={{ flex: 1, fontSize: 12.5, color: 'var(--charcoal)' }}>
                {field.label}
              </span>
              {/* Type badge */}
              <span style={{
                fontSize: 10, color: 'var(--stone)',
                background: 'rgba(154,143,128,0.1)',
                padding: '2px 6px', borderRadius: 3,
              }}>
                {field.type}
              </span>
              {/* Required toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--stone)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={() => toggleField(i, 'required')}
                  style={{ accentColor: 'var(--teal)', cursor: 'pointer' }}
                />
                Required
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section: Custom Questions ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={h4Style}>
            Technical / Case-Study Questions
            <span style={{ fontWeight: 400, color: 'var(--stone)', marginLeft: 6 }}>
              ({customQuestions.length})
            </span>
          </h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={aiLoading}
              style={btnSmall}
            >
              {aiLoading
                ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} />Generating…</>
                : <><Wand2 size={12} style={{ marginRight: 4 }} />Suggest with AI</>
              }
            </button>
            <button
              type="button"
              onClick={addCustomQuestion}
              style={btnSmall}
            >
              <Plus size={12} style={{ marginRight: 4 }} />Add Question
            </button>
          </div>
        </div>

        {customQuestions.length === 0 ? (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            border: '1px dashed var(--sand-dark)', borderRadius: 8,
            color: 'var(--stone)', fontSize: 12.5,
          }}>
            No custom questions yet. Add manually or let AI suggest role-specific questions.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customQuestions.map((q, i) => (
              <div key={i} style={{
                padding: '12px 14px', border: '1px solid var(--sand-dark)',
                borderRadius: 8, background: q.source === 'ai' ? 'rgba(74,124,116,0.03)' : 'var(--sand-light)',
              }}>
                {/* Question header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--stone)', fontWeight: 600, minWidth: 20, marginTop: 2 }}>
                    Q{i + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <textarea
                      value={q.question}
                      onChange={e => updateQuestion(i, { question: e.target.value })}
                      placeholder="Enter your question…"
                      rows={2}
                      className="form-control"
                      style={{ fontSize: 12.5, resize: 'vertical', minHeight: 44 }}
                    />
                  </div>
                  {/* Move & delete */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0} style={iconBtn}>
                      <ChevronUp size={12} />
                    </button>
                    <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === customQuestions.length - 1} style={iconBtn}>
                      <ChevronDown size={12} />
                    </button>
                  </div>
                  <button type="button" onClick={() => removeQuestion(i)} style={{ ...iconBtn, color: '#C0614A' }}>
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Question settings */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 28 }}>
                  <select
                    value={q.type}
                    onChange={e => updateQuestion(i, { type: e.target.value })}
                    className="form-control"
                    style={{ width: 'auto', fontSize: 11, padding: '3px 8px' }}
                  >
                    {QUESTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--stone)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={e => updateQuestion(i, { required: e.target.checked })}
                      style={{ accentColor: 'var(--teal)' }}
                    />
                    Required
                  </label>
                  {q.source === 'ai' && (
                    <span style={{
                      fontSize: 10, color: 'var(--teal)', background: 'rgba(74,124,116,0.1)',
                      padding: '1px 6px', borderRadius: 3,
                    }}>AI</span>
                  )}
                  {q.rationale && (
                    <span style={{ fontSize: 10.5, color: 'var(--stone)', fontStyle: 'italic', flex: 1 }}>
                      {q.rationale}
                    </span>
                  )}
                </div>

                {/* Options for select type */}
                {q.type === 'select' && (
                  <div style={{ marginLeft: 28, marginTop: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--stone)', display: 'block', marginBottom: 4 }}>
                      Options (comma-separated)
                    </label>
                    <input
                      value={(q.options || []).join(', ')}
                      onChange={e => updateQuestion(i, {
                        options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      className="form-control"
                      style={{ fontSize: 12 }}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: 12, borderTop: '1px solid var(--sand-dark)',
      }}>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          style={{ ...btnSmall, color: 'var(--stone)' }}
        >
          {showPreview ? <><EyeOff size={12} style={{ marginRight: 4 }} />Hide Preview</> : <><Eye size={12} style={{ marginRight: 4 }} />Preview Form</>}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ fontSize: 12.5, padding: '7px 20px', gap: 6 }}
        >
          {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />Saving…</> :
           saved ? <><Check size={13} />Saved</> :
           'Save Prescreening Template'}
        </button>
      </div>

      {/* ── Preview ── */}
      {showPreview && (
        <div style={{
          border: '1px solid var(--sand-dark)', borderRadius: 10,
          padding: '20px 16px', background: '#FAF8F5',
        }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--stone)', marginBottom: 12, fontWeight: 600 }}>
            Candidate Preview
          </p>
          {fixedFields.filter(f => f.enabled !== false).map(f => (
            <div key={f.field_key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#2C2A27', display: 'block', marginBottom: 4 }}>
                {f.label} {f.required && <span style={{ color: '#C0614A' }}>*</span>}
              </label>
              {f.type === 'select' ? (
                <select disabled style={previewInput}>
                  <option>Select…</option>
                  {(f.options || []).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea disabled rows={2} style={{ ...previewInput, resize: 'none' }} placeholder="Candidate types here…" />
              ) : f.type === 'yes_no_detail' ? (
                <div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
                    <label style={{ fontSize: 12.5, color: '#6B6560' }}><input type="radio" disabled /> Yes</label>
                    <label style={{ fontSize: 12.5, color: '#6B6560' }}><input type="radio" disabled /> No</label>
                  </div>
                  <input disabled style={previewInput} placeholder={f.detail_prompt} />
                </div>
              ) : f.type === 'mbti' ? (
                <input disabled style={{ ...previewInput, maxWidth: 120 }} placeholder="e.g. INTJ" />
              ) : (
                <input disabled style={previewInput} placeholder="Candidate types here…" />
              )}
            </div>
          ))}
          {customQuestions.map((q, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: '#2C2A27', display: 'block', marginBottom: 4 }}>
                {q.question || `Question ${i + 1}`} {q.required && <span style={{ color: '#C0614A' }}>*</span>}
              </label>
              {q.type === 'textarea' ? (
                <textarea disabled rows={3} style={{ ...previewInput, resize: 'none' }} placeholder="Candidate types here…" />
              ) : q.type === 'select' ? (
                <select disabled style={previewInput}>
                  <option>Select…</option>
                  {(q.options || []).map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input disabled style={previewInput} placeholder="Candidate types here…" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const h4Style = {
  margin: 0, fontSize: 13, fontWeight: 700,
  color: 'var(--charcoal)', letterSpacing: '0.02em',
}

const btnSmall = {
  display: 'inline-flex', alignItems: 'center',
  background: 'none', border: '1px solid var(--sand-dark)',
  borderRadius: 5, padding: '4px 10px',
  fontSize: 11.5, color: 'var(--charcoal)',
  cursor: 'pointer', fontFamily: 'inherit',
}

const iconBtn = {
  background: 'none', border: 'none',
  cursor: 'pointer', padding: 2, display: 'flex',
  color: 'var(--stone)',
}

const previewInput = {
  width: '100%', padding: '7px 10px',
  border: '1px solid #DDD8D0', borderRadius: 6,
  fontSize: 13, color: '#999', background: '#f5f3f0',
  boxSizing: 'border-box', fontFamily: 'inherit',
}
