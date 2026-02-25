import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { RBACProvider } from './contexts/RBACContext'
import AuthCallback from './pages/AuthCallback'
import CareersPage from './pages/CareersPage'
import ApplyPage from './pages/ApplyPage'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* ── Public routes (no auth required) ── */}
        <Route path="/careers/:tenantSlug" element={<CareersPage />} />
        <Route path="/apply/:roleId" element={<ApplyPage />} />

        {/* ── Auth callback (uses useNavigate, must be inside BrowserRouter) ── */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* ── Admin app (all pages require authentication) ── */}
        <Route path="/*" element={
          <AuthProvider>
            <RBACProvider>
              <App />
            </RBACProvider>
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
