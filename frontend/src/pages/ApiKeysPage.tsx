import { useState, useEffect } from 'react';
import { KeyRound, Plus, Copy, Check, ToggleLeft, ToggleRight, Clock, ShieldAlert } from 'lucide-react';
import type { ApiKey } from '../types';

export function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const response = await fetch('http://localhost:3334/v1/apikeys');
      if (!response.ok) throw new Error('Falha ao buscar chaves de API');
      const data = await response.json();
      setKeys(data);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;

    try {
      const response = await fetch('http://localhost:3334/v1/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: newClientName }),
      });
      
      if (!response.ok) throw new Error('Erro ao gerar chave');
      const newKey = await response.json();
      
      setKeys([newKey, ...keys]);
      setNewClientName('');
      setIsCreating(false);
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    try {
      const response = await fetch(`http://localhost:3334/v1/apikeys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus }),
      });
      
      if (!response.ok) throw new Error('Erro ao atualizar status');
      
      setKeys(keys.map(k => k.id === id ? { ...k, is_active: !currentStatus } : k));
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <KeyRound size={18} className="text-emerald-400" />
            Chaves de API (Tokens)
          </h1>
          <p className="text-xs text-slate-500 mt-1">Gerencie os tokens de acesso para os aplicativos clientes. </p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-md transition-all"
        >
          <Plus size={14} /> Nova Chave
        </button>
      </div>

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-md font-mono flex items-center gap-2">
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      {/* Create form (inline) */}
      {isCreating && (
        <form onSubmit={handleCreate} className="p-4 bg-slate-900 border border-emerald-500/30 rounded-lg flex items-end gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Nome da Aplicação (Ex: Portal de Energia)</label>
            <input
              autoFocus
              type="text"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Digite um identificador..."
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
            />
          </div>
          <button 
            type="button" 
            onClick={() => setIsCreating(false)}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button 
            type="submit"
            disabled={!newClientName.trim()}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 transition-all"
          >
            Gerar Token Seguro
          </button>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-sm text-slate-500 text-center py-12">Carregando tokens de segurança...</div>
      ) : (
        <div className="space-y-3">
          {keys.length === 0 && !isCreating && (
            <div className="text-center py-12 border border-slate-800/50 border-dashed rounded-xl bg-slate-900/30">
              <KeyRound size={24} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Nenhuma chave gerada.</p>
              <p className="text-xs text-slate-500 mt-1">Crie a primeira chave para conectar os aplicativos.</p>
            </div>
          )}

          {keys.map(k => (
            <div key={k.id} className={`flex items-center justify-between p-4 rounded-lg border bg-slate-900/60 transition-all ${k.is_active ? 'border-slate-800/80 hover:border-slate-700' : 'border-rose-900/30 bg-slate-900/40 opacity-75'}`}>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-slate-100">{k.client_name}</h3>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                    k.is_active
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  }`}>
                    {k.is_active ? 'Ativo' : 'Revogado'}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono px-2 py-1 bg-slate-950 border border-slate-800 rounded text-amber-300">
                    {k.api_key}
                  </code>
                  <button
                    onClick={() => handleCopy(k.id, k.api_key)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition-colors"
                    title="Copiar token"
                  >
                    {copiedId === k.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Criado em</p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Clock size={12} />
                    {new Date(k.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                <div className="h-10 w-px bg-slate-800"></div>

                <button
                  onClick={() => toggleStatus(k.id, k.is_active)}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-mono transition-all ${
                    k.is_active
                      ? 'text-slate-400 hover:text-rose-400'
                      : 'text-slate-500 hover:text-emerald-400'
                  }`}
                >
                  {k.is_active ? <ToggleRight size={20} className="text-emerald-500" /> : <ToggleLeft size={20} />}
                  {k.is_active ? 'Desativar' : 'Reativar'}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
