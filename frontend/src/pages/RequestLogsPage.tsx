import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, RefreshCw } from 'lucide-react';

export function RequestLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Esse estado guarda o slug selecionado no select para enviar na query da API
  const [slugFilter, setSlugFilter] = useState('');

  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pageSize, setPageSize] = useState(20);
  const [pageNumber, setPageNumber] = useState(0);
  const [endpoints, setEndpoints] = useState<any[]>([]);

  // 1. Busca a lista de endpoints cadastrados para preencher o select por nome
  useEffect(() => {
    // Trocamos as aspas simples por CRASES e usamos a variável do ambiente
    fetch(`${import.meta.env.VITE_API_URL}/v1/endpoints`)
      .then(res => res.json())
      .then(data => {
        // Log para checagem no Console (F12) se necessário
        console.log("Endpoints carregados com sucesso:", data);
        // ... resto do seu código

        // Garante a extração da lista caso venha envelopada em propriedades como .endpoints ou .data
        const list = Array.isArray(data) ? data : (data.endpoints || data.data || []);
        setEndpoints(list);
      })
      .catch((err) => {
        console.error("Erro ao buscar lista de endpoints:", err);
        setEndpoints([]);
      });
  }, []);

  // 2. Busca os logs de requisição aplicando todos os filtros ativos
  const fetchLogs = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(pageNumber * pageSize),
      sort: sortField,
      order: sortOrder,
    });

    if (slugFilter) params.append('slug', slugFilter);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    fetch(`${import.meta.env.VITE_API_URL}/v1/request-logs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ao buscar logs do servidor');
        const json = await res.json();
        setLogs(json.logs || json.data || []);
        setTotal(json.total ?? 0);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // Dispara a busca sempre que um filtro, ordenação ou paginação mudar
  useEffect(() => {
    fetchLogs();
  }, [slugFilter, startDate, endDate, sortField, sortOrder, pageSize, pageNumber]);

  const totalPages = Math.ceil(total / pageSize);

  const formatLatency = (ms: number) => {
    if (!ms) return '0ms';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-base font-semibold text-slate-100">Logs de Requisições</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico completo de telemetria e auditoria do gateway
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={fetchLogs}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Atualizar logs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPageNumber(0); }}
            className="rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 py-1.5 px-2.5 outline-none focus:border-slate-700"
          >
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      {/* Seção de Filtros Avançados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 bg-slate-900/20 p-4 rounded-lg border border-slate-900">

        {/* 🏷️ Filtro por Nome (Exibe o Name mapeado com fallbacks, e vincula ao Slug) */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-mono uppercase">Filtrar por Nome</label>
          <select
            value={slugFilter}
            onChange={e => { setSlugFilter(e.target.value); setPageNumber(0); }}
            className="w-full rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 py-2 px-2.5 outline-none focus:border-slate-700"
          >
            <option value="">Todos os Endpoints</option>
            {endpoints && endpoints.map((ep: any, index: number) => {
              // Fallbacks de chaves caso o backend use mapeamentos alternativos nas propriedades
              const id = ep.id || ep._id || index;
              const slug = ep.slug || ep.endpoint || '';
              const name = ep.name || ep.title || slug || 'Sem nome';

              return (
                <option key={id} value={slug}>
                  {name} {slug ? `(/${slug})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Filtro Data Inicial */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-mono uppercase">Data Inicial</label>
          <input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPageNumber(0); }}
            className="w-full rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 py-1.5 px-2.5 outline-none focus:border-slate-700 color-scheme-dark"
          />
        </div>

        {/* Filtro Data Final */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-mono uppercase">Data Final</label>
          <input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPageNumber(0); }}
            className="w-full rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 py-1.5 px-2.5 outline-none focus:border-slate-700"
          />
        </div>

        {/* Campo de Ordenação */}
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-slate-500 font-mono uppercase">Ordenar por</label>
          <select
            value={sortField}
            onChange={e => { setSortField(e.target.value); setPageNumber(0); }}
            className="w-full rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 py-2 px-2.5 outline-none focus:border-slate-700"
          >
            <option value="created_at">Data de Criação</option>
            <option value="tokens_input">Tokens Input</option>
            <option value="tokens_output">Tokens Output</option>
            <option value="latency_ms">Latência</option>
          </select>
        </div>

        {/* Sentido da Ordenação (Asc/Desc) */}
        <div className="flex flex-col gap-1 justify-end">
          <button
            onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center justify-center gap-2 w-full rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 py-2 px-3 hover:bg-slate-800/40 transition-colors"
          >
            <ArrowUpDown size={12} className="text-slate-500" />
            {sortOrder === 'desc' ? 'Descendente' : 'Ascendente'}
          </button>
        </div>
      </div>

      {/* Tabela Principal */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-slate-500 animate-pulse">
          Carregando registros de auditoria do gateway...
        </div>
      ) : error ? (
        <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-md font-mono">
          Erro ao processar logs: {error}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-900 bg-slate-900/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto text-xs text-left">
              <thead className="bg-slate-900/80 border-b border-slate-900 text-[11px] text-slate-400 uppercase font-mono tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data / Hora</th>
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Mensagem de Erro</th>
                  <th className="px-4 py-3 font-semibold">Latência</th>
                  <th className="px-4 py-3 font-semibold text-right">Tokens In</th>
                  <th className="px-4 py-3 font-semibold text-right">Tokens Out</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-mono">
                {logs.length > 0 ? (
                  logs.map((a: any, i: number) => {
                    const isSuccess = a.status_code >= 200 && a.status_code < 400;
                    return (
                      <tr key={i} className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(a.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-slate-200 font-semibold">
                          /{a.slug || a.endpoint}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isSuccess ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                            {a.status_code}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-rose-400/90 max-w-xs truncate" title={a.error_message}>
                          {a.error_message || <span className="text-slate-700">—</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {formatLatency(a.latency_ms)}
                        </td>
                        <td className="px-4 py-3 text-violet-400 font-bold text-right">
                          {a.tokens_input?.toLocaleString('pt-BR') ?? 0}
                        </td>
                        <td className="px-4 py-3 text-amber-400 font-bold text-right">
                          {a.tokens_output?.toLocaleString('pt-BR') ?? 0}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-600">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginação */}
      <div className="flex items-center justify-between border-t border-slate-900 pt-4 text-xs font-mono">
        <span className="text-slate-500">
          Total de <span className="text-slate-300">{total}</span> logs
        </span>

        <div className="flex items-center gap-3">
          <button
            disabled={pageNumber === 0 || loading}
            onClick={() => setPageNumber(p => Math.max(p - 1, 0))}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft size={14} />
            <span>Anterior</span>
          </button>

          <span className="text-slate-400">
            {pageNumber + 1} de {totalPages || 1}
          </span>

          <button
            disabled={pageNumber + 1 >= totalPages || loading}
            onClick={() => setPageNumber(p => p + 1)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 disabled:opacity-30 disabled:hover:bg-slate-900 hover:bg-slate-800 transition-colors"
          >
            <span>Próxima</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}