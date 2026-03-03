import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RBACContext = createContext({})

export function RBACProvider({ children }) {
    const { user } = useAuth()
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user?.id) {
            setPermissions([])
            setLoading(false)
            return
        }

        const fetchPermissions = async () => {
            setLoading(true)
            try {
                // Query the permissions assigned to the current user via the new public RPC function
                const { data, error } = await supabase.rpc('get_user_permissions')

                if (error) throw error

                setPermissions(data || [])
            } catch (err) {
                console.error("Error fetching RBAC permissions:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchPermissions()
    }, [user?.id])

    // Helper check method enforcing Via Negativa (Default Deny)
    const hasPermission = (module, action) => {
        return permissions.includes(`${module}:${action}`)
    }

    return (
        <RBACContext.Provider value={{ permissions, hasPermission, loading }}>
            {children}
        </RBACContext.Provider>
    )
}

export const useRBAC = () => useContext(RBACContext)
