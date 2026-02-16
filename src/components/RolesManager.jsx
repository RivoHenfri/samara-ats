import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'

const DEPARTMENTS = ['Hospitality', 'Operations', 'Construction']
const PRIORITIES = ['Critical', 'Core', 'Support']

const priorityColors = {
  Critical: 'bg-red-500/20 text-red-400',
  Core: 'bg-blue-500/20 text-blue-400',
  Support: 'bg-gray-500/20 text-gray-400',
}

const deptColors = {
  Hospitality: 'bg-emerald-500/20 text-emerald-400',
  Operations: 'bg-purple-500/20 text-purple-400',
  Construction: 'bg-yellow-500/20 text-yellow-400',
}

const emptyForm = { title: '', department: 'Hospitality', priority: 'Core', status: 'Open' }

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

  useEffect(() => { fetchData() }, [])

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
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (role) => {
    setEditingRole(role)
    setForm({ title: role.title, department: role.department, priority: role.priority, status: role.status })
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

  if (loading) return <div className="p-8 text-gray-400">Loading roles...</div>

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Roles</h1>
          <p className="text-gray-400 text-sm mt-1">{openCount} open · {roles.length} total · {totalCandidates} candidates</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Role
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm outline-none"
        >
          <option value="All">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm outline-none"
        >
          <option value="All">All Status</option>
          <option>Open</option>
          <option>Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left text-gray-400 text-sm px-4 py-3">Role</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Department</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Priority</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Candidates</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Status</th>
              <th className="text-left text-gray-400 text-sm px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(role => (
              <tr key={role.id} className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${role.status === 'Closed' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 text-white font-medium">{role.title}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${deptColors[role.department]}`}>
                    {role.department}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[role.priority]}`}>
                    {role.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300 text-sm">
                  {candidateCounts[role.id] || 0}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleStatus(role)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                      role.status === 'Open'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/40'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/40'
                    }`}
                  >
                    {role.status}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(role)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    {deleteConfirm === role.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(role.id)} className="text-red-400 hover:text-red-300">
                          <Check size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(role.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
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
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No roles found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">{editingRole ? 'Edit Role' : 'Add Role'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Role Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
                  placeholder="e.g. Restaurant Manager"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Department *</label>
                <select
                  value={form.department}
                  onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
                >
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Priority *</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
                >
                  {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-1 block">Status *</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
                >
                  <option>Open</option>
                  <option>Closed</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg transition-colors">
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