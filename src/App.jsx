import { useState } from 'react'
import { useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import KanbanBoard from './components/KanbanBoard'
import CandidatesList from './components/CandidatesList'
import TCOWCalculator from './components/TCOWCalculator'
import RolesManager from './components/RolesManager'
import Analytics from './components/Analytics'
import Import from './components/Import'
import UsersPage from './pages/UsersPage'

export default function App() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (!user) return <LoginPage />

  const pages = {
    dashboard: <Dashboard />,
    pipeline: <KanbanBoard />,
    candidates: <CandidatesList />,
    roles: <RolesManager />,
    tcow: <TCOWCalculator />,
    analytics: <Analytics />,
    import: <Import />,
    users: <UsersPage />,
  }

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {pages[currentPage]}
    </Layout>
  )
}