import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session first, set loading false immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)

      // Look for role in the verified JWT first, then fallback
      const jwtRole = session?.user?.app_metadata?.role;
      if (jwtRole) {
        setProfile({ id: session.user.id, role: jwtRole, tenant_id: session.user.app_metadata.tenant_id });
      } else if (session?.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data)
          })
      }
    }).catch(err => {
      console.error("Auth session error:", err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        const jwtRole = session?.user?.app_metadata?.role;
        if (jwtRole) {
          setProfile({ id: session.user.id, role: jwtRole, tenant_id: session.user.app_metadata.tenant_id });
        } else if (session?.user) {
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data) setProfile(data)
            })
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = profile?.role === 'Admin'
  const isManager = profile?.role === 'Manager' || isAdmin
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, isManager, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)