import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { EndpointsPage } from './pages/EndpointsPage';

type Page = 'dashboard' | 'endpoints' | 'api-keys';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Lógica de teste de conexão integrada corretamente dentro do componente
  useEffect(() => {
    fetch('http://localhost:3334/health')
      .then(res => res.json())
      .then(data => console.log('✅ Conexão estabelecida com sucesso:', data))
      .catch(err => console.error('❌ Erro de conexão com backend:', err));
  }, []); // [] garante que rode apenas uma vez ao carregar o App

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPage === 'dashboard' && <DashboardPage />}
      {currentPage === 'endpoints' && <EndpointsPage />}
      {currentPage === 'api-keys' && (
        <div className="p-6 m-6 bg-slate-900 border border-slate-800 rounded-xl">
          <h2 className="text-xl font-bold text-white mb-2">Chaves de API (Tokens)</h2>
          <p className="text-slate-400 text-sm">
            Módulo de controle perimetral e gerenciamento de permissões de chaves de acesso.
          </p>
        </div>
      )}
    </Layout>
  );
}

export default App;