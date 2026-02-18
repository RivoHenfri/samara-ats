import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, Pencil, Check, ChevronDown } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const stageColors = {
  New: 'bg-gray-600',
  Screening: 'bg-blue-600',
  Interview: 'bg-yellow-600',
  Offer: 'bg-purple-600',
  Hired: 'bg-emerald-600',
  Rejected: 'bg-red-600',
}

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']
const ORIGINS = ['Lombok Local', 'Indonesian Expat', 'International']

export default function CandidateDetail({ app, onClose, onUpdated }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [roles, setRoles] = useState([])
  const [editData, setEditData] = useState({
    role_id: app?.role_id || '',
    stage: app?.stage || '',
    whatsapp: app?.candidates?.whatsapp || '',
    origin: app?.candidates?.origin || '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (app) {
      fetchNotes()
      fetchRoles()
    }
  }, [app])

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  const fetchRoles = async () => {
    const { data } = await supabase.from('roles').select('id, title, department').order('title')
    setRoles(data || [])
  }

  const addNote = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    await supabase.from('notes').insert({
      application_id: app.id,
      content: newNote.trim(),
      created_by: 'Satya',
    })
    setNewNote('')
    await fetchNotes()
    setSaving(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote()
  }

  const saveEdit = async () => {
    setSavingEdit(true)
    try {
      // Update application: stage and role_id
      await supabase
        .from('applications')
        .update({ stage: editData.stage, role_id: editData.role_id })
        .eq('id', app.id)

      // Update candidate: whatsapp and origin
      await supabase
        .from('candidates')
        .update({ whatsapp: editData.whatsapp, origin: editData.origin })
        .eq('id', app.candidates?.id)

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
      setEditMode(false)
      if (onUpdated) onUpdated()
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSavingEdit(false)
  }

  if (!app) return null

  const candidate = app.candidates
  const role = app.roles
  const selectedRole = roles.find(r => r.id === editData.role_id) || role

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white">{candidate?.full_name}</h2>
            {!editMode && (
              <>
                <p className="text-gray-400 text-sm mt-0.5">{role?.title} · {role?.department}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs text-white px-2.5 py-1 rounded-full ${stageColors[app.stage]}`}>
                    {app.stage}
                  </span>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${
                    candidate?.origin === 'Lombok Local'
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {candidate?.origin === 'Lombok Local' ? '🏝️ Lombok Local' : '📍 Outside Lombok'}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`p-2 rounded-lg transition-colors ${editMode ? 'bg-emerald-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
              title="Edit profile"
            >
              <Pencil size={16} />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Edit Section */}
        {editMode ? (
          <div className="px-6 py-4 border-b border-gray-700 space-y-3">
            {/* Role */}
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Role</label>
              <div className="relative">
                <select
                  value={editData.role_id}
                  onChange={e => setEditData(d => ({ ...d, role_id: e.target.value }))}
                  className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg outline-none appearance-none pr-8"
                >
                  <option value="">— Select Role —</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.title} ({r.department})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Stage</label>
              <div className="relative">
                <select
                  value={editData.stage}
                  onChange={e => setEditData(d => ({ ...d, stage: e.target.value }))}
                  className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg outline-none appearance-none pr-8"
                >
                  {STAGES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Origin */}
            <div>
              <label className="text-gray-500 text-xs mb-1 block">Origin</label>
              <div className="relative">
                <select
                  value={editData.origin}
                  onChange={e => setEditData(d => ({ ...d, origin: e.target.value }))}
                  className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg outline-none appearance-none pr-8"
                >
                  {ORIGINS.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* WhatsApp */}
            <div>
              <label className="text-gray-500 text-xs mb-1 block">WhatsApp</label>
              <input
                value={editData.whatsapp}
                onChange={e => setEditData(d => ({ ...d, whatsapp: e.target.value }))}
                placeholder="e.g. 08123456789"
                className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg outline-none font-mono"
              />
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors font-medium"
              >
                <Check size={14} />
                {savingEdit ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Candidate Info (read-only) */
          <div className="px-6 py-4 border-b border-gray-700 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs mb-1">WhatsApp</p>
              <p className="text-gray-300 font-mono">{candidate?.whatsapp || '—'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Applied</p>
              <p className="text-gray-300">{format(new Date(app.created_at), 'dd MMM yyyy')}</p>
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Notes ({notes.length})
          </h3>
          {notes.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-6">No notes yet. Add the first one below!</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-gray-800 rounded-xl p-4">
                  <p className="text-white text-sm leading-relaxed">{note.content}</p>
                  <p className="text-gray-500 text-xs mt-2">
                    {note.created_by} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Note Input */}
        <div className="p-6 border-t border-gray-700">
          <div className="flex gap-2">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note... (Ctrl+Enter to save)"
              rows={2}
              className="flex-1 bg-gray-800 text-white text-sm px-4 py-2.5 rounded-xl outline-none resize-none placeholder-gray-500"
            />
            <button
              onClick={addNote}
              disabled={saving || !newNote.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-gray-600 text-xs mt-1.5">Ctrl+Enter to save quickly</p>
        </div>
      </div>
    </div>
  )
}