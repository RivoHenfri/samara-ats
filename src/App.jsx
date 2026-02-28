import { Routes, Route, Navigate } from 'react-router-dom'
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
import RejectedPoolPage from './pages/RejectedPoolPage'
import HiredPoolPage from './pages/HiredPoolPage'
import CandidateDetailPage from './pages/CandidateDetailPage'
import CandidateBriefPage from './pages/CandidateBriefPage'
import ProtectedRoute from './components/ProtectedRoute'

function MainWorkspace() {
  const { user } = useAuth()

  if (!user) return <LoginPage />

  return (
    <Layout>
      <Routes>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline/:roleId?" element={
          <ProtectedRoute module="applications" action="read"><KanbanBoard /></ProtectedRoute>
        } />
        <Route path="/candidates/:appId/brief" element={
          <ProtectedRoute module="candidates" action="read"><CandidateBriefPage /></ProtectedRoute>
        } />
        <Route path="/candidates/:appId" element={
          <ProtectedRoute module="candidates" action="read"><CandidateDetailPage /></ProtectedRoute>
        } />
        <Route path="/candidates" element={
          <ProtectedRoute module="candidates" action="read"><CandidatesList /></ProtectedRoute>
        } />
        <Route path="/roles/create" element={
          <ProtectedRoute module="roles" action="insert"><JobCreatorPage /></ProtectedRoute>
        } />
        <Route path="/roles" element={
          <ProtectedRoute module="roles" action="read"><RolesManager /></ProtectedRoute>
        } />
        <Route path="/tcow" element={
          <ProtectedRoute module="settings" action="manage"><TCOWCalculator /></ProtectedRoute>
        } />
        <Route path="/analytics" element={
          <ProtectedRoute module="applications" action="read"><Analytics /></ProtectedRoute>
        } />
        <Route path="/import" element={
          <ProtectedRoute module="candidates" action="insert"><Import /></ProtectedRoute>
        } />
        <Route path="/users" element={
          <ProtectedRoute module="settings" action="manage"><UsersPage /></ProtectedRoute>
        } />
        <Route path="/integrations" element={
          <ProtectedRoute module="settings" action="manage"><IntegrationsManager /></ProtectedRoute>
        } />
        <Route path="/employees" element={
          <ProtectedRoute module="employees" action="manage"><EmployeesPage /></ProtectedRoute>
        } />
        <Route path="/rejected" element={
          <ProtectedRoute module="applications" action="read"><RejectedPoolPage /></ProtectedRoute>
        } />
        <Route path="/hired" element={
          <ProtectedRoute module="applications" action="read"><HiredPoolPage /></ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
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