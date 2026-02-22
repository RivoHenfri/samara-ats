import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function OAuthCallback() {
    const { provider } = useParams()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()

    const [status, setStatus] = useState('loading')
    const [errorMsg, setErrorMsg] = useState('')
    const exchangeStarted = useRef(false)

    useEffect(() => {
        // Wait for auth session to fully restore before doing anything
        if (authLoading) return

        const code = searchParams.get('code')

        if (!user) {
            setStatus('error')
            setErrorMsg('You must be logged in to connect integrations.')
            return
        }

        if (!code) {
            setStatus('error')
            setErrorMsg(`No authorization code provided by ${provider}.`)
            return
        }

        // Guard: only call exchangeCode once (React effects can re-fire)
        if (exchangeStarted.current) return
        exchangeStarted.current = true

        exchangeCode(code)
    }, [provider, searchParams, user, authLoading])

    const exchangeCode = async (code) => {
        try {
            const redirectUri = `${window.location.origin}/auth/${provider}/callback`

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

            const response = await fetch(`${supabaseUrl}/functions/v1/oauth-callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`,
                },
                body: JSON.stringify({ provider, code, redirectUri, user_id: user.id }),
            })

            if (!response.ok) {
                const errBody = await response.text()
                throw new Error(`Edge Function error (${response.status}): ${errBody}`)
            }

            const data = await response.json()
            if (data?.error) throw new Error(data.error)

            setStatus('success')
            setTimeout(() => {
                navigate('/', { replace: true })
            }, 2000)

        } catch (err) {
            console.error('OAuth Exchange Error:', err)
            setStatus('error')
            setErrorMsg(err.message || 'Failed to exchange authorization code.')
            exchangeStarted.current = false // allow retry
        }
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--sand-light)' }}>
            {status === 'loading' && (
                <>
                    <Loader2 className="animate-spin" size={48} color="var(--primary)" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--charcoal)', textTransform: 'capitalize' }}>
                        Connecting to {provider}...
                    </h2>
                    <p style={{ color: 'var(--stone)', marginTop: 8 }}>Please wait while we secure your connection.</p>
                </>
            )}

            {status === 'success' && (
                <>
                    <CheckCircle size={48} color="var(--hired)" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--charcoal)', textTransform: 'capitalize' }}>
                        {provider} Connected!
                    </h2>
                    <p style={{ color: 'var(--stone)', marginTop: 8 }}>Redirecting you back to the dashboard...</p>
                </>
            )}

            {status === 'error' && (
                <>
                    <XCircle size={48} color="var(--alert)" style={{ marginBottom: 16 }} />
                    <h2 style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--charcoal)' }}>Connection Failed</h2>
                    <p style={{ color: 'var(--stone)', marginTop: 8, maxWidth: 400, textAlign: 'center' }}>{errorMsg}</p>
                    <button
                        onClick={() => navigate('/', { replace: true })}
                        className="btn btn-primary"
                        style={{ marginTop: 24 }}
                    >
                        Return to Dashboard
                    </button>
                </>
            )}
        </div>
    )
}
