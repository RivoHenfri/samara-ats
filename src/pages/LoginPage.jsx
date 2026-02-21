import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email',
        redirectTo: window.location.origin
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // oauth redirects away, so loading will stay true until unload
  }

  return (
    <div className="login-shell">

      {/* ── LEFT: Brand panel ─────────────────────────── */}
      <div className="login-left">
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div className="login-wordmark">Samara</div>
          <div className="login-tagline">Talent Acquisition System</div>
          <div className="login-divider" />

          <LoginFeature
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            title="350 → 700+ Employees"
            desc="Full-scale hiring across 3 divisions"
          />
          <LoginFeature
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
            title="48-Hour Rule"
            desc="Automated velocity & stagnation tracking"
          />
          <LoginFeature
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
            title="Lombok First"
            desc="Local hiring priority system"
          />
          <LoginFeature
            icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
            title="TCOW Calculator"
            desc="True cost with BPJS, THR & premiums"
          />
        </div>
      </div>

      {/* ── RIGHT: Form panel ─────────────────────────── */}
      <div className="login-right">
        <div style={{ width: '100%' }}>
          <>
            <div className="login-form-title">Welcome back</div>
            <div className="login-form-sub">Sign in with your Samara work email</div>

            <form onSubmit={handleLogin}>
              {error && (
                <p className="form-error" style={{ marginBottom: 10 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-block btn-lg"
                style={{ marginTop: 24 }}
              >
                {loading ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    Redirecting…
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    Sign in with Microsoft
                  </div>
                )}
              </button>
            </form>

            <div className="login-note">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>You will be securely redirected to Microsoft Entra to authenticate.</span>
            </div>

            <p style={{ fontSize: 11, color: 'var(--stone-light)', textAlign: 'center', marginTop: 24 }}>
              Only authorised Samara Lombok team members can access this system
            </p>
          </>
        </div>
      </div>

    </div>
  )
}

// ── helper ────────────────────────────────────────────────────
function LoginFeature({ icon, title, desc }) {
  return (
    <div className="login-feature">
      <div className="login-feat-icon">{icon}</div>
      <div>
        <div className="login-feat-title">{title}</div>
        <div className="login-feat-desc">{desc}</div>
      </div>
    </div>
  )
}
