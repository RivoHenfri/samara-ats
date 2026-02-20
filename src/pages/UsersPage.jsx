import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLES = ['Admin', 'Manager', 'Viewer']

export default function UsersPage() {
  const { isAdmin, profile: myProfile } = useAuth()
  const [users,       setUsers]       = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('Viewer')
  const [inviteName,  setInviteName]  = useState('')
  const [sending,     setSending]     = useState(false)
  const [message,     setMessage]     = useState('')

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    if (data) setUsers(data)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    setSending(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: inviteName, role: inviteRole }
      }
    })
    if (error) setMessage('Error: ' + error.message)
    else setMessage(`Invite sent to ${inviteEmail} as ${inviteRole}`)
    setInviteEmail('')
    setInviteName('')
    setSending(false)
    setTimeout(fetchUsers, 2000)
  }

  const updateRole = async (userId, newRole) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    fetchUsers()
  }

  if (!isAdmin) {
    return (
      <div>
        <div className="topbar">
          <h1 className="page-title">User Management</h1>
        </div>
        <div className="page-body">
          <div className="empty-state">
            Only Admins can manage users.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Topbar ── */}
      <div className="topbar">
        <h1 className="page-title">User Management</h1>
      </div>

      <div className="page-body" style={{ maxWidth: 680 }}>

        {/* Invite form */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">Invite Team Member</span>
          </div>
          <div style={{ padding: '20px' }}>
            <form onSubmit={handleInvite}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rina Dewi"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="rina@samaralombok.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="form-control"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <button
                type="submit"
                disabled={sending}
                className="btn btn-primary btn-block"
              >
                {sending ? (
                  <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</>
                ) : (
                  'Send Magic Link Invite'
                )}
              </button>
              {message && (
                <p style={{
                  marginTop: 10, fontSize: 12,
                  color: message.startsWith('Error') ? 'var(--alert)' : 'var(--teal)',
                }}>
                  {message.startsWith('Error') ? '⚠ ' : '✓ '}{message}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* Users table */}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <p style={{ fontWeight: 600, color: 'var(--charcoal)' }}>
                      {u.full_name || '—'}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--stone)' }}>{u.email}</p>
                  </td>
                  <td>
                    {u.id === myProfile?.id ? (
                      <span className="stage-badge stage-hired">
                        {u.role} (you)
                      </span>
                    ) : (
                      <select
                        value={u.role}
                        onChange={e => updateRole(u.id, e.target.value)}
                        className="form-control"
                        style={{ width: 'auto', padding: '3px 26px 3px 8px', fontSize: 11 }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--stone)' }}>
                    {new Date(u.created_at).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
