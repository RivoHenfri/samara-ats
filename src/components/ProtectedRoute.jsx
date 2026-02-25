import { useRBAC } from '../contexts/RBACContext'

export default function ProtectedRoute({ module, action, children, fallback = null }) {
    const { hasPermission, loading } = useRBAC()

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-gray-400">Verifying access...</div>
            </div>
        )
    }

    // Via Negativa implementation: If the explicit permission is missing, return fallback/auth gate
    if (!hasPermission(module, action)) {
        return fallback ? fallback : (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full">
                <h2 className="text-xl font-medium text-red-400 mb-2">Access Denied</h2>
                <p className="text-[#C5BCB0]/70 text-sm max-w-sm">
                    You do not have the required permissions to view this module.
                </p>
            </div>
        )
    }

    return children
}
