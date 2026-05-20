import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { Activity } from 'lucide-react';

// Monkey patch global fetch para injetar o JWT automaticamente
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const token = localStorage.getItem('token');
  const isBackendUrl = typeof input === 'string' && input.includes('localhost:3334');

  let newInit = init || {};
  if (token && isBackendUrl) {
    const headers = new Headers(newInit.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    newInit = {
      ...newInit,
      headers
    };
  }

  const response = await originalFetch(input, newInit);

  // Trata expiração do token (401) redirecionando para login
  if (response.status === 401 && typeof input === 'string' && !input.includes('/auth/login') && !input.includes('/health')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    globalThis.location.reload();
  }

  return response;
};

export type Page = 'dashboard' | 'endpoints' | 'api-keys' | 'users';

export interface User {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'user';
}

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Validação inicial do token
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!token || !savedUser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setCheckingAuth(false);
      return;
    }

    // Faz chamada ao me para validar o token no backend
    fetch('http://localhost:3334/v1/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Token inválido');
        const data = await res.json();
        setUser(data.user);
      })
      .catch((err) => {
        console.error('Sessão expirada ou inválida:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);

  const handleLoginSuccess = (token: string, loggedInUser: User) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    globalThis.location.reload();
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-mono text-slate-100 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="w-12 h-12 rounded-lg bg-emerald-500 flex items-center justify-center animate-pulse">
            <Activity size={24} className="text-slate-950" strokeWidth={2.5} />
          </div>
          <span className="text-xs text-slate-500 tracking-widest uppercase animate-pulse">Carregando gateway...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      user={user}
      onLogout={handleLogout}
    >
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'endpoints' && <EndpointsPage />}
      {currentPage === 'api-keys' && <ApiKeysPage />}
      {currentPage === 'users' && user.role === 'admin' && <UsersPage currentUser={user} />}
    </Layout>
  );
}

export default App;