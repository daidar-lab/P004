import { useState, useEffect } from 'react';
import { 
  FileText, Plus, RefreshCw, Clock, CheckCircle2, 
  XCircle, AlertTriangle, Eye, Search, X 
} from 'lucide-react';

interface DocumentJob {
  id: string;
  job_id: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  s3_bucket: string;
  s3_key: string;
  raw_text: string | null;
  ai_result: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  endpoint_name: string | null;
  endpoint_slug: string | null;
  client_name: string | null;
}

export function DocumentJobsPage() {
  const [jobs, setJobs] = useState<DocumentJob[]>([]);
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Trigger state
  const [isCreating, setIsCreating] = useState(false);
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Key, setS3Key] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [triggerLoading, setTriggerLoading] = useState(false);

  // Detail modal state
  const [viewingJob, setViewingJob] = useState<DocumentJob | null>(null);

  // Search
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchJobs();
    fetchEndpoints();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/document-jobs`);
      if (!response.ok) throw new Error('Falha ao buscar jobs de documentos.');
      const data = await response.json();
      setJobs(data.jobs || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const fetchEndpoints = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/endpoints`);
      if (response.ok) {
        const data = await response.json();
        const activeEndpoints = data.filter((e: any) => e.is_active);
        setEndpoints(activeEndpoints);
        if (activeEndpoints.length > 0) {
          setSelectedEndpointId(activeEndpoints[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar endpoints:', err);
    }
  };

  const handleTriggerJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s3Bucket.trim() || !s3Key.trim() || !selectedEndpointId) return;

    setTriggerLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/document-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          s3Bucket: s3Bucket.trim(),
          s3Key: s3Key.trim(),
          endpointId: selectedEndpointId
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao disparar job de processamento.');
      }

      setS3Bucket('');
      setS3Key('');
      setIsCreating(false);
      fetchJobs();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setTriggerLoading(false);
    }
  };

  const filteredJobs = jobs.filter(j => 
    j.job_id.toLowerCase().includes(search.toLowerCase()) ||
    j.s3_key.toLowerCase().includes(search.toLowerCase()) ||
    (j.endpoint_name && j.endpoint_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-5">
        <div>
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-emerald-400" />
            Processador de Documentos (Textract + SQS)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitore e teste a extração de textos via Amazon Textract e análise por IA via Amazon Bedrock de forma assíncrona.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-md transition-all font-mono"
          >
            <Plus size={14} /> Disparar Teste
          </button>
        </div>
      </div>

      {/* Trigger Form Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleTriggerJob} className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-slate-100">Disparar Processamento de PDF</h2>
              <button type="button" onClick={() => setIsCreating(false)} className="text-slate-500 hover:text-slate-300">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Bucket S3</label>
              <input
                type="text"
                required
                value={s3Bucket}
                onChange={e => setS3Bucket(e.target.value)}
                placeholder="ex: bsynapse-documentos-upload"
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Key S3 (Caminho do arquivo)</label>
              <input
                type="text"
                required
                value={s3Key}
                onChange={e => setS3Key(e.target.value)}
                placeholder="ex: invoices/nota_fiscal_554.pdf"
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Endpoint de Prompt / IA</label>
              <select
                value={selectedEndpointId}
                onChange={e => setSelectedEndpointId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 font-mono"
              >
                {endpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>{ep.name} (/{ep.slug})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={triggerLoading}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-md transition-all font-mono"
              >
                {triggerLoading ? 'Iniciando...' : 'Iniciar Textract'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por S3 Key, Job ID..."
          className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-700 transition-colors"
        />
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-12 text-xs font-mono text-slate-500 animate-pulse">
          Carregando registros de processamentos assíncronos...
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
                  <th className="px-4 py-3 font-semibold">Job ID (Textract)</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">Arquivo (S3)</th>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/60 font-mono">
                {filteredJobs.length > 0 ? (
                  filteredJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(j.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-semibold truncate max-w-[120px]" title={j.job_id}>
                        {j.job_id}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          j.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' :
                          j.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-amber-500/10 text-amber-400 animate-pulse'
                        }`}>
                          {j.status === 'COMPLETED' && <CheckCircle2 size={10} />}
                          {j.status === 'FAILED' && <XCircle size={10} />}
                          {j.status === 'PROCESSING' && <Clock size={10} />}
                          {j.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {j.endpoint_name ? `${j.endpoint_name} (/${j.endpoint_slug})` : 'Disparador Manual'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]" title={`s3://${j.s3_bucket}/${j.s3_key}`}>
                        s3://{j.s3_bucket}/{j.s3_key}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {j.client_name || <span className="text-slate-700">Sistema</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setViewingJob(j)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded hover:bg-emerald-500/20 transition-all"
                        >
                          <Eye size={12} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-600">
                      Nenhum job de documento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details View Modal */}
      {viewingJob && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" />
                  Detalhes do Job: {viewingJob.job_id}
                </h2>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                  s3://{viewingJob.s3_bucket}/{viewingJob.s3_key}
                </p>
              </div>
              <button onClick={() => setViewingJob(null)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-md hover:bg-slate-800">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-500 uppercase">Status</p>
                  <p className="text-xs font-semibold text-slate-200 mt-1">{viewingJob.status}</p>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-500 uppercase">Criado em</p>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    {new Date(viewingJob.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-500 uppercase">Endpoint Destino</p>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    {viewingJob.endpoint_name || 'Manual'}
                  </p>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <p className="text-[10px] font-mono text-slate-500 uppercase">Consumido por</p>
                  <p className="text-xs font-semibold text-slate-200 mt-1">
                    {viewingJob.client_name || 'Painel Admin'}
                  </p>
                </div>
              </div>

              {viewingJob.error_message && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md flex items-start gap-2">
                  <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={14} />
                  <div className="text-xs">
                    <p className="font-semibold text-rose-400">Falha no Processamento</p>
                    <p className="text-rose-300/90 font-mono mt-1">{viewingJob.error_message}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Textract Raw text */}
                <div className="flex flex-col h-[380px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Texto Extraído (Textract LINE Blocks)</span>
                  </div>
                  <textarea
                    readOnly
                    value={viewingJob.raw_text || 'Aguardando processamento ou indisponível.'}
                    className="flex-1 p-3 text-xs font-mono text-slate-300 bg-transparent resize-none focus:outline-none leading-relaxed"
                  />
                </div>

                {/* AI result */}
                <div className="flex flex-col h-[380px] bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 uppercase">Resultado da IA (Amazon Bedrock)</span>
                  </div>
                  <textarea
                    readOnly
                    value={viewingJob.ai_result || 'Aguardando processamento ou indisponível.'}
                    className="flex-1 p-3 text-xs font-mono text-emerald-400 bg-transparent resize-none focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-end">
              <button
                onClick={() => setViewingJob(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 transition-all font-mono"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
