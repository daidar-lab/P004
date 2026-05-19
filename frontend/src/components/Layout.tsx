import { useState } from 'react'
import {
  LayoutDashboard,
  Zap,
  KeyRound,
  ChevronRight,
  Activity,
  Settings,
  LogOut,
  Bell,
  Sun,
  Moon,
} from 'lucide-react'
import { useEffect } from 'react'

type Page = 'dashboard' | 'endpoints' | 'api-keys'

interface LayoutProps {
  children: React.ReactNode
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'endpoints' as Page, label: 'Endpoints', icon: Zap },
  { id: 'api-keys' as Page, label: 'Chaves de API', icon: KeyRound },
]

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [isLight, setIsLight] = useState(() => {
    return localStorage.getItem('theme') === 'light'
  })

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }
  }, [isLight])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-mono overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          flex flex-col border-r border-slate-800/60 bg-slate-950
          transition-all duration-300 ease-in-out flex-shrink-0
          ${collapsed ? 'w-16' : 'w-60'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800/60">
          <div className="flex-shrink-0 w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center">
            <Activity size={14} className="text-slate-950" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-xs font-bold tracking-widest text-slate-50 uppercase">B/Synapse</span>
              <span className="text-[10px] text-slate-500 tracking-wider">AI Gateway</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-300 ${collapsed ? '' : 'rotate-180'}`}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {!collapsed && (
            <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Menu
            </p>
          )}
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = currentPage === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                title={collapsed ? label : undefined}
                className={`
                  w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm
                  transition-all duration-150 group
                  ${active
                    ? 'bg-slate-800 text-slate-50'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                  }
                `}
              >
                <Icon
                  size={16}
                  className={`flex-shrink-0 ${active ? 'text-emerald-400' : 'text-slate-600 group-hover:text-slate-400'}`}
                />
                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}
                {!collapsed && active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-slate-800/60 space-y-0.5">
          <button
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-slate-600 hover:text-slate-400 hover:bg-slate-900 transition-all"
            title={collapsed ? 'Configurações' : undefined}
          >
            <Settings size={15} className="flex-shrink-0" />
            {!collapsed && <span>Configurações</span>}
          </button>
          <button
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-slate-600 hover:text-rose-400 hover:bg-slate-900 transition-all"
            title={collapsed ? 'Sair' : undefined}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-slate-800/60 bg-slate-950 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span>synapse</span>
            <ChevronRight size={12} />
            <span className="text-slate-300">
              {navItems.find(n => n.id === currentPage)?.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-mono">Sistema Operacional</span>
            </div>
            <button
              onClick={() => setIsLight(!isLight)}
              className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors"
              title={isLight ? "Ativar modo escuro" : "Ativar modo claro"}
            >
              {isLight ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button className="relative p-1.5 text-slate-600 hover:text-slate-300 transition-colors">
              <Bell size={16} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] text-slate-300">
              AD
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  )
}
