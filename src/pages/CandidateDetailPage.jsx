import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CandidateDetail from '../components/CandidateDetail'

export default function CandidateDetailPage() {
  const { appId } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchApp() {
      setLoading(true)
      const { data, error: fetchErr } = await supabase
        .from('applications')
        .select('*, candidates!inner(*), roles!inner(*)')
        .eq('id', appId)
        .single()

      if (cancelled) return

      if (fetchErr || !data) {
        setError('Application not found')
        setLoading(false)
        return
      }
      setApp(data)
      setLoading(false)
    }

    fetchApp()
    return () => { cancelled = true }
  }, [appId])

  const handleUpdated = () => {
    supabase
      .from('applications')
      .select('*, candidates!inner(*), roles!inner(*)')
      .eq('id', appId)
      .single()
      .then(({ data }) => { if (data) setApp(data) })
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--stone)' }}>
        <span className="spinner" style={{ marginRight: 8 }} /> Loading candidate...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <p style={{ color: 'var(--stone)', fontSize: 14 }}>{error}</p>
        <button onClick={() => navigate('/candidates')} className="btn btn-ghost btn-sm">
          Back to Candidates
        </button>
      </div>
    )
  }

  return (
    <CandidateDetail
      app={app}
      onClose={() => navigate('/candidates')}
      onUpdated={handleUpdated}
    />
  )
}
