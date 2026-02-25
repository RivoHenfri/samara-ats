import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  LayoutDashboard, Users, Briefcase, Calculator,
  LogOut, Menu, X, ClipboardList, BarChart2, Upload, UserCog, Link as LinkIcon, Wand2
} from 'lucide-react'
import NotificationCenter from './NotificationCenter'
import { useRBAC } from '../contexts/RBACContext'

export default function Layout({ children, currentPage, setCurrentPage }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, profile, isAdmin, signOut } = useAuth()
  const { hasPermission } = useRBAC()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview', filter: true },
    { id: 'pipeline', label: 'Pipeline', icon: Users, section: 'Recruitment', filter: hasPermission('applications', 'read') },
    { id: 'candidates', label: 'Candidates', icon: Briefcase, section: null, filter: hasPermission('candidates', 'read') },
    { id: 'employees', label: 'Employees', icon: Users, section: null, filter: hasPermission('employees', 'manage') },
    { id: 'roles', label: 'Roles', icon: ClipboardList, section: null, filter: hasPermission('roles', 'read') },
    { id: 'jobcreator', label: 'Job Creator', icon: Wand2, section: null, filter: hasPermission('roles', 'insert') },
    { id: 'tcow', label: 'TCOW Calculator', icon: Calculator, section: 'Analytics', filter: hasPermission('settings', 'manage') },
    { id: 'analytics', label: 'Analytics', icon: BarChart2, section: null, filter: hasPermission('applications', 'read') },
    { id: 'import', label: 'Import', icon: Upload, section: 'Tools', filter: hasPermission('candidates', 'insert') },
    { id: 'integrations', label: 'Integrations', icon: LinkIcon, section: 'Settings', filter: hasPermission('settings', 'manage') },
    ...(isAdmin ? [{ id: 'users', label: 'User Management', icon: UserCog, section: null, filter: hasPermission('settings', 'manage') }] : []),
  ].filter(item => item.filter)

  // Build grouped nav
  let lastSection = null
  const grouped = navItems.map(item => {
    const showHeader = item.section && item.section !== lastSection
    if (item.section) lastSection = item.section
    return { ...item, showHeader }
  })

  // User initials for avatar
  const name = user?.user_metadata?.full_name || user?.email || ''
  const initials = name
    .split(/[\s@]/).filter(Boolean)
    .map(w => w[0]?.toUpperCase())
    .slice(0, 2).join('') || 'SA'

  const roleLabel = user?.role === 'Admin' ? 'Admin' : user?.role === 'Manager' ? 'Manager' : 'Team'

  return (
    <div className="app-shell">

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>

        {/* Brand */}
        <div className="sidebar-brand">
          {!collapsed && (
            <>
              <div className="brand-wordmark">Samara</div>
              <div className="brand-sub">Talent System</div>
            </>
          )}
          {collapsed && (
            <div className="brand-wordmark" style={{ fontSize: 16, letterSpacing: '0.08em' }}>S</div>
          )}
        </div>

        {/* Notification center */}
        <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <NotificationCenter collapsed={collapsed} onNavigate={setCurrentPage} />
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, paddingTop: 4, overflowY: 'auto' }}>
          {grouped.map(item => (
            <div key={item.id}>
              {item.showHeader && !collapsed && (
                <div className="sidebar-section">{item.section}</div>
              )}
              <button
                onClick={() => setCurrentPage(item.id)}
                className={`nav-btn${currentPage === item.id ? ' active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-icon-wrap">
                  <item.icon size={16} />
                </span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </button>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(197,188,176,0.5)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            transition: 'color 0.15s',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--stone)'}
          onMouseOut={e => e.currentTarget.style.color = 'rgba(197,188,176,0.5)'}
        >
          {collapsed ? <Menu size={16} /> : <><X size={16} />{!collapsed && <span>Collapse</span>}</>}
        </button>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="user-ava">{initials}</div>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div className="user-name">{name.split('@')[0] || 'Team Member'}</div>
                <div className="user-role">{roleLabel}</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <button
              onClick={signOut}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                marginTop: 12, padding: '6px 0',
                color: 'rgba(197,188,176,0.5)',
                background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 11,
                transition: 'color 0.15s',
                width: '100%',
              }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--stone)'}
              onMouseOut={e => e.currentTarget.style.color = 'rgba(197,188,176,0.5)'}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          )}
        </div>

      </aside>

      {/* ── MAIN AREA ─────────────────────────────────────── */}
      <div className="main-area">
        {children}
      </div>

    </div>
  )
}
