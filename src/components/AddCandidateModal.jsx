import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'

export default function AddCandidateModal({ onClose, onSuccess }) {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    full_name: '',
    whatsapp: '',
    email: '',
    origin: 'Lombok Local',
    role_id: '',
  })

  useEffect(() => {
    supabase.from('roles').select('id, title, department').eq('status', 'Open').then(({ data }) => {
      setRoles(data || [])
      if (data?.length > 0) setForm(f => ({ ...f, role_id: data[0].id }))
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .insert({ full_name: form.full_name, whatsapp: form.whatsapp, email: form.email, origin: form.origin })
      .select()
      .single()

    if (candError) { setError(candError.message); setLoading(false); return }

    const { error: appError } = await supabase
      .from('applications')
      .insert({ candidate_id: candidate.id, role_id: form.role_id, stage: 'New' })

    if (appError) { setError(appError.message); setLoading(false); return }

    setLoading(false)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Add Candidate</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm">{error}</div>}
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Full Name *</label>
            <input
              required
              value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. Budi Santoso"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">WhatsApp</label>
            <input
              value={form.whatsapp}
              onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. 08123456789"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
              placeholder="e.g. budi@email.com"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Origin *</label>
            <select
              value={form.origin}
              onChange={e => setForm({ ...form, origin: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
            >
              <option>Lombok Local</option>
              <option>Indonesian Expat</option>
              <option>International</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-1 block">Applying For *</label>
            <select
              value={form.role_id}
              onChange={e => setForm({ ...form, role_id: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg outline-none"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.title} — {r.department}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg transition-colors">
              {loading ? 'Adding...' : 'Add Candidate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}