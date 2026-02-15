import { formatDistanceToNow } from 'date-fns'
import { Phone, Mail, MapPin, AlertTriangle } from 'lucide-react'

export default function CandidateCard({ application, onClick }) {
  const { candidates: candidate, roles: role, stage, last_stage_change_at } = application

  const hoursStagnant = (new Date() - new Date(last_stage_change_at)) / 36e5
  const isStagnant = hoursStagnant > 48 && !['Offer', 'Hired', 'Rejected'].includes(stage)

  const originColors = {
    'Lombok Local': 'text-emerald-400',
    'Indonesian Expat': 'text-blue-400',
    'International': 'text-purple-400',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition-colors border-l-4 ${
        isStagnant ? 'border-red-500' : 'border-transparent'
      }`}
    >
      {isStagnant && (
        <div className="flex items-center gap-1 text-red-400 text-xs mb-2">
          <AlertTriangle size={12} />
          <span>STAGNANT {Math.floor(hoursStagnant)}h</span>
        </div>
      )}
      <p className="text-white font-medium text-sm truncate">{candidate?.full_name}</p>
      <p className="text-gray-400 text-xs truncate mb-2">{role?.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium ${originColors[candidate?.origin] || 'text-gray-400'}`}>
          <MapPin size={10} className="inline mr-1" />
          {candidate?.origin}
        </span>
      </div>
      <p className="text-gray-500 text-xs mt-2">
        {formatDistanceToNow(new Date(last_stage_change_at), { addSuffix: true })}
      </p>
    </div>
  )
}