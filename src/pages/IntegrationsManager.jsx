import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, Video, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function IntegrationsManager() {
    const { user } = useAuth()
    const [integrations, setIntegrations] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchIntegrations()
    }, [])

    const fetchIntegrations = async () => {
        const { data } = await supabase
            .from('user_integrations')
            .select('*')
            .eq('user_id', user.id)
        setIntegrations(data || [])
        setLoading(false)
    }

    const connectMicrosoft = () => {
        // Implement standard OAuth2 redirect to Microsoft Graph
        window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${import.meta.env.VITE_MS_CLIENT_ID}&response_type=code&redirect_uri=${window.location.origin}/auth/microsoft/callback&response_mode=query&scope=Calendars.ReadWrite%20offline_access`
    }

    const connectZoom = () => {
        // Implement standard OAuth2 redirect for Zoom
        window.location.href = `https://zoom.us/oauth/authorize?response_type=code&client_id=${import.meta.env.VITE_ZOOM_CLIENT_ID}&redirect_uri=${window.location.origin}/auth/zoom/callback`
    }

    const hasIntegration = (provider) => integrations.some(i => i.provider === provider)

    if (loading) return (
        <div className="loading-state">
            <span className="spinner" /> Loading Integrations...
        </div>
    )

    return (
        <div>
            <div className="topbar">
                <h1 className="page-title">Integrations</h1>
                <p style={{ fontSize: 13, color: 'var(--stone)' }}>
                    Connect your tools to automate interview scheduling.
                </p>
            </div>

            <div className="page-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>

                    {/* Microsoft Calendar */}
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0, 114, 198, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Calendar size={24} color="#0072C6" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Microsoft Outlook</h3>
                                <span style={{ fontSize: 12, color: 'var(--stone)' }}>Required for auto-scheduling</span>
                            </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--stone)', lineHeight: 1.5, marginBottom: 20 }}>
                            Sync your availability and automatically create interview calendar events for you and the candidate.
                        </p>
                        {hasIntegration('microsoft') ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: 13, fontWeight: 500 }}>
                                <CheckCircle2 size={16} /> Connected
                            </div>
                        ) : (
                            <button onClick={connectMicrosoft} className="btn btn-primary" style={{ width: '100%' }}>
                                Connect Outlook
                            </button>
                        )}
                    </div>

                    {/* Zoom */}
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(45, 140, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Video size={24} color="#2D8CFF" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Zoom</h3>
                                <span style={{ fontSize: 12, color: 'var(--stone)' }}>Optional</span>
                            </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--stone)', lineHeight: 1.5, marginBottom: 20 }}>
                            Automatically generate and attach a unique Zoom meeting link to scheduled online interviews.
                        </p>
                        {hasIntegration('zoom') ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--teal)', fontSize: 13, fontWeight: 500 }}>
                                    <CheckCircle2 size={16} /> Connected
                                </div>
                                <button onClick={connectZoom} className="btn btn-ghost" style={{ fontSize: 11.5, padding: '4px 12px' }}>
                                    Reconnect
                                </button>
                            </div>
                        ) : (
                            <button onClick={connectZoom} className="btn" style={{ background: '#2D8CFF', color: 'white', width: '100%', border: 'none' }}>
                                Connect Zoom
                            </button>
                        )}
                    </div>

                    {/* WhatsApp / Admin setting only note */}
                    <div className="card" style={{ padding: 24, opacity: 0.7 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(37, 211, 102, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MessageSquare size={24} color="#25D366" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>WhatsApp API</h3>
                                <span style={{ fontSize: 12, color: 'var(--stone)' }}>Workspace Setting</span>
                            </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--stone)', lineHeight: 1.5, marginBottom: 20 }}>
                            Automated interview confirmations and reminders. Configured at the workspace level.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--stone)', fontSize: 13 }}>
                            Contact your administrator to manage setup.
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
