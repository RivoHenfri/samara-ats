import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CandidateCard from './CandidateCard'
import AddCandidateModal from './AddCandidateModal'
import { Plus, Filter } from 'lucide-react'

const STAGES = ['New', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']

const stageColors = {
  New: 'border-gray-500',
  Screening: 'border-blue-500',
  Interview: 'border-yellow-500',
  Offer: 'border-purple-500',
  Hired: 'border-emerald-500',
  Rejected: 'border-red-500',
}

export default function KanbanBoard() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [lombokOnly, setLombokOnly] = useState(false)
  const [filterDept, setFilterDept] = useState('All')
  const [dragging, setDragging] = useState(null)

  useEffect(() => { fetchApplications() }, [])

  const fetchApplications = async () => {
    const { data } = await supabase
      .from('applications')
      .select('*, candidates(*), roles(*)')
      .order('created_at', { ascending: false })
    setApplications(data || [])
    setLoading(false)
  }

  const handleDragStart = (app) => setDragging(app)

  const handleDrop = async (stage) => {
    if (!dragging || dragging.stage === stage) return
    await supabase.from('applications').update({ stage }).eq('id', dragging.id)
    setDragging(null)
    fetchApplications()
  }

  const filtered = applications.filter(app => {
    if (lombokOnly && app.candidates?.origin !== 'Lombok Local') return false
    if (filterDept !== 'All' && app.roles?.department !== filterDept) return false
    return true
  })

  if (loading) return <div className="p-8 text-gray-400">Loading pipeline...</div>

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Pipeline</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Lombok First Toggle */}
          <button
            onClick={() => setLombokOnly(!lombokOnly)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              lombokOnly ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-400'
            }`}
          >
            🏝️ Lombok First
          </button>
          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm outline-none"
          >
            <option>All</option>
            <option>Hospitality</option>
            <option>Operations</option>
            <option>Construction</option>
          </select>
          {/* Add Candidate */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto flex-1 pb-4">
        {STAGES.map(stage => {
          const cards = filtered.filter(a => a.stage === stage)
          return (
            <div
              key={stage}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
              className={`flex-shrink-0 w-64 bg-gray-800 rounded-xl border-t-4 ${stageColors[stage]} flex flex-col`}
            >
              <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                <span className="text-white font-medium text-sm">{stage}</span>
                <span className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{cards.length}</span>
              </div>
              <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                {cards.map(app => (
                  <CandidateCard
                    key={app.id}
                    app={app}
                    onDragStart={handleDragStart}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="text-gray-600 text-xs text-center py-4">Drop here</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <AddCandidateModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchApplications() }}
        />
      )}
    </div>
  )
}