import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LayoutDashboard, Users, Briefcase, Calculator, LogOut, Menu, X, ClipboardList, BarChart2, Upload } from 'lucide-react'

export default function Layout({ children, currentPage, setCurrentPage }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pipeline', label: 'Pipeline', icon: Users },
    { id: 'candidates', label: 'Candidates', icon: Briefcase },
    { id: 'roles', label: 'Roles', icon: ClipboardList },
    { id: 'tcow', label: 'TCOW Calculator', icon: Calculator },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'import', label: 'Import', icon: Upload },
  ]

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-gray-800 flex flex-col transition-all duration-200`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          {sidebarOpen && <span className="font-bold text-emerald-400">Samara ATS</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                currentPage === item.id ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-3 px-5 py-4 text-gray-400 hover:text-white border-t border-gray-700"
        >
          <LogOut size={20} />
          {sidebarOpen && <span>Sign Out</span>}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}