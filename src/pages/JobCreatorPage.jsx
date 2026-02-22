/**
 * Job Creator Page — 5-step wizard
 *
 * Step 1: Input (role title, department, location, work arrangement, context)
 * Step 2: Review & edit structured JD
 * Step 3: Review & edit 4 formatted channel versions + copy-to-clipboard
 * Step 4: Bahasa Indonesia localization toggle (EN ↔ ID) with in-line editing
 * Step 5: Scoring criteria review + weight sliders + publish
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { generateJobDescription } from '../lib/generateJobDescription'
import { formatJobDescription } from '../lib/formatJobDescription'
import { localizeJobDescription, isIndonesianLocation } from '../lib/localizeJobDescription'
import { extractScoringCriteria } from '../lib/extractScoringCriteria'
import {
    Wand2, ArrowRight, ArrowLeft, Check, Copy, Loader2, AlertTriangle,
    FileText, MessageSquare, Linkedin, Globe, Languages, Scale,
    Plus, Trash2, GripVertical, Sparkles, ChevronDown,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const LOCATIONS = [
    'Lombok', 'Bali', 'Jakarta', 'Surabaya', 'Bandung',
    'Yogyakarta', 'Other Indonesia', 'International',
]

const WORK_ARRANGEMENTS = ['Onsite', 'Remote', 'Hybrid']

const STEPS = [
    { label: 'Input', icon: FileText },
    { label: 'Job Description', icon: Wand2 },
    { label: 'Channel Formats', icon: MessageSquare },
    { label: 'Localization', icon: Languages },
    { label: 'Scoring & Publish', icon: Scale },
]

const CHANNEL_TABS = [
    { key: 'formatted_internal', label: 'Internal', icon: FileText },
    { key: 'formatted_whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { key: 'formatted_linkedin', label: 'LinkedIn', icon: Linkedin },
    { key: 'formatted_job_board', label: 'Job Board', icon: Globe },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function useCopyToClipboard() {
    const [copied, setCopied] = useState(null)
    const copy = async (text, key) => {
        await navigator.clipboard.writeText(text)
        setCopied(key)
        setTimeout(() => setCopied(null), 2000)
    }
    return { copied, copy }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function JobCreatorPage() {
    // ── Wizard state
    const [step, setStep] = useState(0)
    const [generating, setGenerating] = useState(false)
    const [genStep, setGenStep] = useState('')   // which AI step is running
    const [error, setError] = useState(null)
    const [publishing, setPublishing] = useState(false)
    const [published, setPublished] = useState(false)

    // ── Departments (dynamic)
    const [departments, setDepartments] = useState([])
    const [newDept, setNewDept] = useState('')
    const [showDeptInput, setShowDeptInput] = useState(false)

    // ── Step 1: Input
    const [form, setForm] = useState({
        title: '',
        department: '',
        location: 'Lombok',
        workArrangement: 'Onsite',
        jobContext: '',
    })

    // ── Step 2: Structured JD
    const [structuredJD, setStructuredJD] = useState(null)

    // ── Step 3: Formatted versions
    const [formatted, setFormatted] = useState(null)
    const [activeTab, setActiveTab] = useState('formatted_internal')

    // ── Step 4: Bahasa versions
    const [bahasaData, setBahasaData] = useState(null)
    const [langView, setLangView] = useState('en') // 'en' | 'id'
    const needsBahasa = isIndonesianLocation(form.location)

    // ── Step 5: Scoring
    const [scoringCriteria, setScoringCriteria] = useState(null)
    const [weights, setWeights] = useState({ must_have: 0.55, nice_to_have: 0.25, salary_alignment: 0.20 })

    const { copied, copy } = useCopyToClipboard()

    // ── Load departments ────────────────────────────────────────────────────────

    useEffect(() => {
        loadDepartments()
    }, [])

    const loadDepartments = async () => {
        const { data } = await supabase.from('departments').select('*').order('name')
        if (data) {
            setDepartments(data)
            if (!form.department && data.length > 0) {
                setForm(f => ({ ...f, department: data[0].name }))
            }
        }
    }

    const addDepartment = async () => {
        const trimmed = newDept.trim()
        if (!trimmed) return
        await supabase.from('departments').insert({ name: trimmed })
        setNewDept('')
        setShowDeptInput(false)
        await loadDepartments()
        setForm(f => ({ ...f, department: trimmed }))
    }

    // ── Generation pipeline ─────────────────────────────────────────────────────

    const handleGenerate = async () => {
        setGenerating(true)
        setError(null)

        try {
            // Step 1: Generate structured JD
            setGenStep('Generating job description…')
            const jd = await generateJobDescription(form)
            setStructuredJD(jd)

            // Step 2: Format for channels
            setGenStep('Formatting for distribution channels…')
            const fmt = await formatJobDescription(jd, form.title, form.department)
            setFormatted(fmt)

            // Step 3: Localize if Indonesian
            if (needsBahasa) {
                setGenStep('Translating to Bahasa Indonesia…')
                const bahasa = await localizeJobDescription(jd, fmt)
                setBahasaData(bahasa)
            }

            // Step 4: Extract scoring criteria
            setGenStep('Extracting scoring criteria…')
            const criteria = await extractScoringCriteria(jd, form.jobContext)
            setScoringCriteria(criteria)
            if (criteria.default_weights) {
                setWeights(criteria.default_weights)
            }

            setStep(1) // move to JD review
        } catch (err) {
            setError(err.message || 'Generation failed. Please try again.')
        }

        setGenerating(false)
        setGenStep('')
    }

    // ── Publish ─────────────────────────────────────────────────────────────────

    const handlePublish = async () => {
        setPublishing(true)
        setError(null)

        try {
            // 1. Create/update the role
            const rolePayload = {
                title: form.title,
                department: form.department,
                location: form.location,
                work_arrangement: form.workArrangement,
                job_context: form.jobContext,
                scoring_weights: weights,
                status: 'Open',
                priority: 'Core',
            }

            const { data: role, error: roleErr } = await supabase
                .from('roles')
                .insert(rolePayload)
                .select()
                .single()

            if (roleErr) throw new Error(roleErr.message)

            // 2. Save job description
            const jdPayload = {
                role_id: role.id,
                structured_jd: structuredJD,
                formatted_internal: formatted.formatted_internal,
                formatted_whatsapp: formatted.formatted_whatsapp,
                formatted_linkedin: formatted.formatted_linkedin,
                formatted_job_board: formatted.formatted_job_board,
                structured_jd_id: bahasaData?.structured_jd_id || null,
                formatted_internal_id: bahasaData?.formatted_internal_id || null,
                formatted_whatsapp_id: bahasaData?.formatted_whatsapp_id || null,
                formatted_linkedin_id: bahasaData?.formatted_linkedin_id || null,
                formatted_job_board_id: bahasaData?.formatted_job_board_id || null,
                scoring_criteria: scoringCriteria,
                generation_metadata: {
                    generated_at: new Date().toISOString(),
                    model: 'claude-sonnet-4-6',
                    steps_completed: ['jd', 'format', ...(needsBahasa ? ['localize'] : []), 'scoring'],
                },
            }

            const { error: jdErr } = await supabase.from('job_descriptions').insert(jdPayload)
            if (jdErr) throw new Error(jdErr.message)

            setPublished(true)
        } catch (err) {
            setError(err.message || 'Publishing failed. Please try again.')
        }

        setPublishing(false)
    }

    // ── Weight slider handler (enforce sum = 1.0) ──────────────────────────────

    const handleWeightChange = (key, value) => {
        const numVal = parseFloat(value)
        if (isNaN(numVal) || numVal < 0 || numVal > 1) return

        const otherKeys = Object.keys(weights).filter(k => k !== key)
        const remaining = 1 - numVal
        const otherSum = otherKeys.reduce((s, k) => s + weights[k], 0)

        const newWeights = { ...weights, [key]: numVal }
        if (otherSum > 0) {
            otherKeys.forEach(k => {
                newWeights[k] = Math.round((weights[k] / otherSum) * remaining * 100) / 100
            })
        } else {
            otherKeys.forEach((k, i) => {
                newWeights[k] = Math.round((remaining / otherKeys.length) * 100) / 100
            })
        }
        // Fix rounding to ensure sum = 1.0
        const sum = Object.values(newWeights).reduce((s, v) => s + v, 0)
        if (Math.abs(sum - 1) > 0.001) {
            newWeights[otherKeys[0]] += Math.round((1 - sum) * 100) / 100
        }
        setWeights(newWeights)
    }

    // ── Scoring criteria editor helpers ────────────────────────────────────────

    const updateCriterion = (listKey, index, field, value) => {
        setScoringCriteria(prev => {
            const updated = { ...prev }
            updated[listKey] = [...prev[listKey]]
            updated[listKey][index] = { ...updated[listKey][index], [field]: value }
            return updated
        })
    }

    const removeCriterion = (listKey, index) => {
        setScoringCriteria(prev => {
            const updated = { ...prev }
            updated[listKey] = prev[listKey].filter((_, i) => i !== index)
            return updated
        })
    }

    const addCriterion = (listKey) => {
        setScoringCriteria(prev => {
            const updated = { ...prev }
            updated[listKey] = [...prev[listKey], { criterion: '', type: 'skill', threshold: '' }]
            return updated
        })
    }

    // ── Render: Published success ──────────────────────────────────────────────

    if (published) {
        return (
            <div style={styles.page}>
                <div style={styles.successCard}>
                    <div style={styles.successIcon}>
                        <Check size={28} />
                    </div>
                    <h2 style={styles.successTitle}>Role Published Successfully</h2>
                    <p style={styles.successText}>
                        <strong>{form.title}</strong> has been created with a full job description,
                        4 channel-optimized formats{needsBahasa ? ', Bahasa Indonesia translations,' : ''} and
                        structured scoring criteria.
                    </p>
                    <button
                        onClick={() => {
                            setStep(0)
                            setStructuredJD(null)
                            setFormatted(null)
                            setBahasaData(null)
                            setScoringCriteria(null)
                            setPublished(false)
                            setForm({ title: '', department: departments[0]?.name || '', location: 'Lombok', workArrangement: 'Onsite', jobContext: '' })
                        }}
                        className="btn btn-primary"
                        style={{ marginTop: 16 }}
                    >
                        <Plus size={14} /> Create Another Role
                    </button>
                </div>
            </div>
        )
    }

    // ── Render: Main wizard ────────────────────────────────────────────────────

    return (
        <div style={styles.page}>

            {/* ── Header ── */}
            <div style={styles.header}>
                <div>
                    <div style={styles.pageTitle}>Job Creator</div>
                    <div style={styles.pageSubtitle}>
                        AI-powered job description generation, formatting, and scoring setup
                    </div>
                </div>
            </div>

            {/* ── Progress stepper ── */}
            <div style={styles.stepper}>
                {STEPS.map((s, i) => {
                    // Skip localization step if not Indonesian
                    if (i === 3 && !needsBahasa) return null
                    const isActive = i === step
                    const isDone = i < step
                    const Icon = s.icon
                    return (
                        <button
                            key={i}
                            onClick={() => { if (isDone) setStep(i) }}
                            disabled={!isDone && !isActive}
                            style={{
                                ...styles.stepItem,
                                ...(isActive ? styles.stepActive : {}),
                                ...(isDone ? styles.stepDone : {}),
                                cursor: isDone ? 'pointer' : 'default',
                            }}
                        >
                            <div style={{
                                ...styles.stepCircle,
                                ...(isActive ? styles.stepCircleActive : {}),
                                ...(isDone ? styles.stepCircleDone : {}),
                            }}>
                                {isDone ? <Check size={12} /> : <Icon size={12} />}
                            </div>
                            <span style={styles.stepLabel}>{s.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div style={styles.errorBanner}>
                    <AlertTriangle size={14} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} style={styles.errorClose}>×</button>
                </div>
            )}

            {/* ── Step content ── */}
            <div style={styles.content}>

                {/* ═══════ STEP 0: INPUT ═══════ */}
                {step === 0 && (
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Role Details</h3>
                            <p style={styles.cardHint}>
                                Provide the strategic context — the AI handles the rest.
                            </p>
                        </div>
                        <div style={styles.formGrid}>
                            {/* Title */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Role Title *</label>
                                <input
                                    value={form.title}
                                    onChange={e => setForm({ ...form, title: e.target.value })}
                                    className="form-control"
                                    placeholder="e.g. Restaurant Manager"
                                    style={styles.input}
                                />
                            </div>

                            {/* Department */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Department *</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <select
                                        value={form.department}
                                        onChange={e => setForm({ ...form, department: e.target.value })}
                                        className="form-control"
                                        style={{ ...styles.input, flex: 1 }}
                                    >
                                        {departments.map(d => (
                                            <option key={d.id} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                    {!showDeptInput ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowDeptInput(true)}
                                            className="btn btn-ghost btn-sm"
                                            style={{ flexShrink: 0, fontSize: 11 }}
                                        >
                                            <Plus size={12} /> New
                                        </button>
                                    ) : (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <input
                                                value={newDept}
                                                onChange={e => setNewDept(e.target.value)}
                                                className="form-control"
                                                placeholder="Name"
                                                style={{ ...styles.input, width: 120 }}
                                                onKeyDown={e => { if (e.key === 'Enter') addDepartment() }}
                                                autoFocus
                                            />
                                            <button onClick={addDepartment} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                                                Add
                                            </button>
                                            <button onClick={() => { setShowDeptInput(false); setNewDept('') }} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>
                                                ×
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Location */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Location *</label>
                                <select
                                    value={form.location}
                                    onChange={e => setForm({ ...form, location: e.target.value })}
                                    className="form-control"
                                    style={styles.input}
                                >
                                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                                </select>
                            </div>

                            {/* Work Arrangement */}
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Work Arrangement</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {WORK_ARRANGEMENTS.map(wa => (
                                        <button
                                            key={wa}
                                            type="button"
                                            onClick={() => setForm({ ...form, workArrangement: wa })}
                                            style={{
                                                ...styles.waBtn,
                                                ...(form.workArrangement === wa ? styles.waBtnActive : {}),
                                            }}
                                        >
                                            {wa}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Job Context */}
                        <div style={{ ...styles.formGroup, marginTop: 8 }}>
                            <label style={styles.label}>
                                Job Context
                                <span style={styles.labelHint}>
                                    — business background, must-have skills, KPIs, team structure, urgency
                                </span>
                            </label>
                            <textarea
                                value={form.jobContext}
                                onChange={e => setForm({ ...form, jobContext: e.target.value })}
                                className="form-control"
                                placeholder={`Paste or type the strategic context here. Examples:\n• Must manage a 30-seat beachfront restaurant with 8 direct reports\n• Need someone who's built an F&B operation from scratch\n• Reports to GM, critical hire — current manager leaving in 6 weeks\n• Non-negotiable: food safety cert, Bahasa fluency\n• Nice-to-have: experience with island/remote operations`}
                                rows={7}
                                style={{ ...styles.input, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                            />
                        </div>

                        {/* Generate button */}
                        <div style={styles.cardFooter}>
                            <button
                                onClick={handleGenerate}
                                disabled={generating || !form.title.trim() || !form.department}
                                className="btn btn-primary"
                                style={{ gap: 8, fontSize: 13.5, padding: '10px 24px' }}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                                        {genStep}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={15} />
                                        Generate Job Description
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 1: REVIEW & EDIT JD ═══════ */}
                {step === 1 && structuredJD && (
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>
                                {form.title}
                                <span style={styles.titleBadge}>{form.department}</span>
                            </h3>
                            <p style={styles.cardHint}>
                                Review and edit the generated job description. All fields are editable.
                            </p>
                        </div>

                        <div style={styles.jdSections}>
                            {/* Role Summary */}
                            <JDSection
                                title="Role Summary"
                                value={structuredJD.role_summary}
                                onChange={val => setStructuredJD({ ...structuredJD, role_summary: val })}
                                multiline
                            />

                            {/* Key Responsibilities */}
                            <JDListSection
                                title="Key Responsibilities"
                                items={structuredJD.key_responsibilities || []}
                                onChange={items => setStructuredJD({ ...structuredJD, key_responsibilities: items })}
                            />

                            {/* Required Qualifications */}
                            <JDListSection
                                title="Required Qualifications"
                                items={structuredJD.required_qualifications || []}
                                onChange={items => setStructuredJD({ ...structuredJD, required_qualifications: items })}
                            />

                            {/* Preferred Qualifications */}
                            <JDListSection
                                title="Preferred Qualifications"
                                items={structuredJD.preferred_qualifications || []}
                                onChange={items => setStructuredJD({ ...structuredJD, preferred_qualifications: items })}
                            />

                            {/* Skills */}
                            <div style={styles.jdSection}>
                                <div style={styles.sectionHeader}>Required Skills</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {(structuredJD.required_skills || []).map((s, i) => (
                                        <span key={i} style={{
                                            ...styles.skillTag,
                                            ...(s.category === 'soft' ? styles.skillTagSoft : {}),
                                        }}>
                                            {s.skill}
                                            <span style={styles.skillCat}>{s.category}</span>
                                            <button
                                                onClick={() => {
                                                    const updated = structuredJD.required_skills.filter((_, idx) => idx !== i)
                                                    setStructuredJD({ ...structuredJD, required_skills: updated })
                                                }}
                                                style={styles.skillRemove}
                                            >×</button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Metadata row */}
                            <div style={styles.metaRow}>
                                <MetaField label="Experience Level" value={structuredJD.experience_level}
                                    onChange={val => setStructuredJD({ ...structuredJD, experience_level: val })} />
                                <MetaField label="Reporting Structure" value={structuredJD.reporting_structure}
                                    onChange={val => setStructuredJD({ ...structuredJD, reporting_structure: val })} />
                                <MetaField label="Work Arrangement" value={structuredJD.work_arrangement}
                                    onChange={val => setStructuredJD({ ...structuredJD, work_arrangement: val })} />
                                <MetaField label="Compensation" value={structuredJD.compensation_placeholder}
                                    onChange={val => setStructuredJD({ ...structuredJD, compensation_placeholder: val })} />
                            </div>
                        </div>

                        <div style={styles.cardFooter}>
                            <button onClick={() => setStep(0)} className="btn btn-ghost" style={styles.navBtn}>
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button onClick={() => setStep(2)} className="btn btn-primary" style={styles.navBtn}>
                                Save & Continue <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 2: CHANNEL FORMATS ═══════ */}
                {step === 2 && formatted && (
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Channel Formats</h3>
                            <p style={styles.cardHint}>
                                Each version is optimized for its distribution channel. Edit and copy as needed.
                            </p>
                        </div>

                        {/* Tabs */}
                        <div style={styles.tabs}>
                            {CHANNEL_TABS.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            ...styles.tab,
                                            ...(activeTab === tab.key ? styles.tabActive : {}),
                                        }}
                                    >
                                        <Icon size={13} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Active tab content */}
                        <div style={styles.tabContent}>
                            <textarea
                                value={formatted[activeTab] || ''}
                                onChange={e => setFormatted({ ...formatted, [activeTab]: e.target.value })}
                                style={styles.channelTextarea}
                                rows={16}
                            />
                            <button
                                onClick={() => copy(formatted[activeTab], activeTab)}
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: 8, gap: 6 }}
                            >
                                {copied === activeTab ? (
                                    <><Check size={13} /> Copied!</>
                                ) : (
                                    <><Copy size={13} /> Copy to Clipboard</>
                                )}
                            </button>
                        </div>

                        <div style={styles.cardFooter}>
                            <button onClick={() => setStep(1)} className="btn btn-ghost" style={styles.navBtn}>
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button
                                onClick={() => setStep(needsBahasa ? 3 : 4)}
                                className="btn btn-primary"
                                style={styles.navBtn}
                            >
                                Continue <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 3: LOCALIZATION ═══════ */}
                {step === 3 && needsBahasa && (
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>
                                <Languages size={18} style={{ color: 'var(--teal)' }} />
                                Bahasa Indonesia
                            </h3>
                            <p style={styles.cardHint}>
                                Toggle between English and Bahasa Indonesia versions. Both are fully editable.
                            </p>
                        </div>

                        {/* Language toggle */}
                        <div style={styles.langToggle}>
                            <button
                                onClick={() => setLangView('en')}
                                style={{ ...styles.langBtn, ...(langView === 'en' ? styles.langBtnActive : {}) }}
                            >
                                🇬🇧 English
                            </button>
                            <button
                                onClick={() => setLangView('id')}
                                style={{ ...styles.langBtn, ...(langView === 'id' ? styles.langBtnActive : {}) }}
                            >
                                🇮🇩 Bahasa Indonesia
                            </button>
                        </div>

                        {/* Tabs for each channel */}
                        <div style={styles.tabs}>
                            {CHANNEL_TABS.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        style={{
                                            ...styles.tab,
                                            ...(activeTab === tab.key ? styles.tabActive : {}),
                                        }}
                                    >
                                        <Icon size={13} />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>

                        <div style={styles.tabContent}>
                            {langView === 'en' ? (
                                <textarea
                                    value={formatted?.[activeTab] || ''}
                                    onChange={e => setFormatted({ ...formatted, [activeTab]: e.target.value })}
                                    style={styles.channelTextarea}
                                    rows={16}
                                />
                            ) : (
                                <textarea
                                    value={bahasaData?.[activeTab + '_id'] || ''}
                                    onChange={e => setBahasaData({ ...bahasaData, [activeTab + '_id']: e.target.value })}
                                    style={styles.channelTextarea}
                                    rows={16}
                                />
                            )}
                            <button
                                onClick={() => {
                                    const text = langView === 'en'
                                        ? formatted?.[activeTab]
                                        : bahasaData?.[activeTab + '_id']
                                    copy(text || '', activeTab + langView)
                                }}
                                className="btn btn-ghost btn-sm"
                                style={{ marginTop: 8, gap: 6 }}
                            >
                                {copied === activeTab + langView ? (
                                    <><Check size={13} /> Copied!</>
                                ) : (
                                    <><Copy size={13} /> Copy to Clipboard</>
                                )}
                            </button>
                        </div>

                        <div style={styles.cardFooter}>
                            <button onClick={() => setStep(2)} className="btn btn-ghost" style={styles.navBtn}>
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button onClick={() => setStep(4)} className="btn btn-primary" style={styles.navBtn}>
                                Continue <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 4: SCORING & PUBLISH ═══════ */}
                {step === 4 && scoringCriteria && (
                    <div style={styles.card}>
                        <div style={styles.cardHeader}>
                            <h3 style={styles.cardTitle}>Scoring Criteria & Weights</h3>
                            <p style={styles.cardHint}>
                                Review the extracted criteria and adjust weights before publishing.
                                These feed directly into the candidate compatibility scoring engine.
                            </p>
                        </div>

                        {/* Must-have criteria */}
                        <CriteriaList
                            title="Must-Have Criteria"
                            subtitle="Non-negotiable — candidates missing these score ≤ 40"
                            items={scoringCriteria.must_have_criteria || []}
                            listKey="must_have_criteria"
                            onUpdate={updateCriterion}
                            onRemove={removeCriterion}
                            onAdd={addCriterion}
                            accentColor="var(--alert)"
                        />

                        {/* Nice-to-have criteria */}
                        <CriteriaList
                            title="Nice-to-Have Criteria"
                            subtitle="Preferred but not disqualifying"
                            items={scoringCriteria.nice_to_have_criteria || []}
                            listKey="nice_to_have_criteria"
                            onUpdate={updateCriterion}
                            onRemove={removeCriterion}
                            onAdd={addCriterion}
                            accentColor="var(--gold)"
                        />

                        {/* Weight sliders */}
                        <div style={styles.weightsSection}>
                            <div style={styles.sectionHeader}>
                                <Scale size={13} /> Scoring Weights
                            </div>
                            <p style={styles.weightsHint}>
                                Adjust how much each dimension counts toward the overall score. Must sum to 100%.
                            </p>
                            {[
                                { key: 'must_have', label: 'Must-Have Match', color: 'var(--teal)' },
                                { key: 'nice_to_have', label: 'Nice-to-Have Match', color: 'var(--gold)' },
                                { key: 'salary_alignment', label: 'Salary Alignment', color: 'var(--stone)' },
                            ].map(({ key, label, color }) => (
                                <div key={key} style={styles.weightRow}>
                                    <span style={styles.weightLabel}>{label}</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={weights[key]}
                                        onChange={e => handleWeightChange(key, e.target.value)}
                                        style={{ flex: 1, accentColor: color }}
                                    />
                                    <span style={{ ...styles.weightValue, color }}>
                                        {Math.round(weights[key] * 100)}%
                                    </span>
                                </div>
                            ))}
                            <div style={styles.weightTotal}>
                                Total: {Math.round((weights.must_have + weights.nice_to_have + weights.salary_alignment) * 100)}%
                            </div>
                        </div>

                        <div style={styles.cardFooter}>
                            <button
                                onClick={() => setStep(needsBahasa ? 3 : 2)}
                                className="btn btn-ghost"
                                style={styles.navBtn}
                            >
                                <ArrowLeft size={14} /> Back
                            </button>
                            <button
                                onClick={handlePublish}
                                disabled={publishing}
                                className="btn btn-primary"
                                style={{ ...styles.navBtn, fontSize: 13.5, padding: '10px 28px' }}
                            >
                                {publishing ? (
                                    <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Publishing…</>
                                ) : (
                                    <><Check size={15} /> Publish Role</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function JDSection({ title, value, onChange, multiline }) {
    return (
        <div style={styles.jdSection}>
            <div style={styles.sectionHeader}>{title}</div>
            {multiline ? (
                <textarea
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="form-control"
                    style={{ ...styles.input, resize: 'vertical', lineHeight: 1.6, minHeight: 80 }}
                    rows={3}
                />
            ) : (
                <input
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="form-control"
                    style={styles.input}
                />
            )}
        </div>
    )
}

function JDListSection({ title, items, onChange }) {
    const update = (i, val) => {
        const next = [...items]
        next[i] = val
        onChange(next)
    }
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
    const add = () => onChange([...items, ''])

    return (
        <div style={styles.jdSection}>
            <div style={styles.sectionHeader}>{title}</div>
            {items.map((item, i) => (
                <div key={i} style={styles.listRow}>
                    <span style={styles.listBullet}>{i + 1}</span>
                    <input
                        value={item}
                        onChange={e => update(i, e.target.value)}
                        className="form-control"
                        style={{ ...styles.input, flex: 1 }}
                    />
                    <button onClick={() => remove(i)} style={styles.listRemove}>
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button onClick={add} className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 11, gap: 4 }}>
                <Plus size={11} /> Add item
            </button>
        </div>
    )
}

function MetaField({ label, value, onChange }) {
    return (
        <div style={{ flex: '1 1 200px' }}>
            <label style={{ ...styles.label, fontSize: 10.5, marginBottom: 4 }}>{label}</label>
            <input
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                className="form-control"
                style={{ ...styles.input, fontSize: 12 }}
            />
        </div>
    )
}

function CriteriaList({ title, subtitle, items, listKey, onUpdate, onRemove, onAdd, accentColor }) {
    return (
        <div style={{ ...styles.criteriaSection, borderLeftColor: accentColor }}>
            <div style={{ ...styles.sectionHeader, color: accentColor }}>{title}</div>
            <p style={styles.criteriaSubtitle}>{subtitle}</p>
            {items.map((item, i) => (
                <div key={i} style={styles.criteriaRow}>
                    <input
                        value={item.criterion}
                        onChange={e => onUpdate(listKey, i, 'criterion', e.target.value)}
                        className="form-control"
                        style={{ ...styles.input, flex: 2 }}
                        placeholder="Criterion"
                    />
                    <select
                        value={item.type}
                        onChange={e => onUpdate(listKey, i, 'type', e.target.value)}
                        className="form-control"
                        style={{ ...styles.input, flex: 0, width: 120, minWidth: 120 }}
                    >
                        <option value="skill">Skill</option>
                        <option value="experience">Experience</option>
                        <option value="education">Education</option>
                        <option value="certification">Certification</option>
                        <option value="behavioral">Behavioral</option>
                    </select>
                    <input
                        value={item.threshold}
                        onChange={e => onUpdate(listKey, i, 'threshold', e.target.value)}
                        className="form-control"
                        style={{ ...styles.input, flex: 1 }}
                        placeholder="Threshold"
                    />
                    <button onClick={() => onRemove(listKey, i)} style={styles.listRemove}>
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button
                onClick={() => onAdd(listKey)}
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 6, fontSize: 11, gap: 4 }}
            >
                <Plus size={11} /> Add criterion
            </button>
        </div>
    )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
    page: {
        padding: '24px 32px',
        maxWidth: 960,
        margin: '0 auto',
    },
    header: {
        marginBottom: 24,
    },
    pageTitle: {
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: 26,
        fontWeight: 400,
        color: '#2C2A27',
        letterSpacing: '0.02em',
    },
    pageSubtitle: {
        fontSize: 12,
        color: '#9A8F80',
        marginTop: 3,
    },

    // Stepper
    stepper: {
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        padding: '12px 16px',
        background: 'var(--sand-light, #FAF8F5)',
        borderRadius: 10,
        border: '1px solid var(--sand-dark, #EBE7E1)',
        overflowX: 'auto',
    },
    stepItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        border: 'none',
        background: 'none',
        borderRadius: 8,
        transition: 'all 0.15s',
        flex: 1,
        minWidth: 0,
    },
    stepActive: {
        background: 'white',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    },
    stepDone: {
        opacity: 0.7,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--sand-dark, #EBE7E1)',
        color: 'var(--stone, #9A8F80)',
        flexShrink: 0,
    },
    stepCircleActive: {
        background: 'var(--teal, #4A7C74)',
        color: 'white',
    },
    stepCircleDone: {
        background: 'rgba(74,124,116,0.15)',
        color: 'var(--teal, #4A7C74)',
    },
    stepLabel: {
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--charcoal, #2C2A27)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },

    // Error
    errorBanner: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        background: 'var(--alert-bg, #FAF0EE)',
        border: '1px solid rgba(192,97,74,0.25)',
        borderRadius: 8,
        marginBottom: 16,
        fontSize: 12.5,
        color: 'var(--alert, #C0614A)',
    },
    errorClose: {
        marginLeft: 'auto',
        background: 'none',
        border: 'none',
        color: 'inherit',
        fontSize: 16,
        cursor: 'pointer',
        padding: '0 4px',
    },

    // Card
    content: {
        minHeight: 400,
    },
    card: {
        background: 'white',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    cardHeader: {
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--sand-dark, #EBE7E1)',
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: 700,
        color: 'var(--charcoal, #2C2A27)',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    titleBadge: {
        fontSize: 10.5,
        fontWeight: 600,
        color: 'var(--teal, #4A7C74)',
        background: 'rgba(74,124,116,0.08)',
        borderRadius: 4,
        padding: '2px 8px',
    },
    cardHint: {
        fontSize: 12,
        color: 'var(--stone, #9A8F80)',
        marginTop: 4,
        lineHeight: 1.5,
    },
    cardFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderTop: '1px solid var(--sand-dark, #EBE7E1)',
        background: 'var(--sand-light, #FAF8F5)',
    },

    // Form
    formGrid: {
        padding: '16px 24px 0',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '14px 20px',
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '0 24px',
    },
    label: {
        fontSize: 11.5,
        fontWeight: 600,
        color: 'var(--charcoal, #2C2A27)',
        letterSpacing: '0.02em',
    },
    labelHint: {
        fontWeight: 400,
        color: 'var(--stone, #9A8F80)',
        marginLeft: 4,
    },
    input: {
        fontSize: 13,
    },

    // Work arrangement buttons
    waBtn: {
        padding: '7px 16px',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 6,
        background: 'white',
        color: 'var(--stone, #9A8F80)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    waBtnActive: {
        background: 'rgba(74,124,116,0.08)',
        borderColor: 'var(--teal, #4A7C74)',
        color: 'var(--teal, #4A7C74)',
        fontWeight: 600,
    },

    // Navigation buttons
    navBtn: {
        gap: 8,
        fontSize: 12.5,
    },

    // JD sections
    jdSections: {
        padding: '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxHeight: '60vh',
        overflowY: 'auto',
    },
    jdSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    sectionHeader: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--stone, #9A8F80)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    listRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    listBullet: {
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'var(--sand, #F2EDE7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--stone, #9A8F80)',
        flexShrink: 0,
    },
    listRemove: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--stone, #9A8F80)',
        padding: 4,
        display: 'flex',
        borderRadius: 4,
        transition: 'color 0.15s',
    },

    // Skills
    skillTag: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 11.5,
        fontWeight: 500,
        background: 'rgba(74,124,116,0.08)',
        color: 'var(--teal, #4A7C74)',
    },
    skillTagSoft: {
        background: 'rgba(184,150,90,0.1)',
        color: '#8A6010',
    },
    skillCat: {
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.7,
    },
    skillRemove: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'inherit',
        opacity: 0.5,
        padding: 0,
        fontSize: 13,
        lineHeight: 1,
    },

    // Meta fields
    metaRow: {
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        padding: '12px 0 0',
        borderTop: '1px solid var(--sand-dark, #EBE7E1)',
    },

    // Channel tabs
    tabs: {
        display: 'flex',
        gap: 2,
        padding: '12px 24px 0',
        borderBottom: '1px solid var(--sand-dark, #EBE7E1)',
    },
    tab: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        border: 'none',
        borderBottom: '2px solid transparent',
        background: 'none',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--stone, #9A8F80)',
        transition: 'all 0.15s',
        marginBottom: -1,
    },
    tabActive: {
        borderBottomColor: 'var(--teal, #4A7C74)',
        color: 'var(--teal, #4A7C74)',
        fontWeight: 600,
    },
    tabContent: {
        padding: '16px 24px',
    },
    channelTextarea: {
        width: '100%',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 8,
        padding: '14px 16px',
        fontSize: 12.5,
        fontFamily: "'Inter', -apple-system, sans-serif",
        lineHeight: 1.7,
        color: 'var(--charcoal, #2C2A27)',
        resize: 'vertical',
        background: 'var(--sand-light, #FAF8F5)',
        outline: 'none',
        boxSizing: 'border-box',
    },

    // Language toggle
    langToggle: {
        display: 'flex',
        gap: 4,
        padding: '12px 24px',
    },
    langBtn: {
        padding: '7px 18px',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 6,
        background: 'white',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--stone, #9A8F80)',
        transition: 'all 0.15s',
    },
    langBtnActive: {
        background: 'rgba(74,124,116,0.08)',
        borderColor: 'var(--teal, #4A7C74)',
        color: 'var(--teal, #4A7C74)',
        fontWeight: 600,
    },

    // Scoring criteria
    criteriaSection: {
        margin: '0 24px',
        padding: '16px',
        borderLeft: '3px solid var(--teal)',
        background: 'var(--sand-light, #FAF8F5)',
        borderRadius: '0 8px 8px 0',
        marginBottom: 16,
    },
    criteriaSubtitle: {
        fontSize: 11.5,
        color: 'var(--stone, #9A8F80)',
        marginTop: 2,
        marginBottom: 12,
    },
    criteriaRow: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 8,
    },

    // Weights
    weightsSection: {
        margin: '0 24px 16px',
        padding: '16px',
        background: 'var(--sand-light, #FAF8F5)',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 8,
    },
    weightsHint: {
        fontSize: 11.5,
        color: 'var(--stone, #9A8F80)',
        marginTop: 4,
        marginBottom: 14,
    },
    weightRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10,
    },
    weightLabel: {
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--charcoal, #2C2A27)',
        width: 140,
        flexShrink: 0,
    },
    weightValue: {
        fontSize: 13,
        fontWeight: 700,
        width: 45,
        textAlign: 'right',
        flexShrink: 0,
    },
    weightTotal: {
        textAlign: 'right',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--stone, #9A8F80)',
        borderTop: '1px solid var(--sand-dark, #EBE7E1)',
        paddingTop: 8,
        marginTop: 4,
    },

    // Success state
    successCard: {
        textAlign: 'center',
        padding: '60px 40px',
        background: 'white',
        border: '1px solid var(--sand-dark, #EBE7E1)',
        borderRadius: 12,
        maxWidth: 480,
        margin: '80px auto',
    },
    successIcon: {
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: 'var(--teal, #4A7C74)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--charcoal, #2C2A27)',
        margin: '0 0 10px',
    },
    successText: {
        fontSize: 13,
        color: 'var(--stone, #9A8F80)',
        lineHeight: 1.6,
    },
}
