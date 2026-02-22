import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, X, Check, Link2, Wand2 } from 'lucide-react'

const PRIORITIES = ['Critical', 'Core', 'Support']
const LOCATIONS = ['Lombok', 'Bali', 'Jakarta', 'Surabaya', 'Bandung', 'Yogyakarta', 'Other Indonesia', 'International']
const WORK_ARRANGEMENTS = ['Onsite', 'Remote', 'Hybrid']

const priorityStyle = {
  Critical: { background: 'rgba(192,97,74,0.12)', color: '#C0614A' },
  Core: { background: 'rgba(74,124,116,0.12)', color: '#4A7C74' },
  Support: { background: 'rgba(154,143,128,0.12)', color: '#9A8F80' },
}

const deptStyle = {
  Hospitality: { background: 'rgba(184,150,90,0.12)', color: '#8A6010' },
  Operations: { background: 'rgba(74,124,116,0.12)', color: '#4A7C74' },
  Construction: { background: 'rgba(44,42,39,0.08)', color: '#2C2A27' },
}

const emptyForm = { title: '', department: '', priority: 'Core', status: 'Open', job_context: '', location: 'Lombok', work_arrangement: 'Onsite' }

export default function RolesManager() {
  const [roles, setRoles] = useState([])
  const [candidateCounts, setCandidateCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [filterDept, setFilterDept] = useState('All')
  const [filterStatus, setFilterStatus] = useState('All')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [copied, setCopied] = useState(null) // role.id that was just copied
  const [departments, setDepartments] = useState([])

  useEffect(() => { fetchData(); fetchDepartments() }, [])

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('name').order('name')
    const deptNames = (data || []).map(d => d.name)
    setDepartments(deptNames)
  }

  const fetchData = async () => {
    const [rolesRes, appsRes] = await Promise.all([
      supabase.from('roles').select('*').order('department').order('priority'),
      supabase.from('applications').select('role_id'),
    ])
    setRoles(rolesRes.data || [])
    const counts = {}
    appsRes.data?.forEach(a => {
      counts[a.role_id] = (counts[a.role_id] || 0) + 1
    })
    setCandidateCounts(counts)
    setLoading(false)
  }

  const openAdd = () => {
    setEditingRole(null)
    setForm({ ...emptyForm, department: departments[0] || '' })
    setShowModal(true)
  }

  const openEdit = (role) => {
    setEditingRole(role)
    setForm({ title: role.title, department: role.department, priority: role.priority, status: role.status, job_context: role.job_context || '', location: role.location || 'Lombok', work_arrangement: role.work_arrangement || 'Onsite' })
    setShowModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    if (editingRole) {
      await supabase.from('roles').update(form).eq('id', editingRole.id)
    } else {
      await supabase.from('roles').insert(form)
    }
    setSaving(false)
    setShowModal(false)
    fetchData()
  }

  const toggleStatus = async (role) => {
    const newStatus = role.status === 'Open' ? 'Closed' : 'Open'
    await supabase.from('roles').update({ status: newStatus }).eq('id', role.id)
    fetchData()
  }

  const handleCopyLink = async (role) => {
    const url = `${window.location.origin}/apply/${role.id}`
    await navigator.clipboard.writeText(url)
    setCopied(role.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleDelete = async (id) => {
    await supabase.from('roles').delete().eq('id', id)
    setDeleteConfirm(null)
    fetchData()
  }

  const filtered = roles.filter(r => {
    if (filterDept !== 'All' && r.department !== filterDept) return false
    if (filterStatus !== 'All' && r.status !== filterStatus) return false
    return true
  })

  const openCount = roles.filter(r => r.status === 'Open').length
  const totalCandidates = Object.values(candidateCounts).reduce((a, b) => a + b, 0)

  if (loading) return <div className="loading-state"><div className="spinner" />Loading roles...</div>

  return (
    <div style={{ padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 26, fontWeight: 400, color: '#2C2A27', letterSpacing: '0.02em' }}>
            Roles
          </div>
          <div style={{ fontSize: 12, color: '#9A8F80', marginTop: 3 }}>
            {openCount} open · {roles.length} total · {totalCandidates} candidates
          </div>
        </div>
        <button onClick={openAdd} className="btn btn-primary" style={{ gap: 6 }}>
          <Plus size={14} /> Add Role
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: 160 }}
        >
          <option value="All">All Departments</option>
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="form-control"
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="All">All Status</option>
          <option>Open</option>
          <option>Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Department</th>
              <th>Priority</th>
              <th>Candidates</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(role => (
              <tr
                key={role.id}
                style={{ opacity: role.status === 'Closed' ? 0.5 : 1 }}
              >
                <td style={{ fontWeight: 600, color: '#2C2A27' }}>{role.title}</td>
                <td>
                  <span className="tag" style={deptStyle[role.department]}>
                    {role.department}
                  </span>
                </td>
                <td>
                  <span className="tag" style={priorityStyle[role.priority]}>
                    {role.priority}
                  </span>
                </td>
                <td style={{ color: '#9A8F80' }}>
                  {candidateCounts[role.id] || 0}
                </td>
                <td>
                  <button
                    onClick={() => toggleStatus(role)}
                    className="tag"
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      ...(role.status === 'Open'
                        ? { background: 'rgba(74,124,116,0.12)', color: '#4A7C74' }
                        : { background: 'rgba(154,143,128,0.12)', color: '#9A8F80' }
                      )
                    }}
                  >
                    {role.status}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => openEdit(role)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8F80', padding: 2, display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#2C2A27'}
                      onMouseLeave={e => e.currentTarget.style.color = '#9A8F80'}
                    >
                      <Pencil size={14} />
                    </button>
                    {role.status === 'Open' && (
                      <button
                        onClick={() => handleCopyLink(role)}
                        title={copied === role.id ? 'Copied!' : 'Copy application link'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied === role.id ? '#4A7C74' : '#9A8F80', padding: 2, display: 'flex' }}
                        onMouseEnter={e => { if (copied !== role.id) e.currentTarget.style.color = '#2C2A27' }}
                        onMouseLeave={e => { if (copied !== role.id) e.currentTarget.style.color = '#9A8F80' }}
                      >
                        {copied === role.id ? <Check size={14} /> : <Link2 size={14} />}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // Navigate to Job Creator — parent handles page switching
                        const event = new CustomEvent('navigate-to', { detail: { page: 'jobcreator', roleId: role.id } })
                        window.dispatchEvent(event)
                      }}
                      title="Open in Job Creator"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8F80', padding: 2, display: 'flex' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#4A7C74'}
                      onMouseLeave={e => e.currentTarget.style.color = '#9A8F80'}
                    >
                      <Wand2 size={14} />
                    </button>
                    {deleteConfirm === role.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          onClick={() => handleDelete(role.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C0614A', padding: 2, display: 'flex' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8F80', padding: 2, display: 'flex' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(role.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A8F80', padding: 2, display: 'flex' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#C0614A'}
                        onMouseLeave={e => e.currentTarget.style.color = '#9A8F80'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-state">No roles found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div className="modal-title">{editingRole ? 'Edit Role' : 'Add Role'}</div>
              <button onClick={() => setShowModal(false)} className="modal-close"><X size={16} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Role Title *</label>
                  <input
                    required
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="form-control"
                    placeholder="e.g. Restaurant Manager"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Department *</label>
                  <select
                    value={form.department}
                    onChange={e => setForm({ ...form, department: e.target.value })}
                    className="form-control"
                  >
                    {departments.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Priority *</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value })}
                    className="form-control"
                  >
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Status *</label>
                  <select
                    value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    className="form-control"
                  >
                    <option>Open</option>
                    <option>Closed</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    Job Context
                    <span style={{ fontWeight: 400, color: 'var(--stone)', marginLeft: 6 }}>
                      — used by AI to generate targeted screening questions
                    </span>
                  </label>
                  <textarea
                    value={form.job_context}
                    onChange={e => setForm({ ...form, job_context: e.target.value })}
                    className="form-control"
                    placeholder={`Paste job requirements here. Include:\n• Must-have skills & tools\n• KPIs and success metrics\n• Seniority level & experience required\n• Culture fit & non-negotiables\n• Team structure & reporting line`}
                    rows={6}
                    style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.6 }}
                  />
                  <p className="form-hint" style={{ marginTop: 4 }}>
                    The more detail you add, the more targeted and role-specific the AI questions will be.
                  </p>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Location</label>
                  <select
                    value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })}
                    className="form-control"
                  >
                    {LOCATIONS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Work Arrangement</label>
                  <select
                    value={form.work_arrangement}
                    onChange={e => setForm({ ...form, work_arrangement: e.target.value })}
                    className="form-control"
                  >
                    {WORK_ARRANGEMENTS.map(wa => <option key={wa}>{wa}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Add Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
