import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';

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
      {currentPage === 'api-keys' && <ApiKeysPage />}
    </Layout>
  );
}

export default App;