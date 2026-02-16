import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Send, MessageCircle } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'

const stageColors = {
  New: 'bg-gray-600',
  Screening: 'bg-blue-600',
  Interview: 'bg-yellow-600',
  Offer: 'bg-purple-600',
  Hired: 'bg-emerald-600',
  Rejected: 'bg-red-600',
}

export default function CandidateDetail({ app, onClose }) {
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (app) fetchNotes()
  }, [app])

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('application_id', app.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
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

  if (!app) return null

  const candidate = app.candidates
  const role = app.roles

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">{candidate?.full_name}</h2>
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
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Candidate Info */}
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