import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useRBAC } from '../contexts/RBACContext'

export default function UsersPage() {
  const { profile: myProfile } = useAuth()
  const { hasPermission } = useRBAC()

  const [users, setUsers] = useState([])
  const [availableRoles, setAvailableRoles] = useState([])
  const [loading, setLoading] = useState(true)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('') // This will now hold a UUID
  const [inviteName, setInviteName] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  // Check if current user is allowed to manage roles
  const canManageSettings = hasPermission('settings', 'manage')

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch the exact list of RBAC roles from the database
      const { data: rolesData, error: rolesError } = await supabase.rpc('get_available_roles')
      if (rolesError) throw rolesError
      setAvailableRoles(rolesData || [])

      // Set default invite role to the lowest permission level (Viewer) if available
      const viewerRole = rolesData?.find(r => r.name.includes('Viewer'))
      if (viewerRole) setInviteRole(viewerRole.id)

      // 2. Fetch the complex user list using the RPC
      const { data: usersData, error: usersError } = await supabase.rpc('get_all_users_with_roles')
      if (usersError) throw usersError
      setUsers(usersData || [])

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canManageSettings) fetchData()
  }, [canManageSettings])

  const handleInvite = async (e) => {
    e.preventDefault()
    setSending(true)
    setMessage('')

    // We pass the new UUID based role through raw_app_meta_data
    const selectedRoleName = availableRoles.find(r => r.id === inviteRole)?.name || 'Viewer'

    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        emailRedirectTo: window.location.origin,
        // The edge function or SQL should listen for this mapping later
        data: { full_name: inviteName, role: selectedRoleName }
      }
    })

    if (error) setMessage('Error: ' + error.message)
    else setMessage(`Invite sent to ${inviteEmail}`)

    setInviteEmail('')
    setInviteName('')
    setSending(false)
  }

  const updateRole = async (userId, newRoleId) => {
    try {
      const { error } = await supabase.rpc('assign_user_role', {
        target_user_id: userId,
        target_role_id: newRoleId
      })

      if (error) throw error

      // Update UI optimistically or refetch
      fetchData()
    } catch (err) {
      alert("Error updating role: " + err.message)
    }
  }

  if (!canManageSettings) {
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

  if (loading) return <div className="p-8 text-stone-400">Loading user matrix...</div>

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
                  <option value="" disabled>Select a role...</option>
                  {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
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
                        {u.role_name} (you)
                      </span>
                    ) : (
                      <select
                        value={u.role_id || ''}
                        onChange={e => updateRole(u.id, e.target.value)}
                        className="form-control"
                        style={{ width: 'auto', padding: '3px 26px 3px 8px', fontSize: 11 }}
                      >
                        <option value="" disabled>Unassigned</option>
                        {availableRoles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--stone)' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID') : '—'}
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
