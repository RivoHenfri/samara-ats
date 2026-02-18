import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const ROLES = ['Admin', 'Manager', 'Viewer']

export default function UsersPage() {
  const { isAdmin, profile: myProfile } = useAuth()
  const [users, setUsers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Viewer')
  const [inviteName, setInviteName] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

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

    if (error) setMessage('❌ ' + error.message)
    else setMessage(`✅ Invite sent to ${inviteEmail} as ${inviteRole}`)

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
      <div className="p-8 text-slate-500 text-sm">
        Only Admins can manage users.
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-emerald-900 mb-6">User Management</h2>

      <div className="bg-white rounded-xl shadow-sm p-5 mb-6">
        <h3 className="font-semibold text-emerald-800 mb-4">Invite Team Member</h3>
        <form onSubmit={handleInvite} className="space-y-3">
          <input
            type="text"
            placeholder="Full name"
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white placeholder:text-slate-400"
          />
          <input
            type="email"
            required
            placeholder="Email address"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white placeholder:text-slate-400"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            type="submit"
            disabled={sending}
            className="w-full bg-orange-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-orange-800 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Magic Link Invite'}
          </button>
          {message && <p className="text-sm mt-1 text-slate-700">{message}</p>}
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Name / Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-emerald-900">{u.full_name || '—'}</p>
                  <p className="text-slate-400 text-xs">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  {u.id === myProfile?.id ? (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">{u.role} (you)</span>
                  ) : (
                    <select
                      value={u.role}
                      onChange={e => updateRole(u.id, e.target.value)}
                      className="text-xs border border-stone-200 rounded px-2 py-1 bg-white text-slate-800"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(u.created_at).toLocaleDateString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}