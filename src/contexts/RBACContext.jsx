import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RBACContext = createContext({})

export function RBACProvider({ children }) {
    const { user } = useAuth()
    const [permissions, setPermissions] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user) {
            setPermissions([])
            setLoading(false)
            return
        }

        const fetchPermissions = async () => {
            setLoading(true)
            try {
                // Query the permissions assigned to the current user via their role bindings
                const { data, error } = await supabase
                    .from('rbac.user_roles')
                    .select(`
            role_id,
            rbac_roles:role_id (
              name,
              rbac_role_permissions:role_id (
                rbac_permissions:permission_id (
                  module,
                  action
                )
              )
            )
          `)
                    .eq('user_id', user.id)

                if (error) throw error

                // Extract and flatten permissions array
                const perms = []
                data?.forEach(ur => {
                    ur.rbac_roles?.rbac_role_permissions?.forEach(rp => {
                        const p = rp.rbac_permissions
                        if (p) perms.push(`${p.module}:${p.action}`)
                    })
                })

                setPermissions(perms)
            } catch (err) {
                console.error("Error fetching RBAC permissions:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchPermissions()
    }, [user])

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
