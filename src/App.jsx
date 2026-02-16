import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import CandidatesList from './components/CandidatesList'
import TCOWCalculator from './components/TCOWCalculator'
import RolesManager from './components/RolesManager'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!session) return <Auth />

  const pages = {
    dashboard: <Dashboard />,
    pipeline: <KanbanBoard />,
    candidates: <CandidatesList />,
    roles: <RolesManager />,
    tcow: <TCOWCalculator />,
  }

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {pages[currentPage]}
    </Layout>
  )
}