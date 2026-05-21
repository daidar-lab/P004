import { useState, useRef, useEffect } from 'react'
import {
  LayoutDashboard,
  Zap,
  KeyRound,
  ChevronRight,
  Settings,
  LogOut,
  Sun,
  Moon,
  Eye,
  EyeOff,
  X,
  Lock,
  Activity
} from 'lucide-react'

type Page = 'dashboard' | 'endpoints' | 'api-keys' | 'users' | 'request-logs'

interface LayoutProps {
  children: React.ReactNode
  currentPage: Page
  onNavigate: (page: Page) => void
  user: { username: string; name: string; role: 'admin' | 'user' }
  onLogout: () => void
}

const navItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'endpoints' as Page, label: 'Endpoints', icon: Zap },
  { id: 'api-keys' as Page, label: 'Chaves de API', icon: KeyRound },
  { id: 'request-logs' as Page, label: 'Logs de Requisições', icon: Activity },
]

export function Layout({ children, currentPage, onNavigate, user, onLogout }: Readonly<LayoutProps>) {
  const [collapsed, setCollapsed] = useState(false);
  const [isLight, setIsLight] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Password modal state
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const openPwModal = () => {
    setShowDropdown(false);
    setPwForm({ current: '', newPw: '', confirm: '' });
    setPwError('');
    setPwSuccess('');
    setShowPwModal(true);
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');

    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) {
      setPwError('Preencha todos os campos.');
      return;
    }
    if (pwForm.newPw.length < 6) {
      setPwError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (pwForm.newPw !== pwForm.confirm) {
      setPwError('As senhas não coincidem.');
      return;
    }

    setPwLoading(true);
    try {
      const res = await fetch('http://localhost:3334/v1/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || 'Erro ao alterar senha.');
      } else {
        setPwSuccess('Senha alterada com sucesso!');
        setTimeout(() => setShowPwModal(false), 1500);
      }
    } catch {
      setPwError('Erro de conexão com o servidor.');
    } finally {
      setPwLoading(false);
    }
  };

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light')
      localStorage.setItem('theme', 'light')
    } else {
      document.documentElement.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    }
  }, [isLight]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <div className="flex-shrink-0 flex items-center justify-center">
            <img src="/favicon.svg" className="w-7 h-7" />
          </div>

          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-xs font-bold tracking-widest text-slate-50 uppercase">
                B/Synapse
              </span>
              <span className="text-[10px] text-slate-500 tracking-wider">
                AI Gateway
              </span>
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-slate-600 hover:text-slate-400 transition-colors"
          >
            <ChevronRight
              size={14}
              className={`transition-transform duration-300 ${collapsed ? '' : 'rotate-180'
                }`}
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
          {/* Configurações - only admin */}
          {user.role === 'admin' && (
            <button
              className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-slate-600 hover:text-slate-400 hover:bg-slate-900 transition-all"
              title={collapsed ? 'Configurações' : undefined}
              onClick={() => onNavigate('users')}
            >
              <Settings size={15} className="flex-shrink-0" />
              {!collapsed && <span>Configurações</span>}
            </button>
          )}
          <button
            className="w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm text-slate-600 hover:text-rose-400 hover:bg-slate-900 transition-all"
            title={collapsed ? 'Sair' : undefined}
            onClick={onLogout}
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

            {/* Avatar and dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] text-slate-300"
                onClick={() => setShowDropdown(prev => !prev)}
                title="Perfil"
              >
                {user.name.split(' ')[0][0]}{user.name.split(' ')[1] ? user.name.split(' ')[1][0] : ''}
              </button>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-600 rounded-md shadow-lg z-20">
                  <div className="p-3 text-sm text-slate-200 border-b border-slate-600">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                  </div>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
                    onClick={openPwModal}
                  >
                    Alterar senha
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-xs text-rose-400 hover:bg-slate-700"
                    onClick={onLogout}
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-slate-950">
          {children}
        </main>
      </div>

      {/* ── Change Password Modal ── */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-emerald-400" />
                <span className="text-sm font-semibold text-slate-100">Alterar Senha</span>
              </div>
              <button
                onClick={() => setShowPwModal(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              {/* Current password */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Senha atual</label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    className="w-full px-3 py-2 pr-9 rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* New password */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Nova senha</label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={pwForm.newPw}
                    onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                    className="w-full px-3 py-2 pr-9 rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm new password */}
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1.5">Confirmar nova senha</label>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors"
                  placeholder="Repita a nova senha"
                />
              </div>

              {/* Feedback */}
              {pwError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-2">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-3 py-2">{pwSuccess}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700/60">
              <button
                onClick={() => setShowPwModal(false)}
                className="px-4 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="px-4 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {pwLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
