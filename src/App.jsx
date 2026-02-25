import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
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
import IntegrationsManager from './pages/IntegrationsManager'
import CandidateSchedulingPortal from './pages/CandidateSchedulingPortal'
import OAuthCallback from './pages/OAuthCallback'
import JobCreatorPage from './pages/JobCreatorPage'
import EmployeesPage from './pages/EmployeesPage'
import ProtectedRoute from './components/ProtectedRoute'

function MainWorkspace() {
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')

  if (!user) return <LoginPage />

  const pages = {
    dashboard: <Dashboard setCurrentPage={setCurrentPage} />,
    pipeline: <ProtectedRoute module="applications" action="read"><KanbanBoard /></ProtectedRoute>,
    candidates: <ProtectedRoute module="candidates" action="read"><CandidatesList /></ProtectedRoute>,
    roles: <ProtectedRoute module="roles" action="read"><RolesManager /></ProtectedRoute>,
    tcow: <ProtectedRoute module="settings" action="manage"><TCOWCalculator /></ProtectedRoute>,
    analytics: <ProtectedRoute module="applications" action="read"><Analytics /></ProtectedRoute>,
    import: <ProtectedRoute module="candidates" action="insert"><Import /></ProtectedRoute>,
    users: <ProtectedRoute module="settings" action="manage"><UsersPage /></ProtectedRoute>,
    integrations: <ProtectedRoute module="settings" action="manage"><IntegrationsManager /></ProtectedRoute>,
    jobcreator: <ProtectedRoute module="roles" action="insert"><JobCreatorPage /></ProtectedRoute>,
    employees: <ProtectedRoute module="employees" action="manage"><EmployeesPage /></ProtectedRoute>,
  }


  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {pages[currentPage] || <Dashboard setCurrentPage={setCurrentPage} />}
    </Layout>
  )
}

export default function App() {
  const { loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  return (
    <Routes>
      <Route path="/schedule/:interview_id" element={<CandidateSchedulingPortal />} />
      <Route path="/auth/:provider/callback" element={<OAuthCallback />} />
      <Route path="/*" element={<MainWorkspace />} />
    </Routes>
  )
}