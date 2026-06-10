import { useState, useEffect } from 'react'
import {
  Zap, Plus, Search, X, Save, ChevronDown,
  ToggleLeft, ToggleRight, Clock, RefreshCw, AlertTriangle, FileText,
} from 'lucide-react'
import { AWS_MODELS } from '../constants/models'
import type { Endpoint, AwsModelId } from '../types'

function TemperatureBar({ value }: { value: number }) {
  const pct = value * 100
  const color =
    pct <= 30 ? 'bg-blue-500' : pct <= 60 ? 'bg-emerald-500' : pct <= 80 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-slate-800">
        <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-slate-400 w-8 text-right">{value.toFixed(2)}</span>
    </div>
  )
}


function ModelBadge({ modelId, endpointType }: { modelId: AwsModelId; endpointType?: 'bedrock' | 'textract' }) {
  if (endpointType === 'textract') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono text-violet-400 bg-violet-500/10 border-violet-500/20">
        <FileText size={10} /> OCR · AWS Textract
      </span>
    )
  }
  const model = AWS_MODELS.find(m => m.id === modelId)
  const providerColors: Record<string, string> = {
    Amazon: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    Anthropic: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    Meta: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    'Mistral AI': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  }
  const cls = model ? (providerColors[model.provider] ?? 'text-slate-400 bg-slate-800 border-slate-700') : 'text-slate-400 bg-slate-800 border-slate-700'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono ${cls}`}>
      {model?.provider ?? '—'} · {model?.label ?? modelId}
    </span>
  )
}

interface EditModalProps {
  endpoint: Endpoint
  modelosDaAws: { id: string; label: string; provider: string }[]
  onClose: () => void
  onSave: (updated: Endpoint) => void
}

function EditModal({ endpoint, modelosDaAws, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState<Endpoint>({ 
    ...endpoint, 
    endpoint_type: endpoint.endpoint_type || 'bedrock',
    supports_textract: endpoint.endpoint_type === 'textract' ? true : (endpoint.supports_textract || false)
  })
  const [prompt, setPrompt] = useState(endpoint.current_prompt?.system_prompt ?? '')
  const [userTemplate, setUserTemplate] = useState(endpoint.current_prompt?.user_prompt_template ?? '')
  const [dirty, setDirty] = useState(false)

  function update<K extends keyof Endpoint>(key: K, val: Endpoint[K]) {
    setForm(f => {
      const next = { ...f, [key]: val }
      if (key === 'endpoint_type') {
        next.supports_textract = val === 'textract';
      }
      return next
    })
    setDirty(true)
  }

  function handleSave() {
    onSave({
      ...form,
      current_prompt: form.current_prompt
        ? { ...form.current_prompt, system_prompt: prompt, user_prompt_template: userTemplate || null }
        : undefined,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Editar Endpoint</h2>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">/{form.slug}</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                <AlertTriangle size={11} /> Alterações não salvas
              </span>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-slate-800">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Nome</label>
              <input
                type="text"
                value={form.name}
                onChange={e => update('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={e => update('slug', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
          </div>

          {/* Endpoint Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Tipo de Endpoint</label>
            <div className="relative">
              <select
                value={form.endpoint_type}
                onChange={e => update('endpoint_type', e.target.value as 'bedrock' | 'textract')}
                className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-md pl-3 pr-8 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
              >
                <option value="bedrock">AWS Bedrock (Análise e Modelos de IA)</option>
                <option value="textract">AWS Textract Direct (OCR / Extração Direta sem IA)</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {form.endpoint_type === 'bedrock' ? (
            <>
              {/* Model selector */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Modelo AWS Bedrock</label>
                  <div className="relative">
                    <select
                      value={AWS_MODELS.some(m => m.id === form.aws_model_id) || modelosDaAws.some(m => m.id === form.aws_model_id) ? form.aws_model_id : 'custom'}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          update('aws_model_id', '' as any);
                        } else {
                          update('aws_model_id', val as any);
                        }
                      }}
                      className="w-full appearance-none bg-slate-950 border border-slate-700 rounded-md pl-3 pr-8 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
                    >
                      {AWS_MODELS.map(m => (
                        <option key={m.id} value={m.id}>{m.provider} — {m.label}</option>
                      ))}

                      {modelosDaAws.filter(m => !AWS_MODELS.some(local => local.id === m.id)).map(m => (
                        <option key={m.id} value={m.id}>☁️ {m.provider} — {m.label}</option>
                      ))}

                      <option value="custom">➕ Outro modelo (Digitar ID personalizado...)</option>
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  </div>
                </div>

                {(!AWS_MODELS.some(m => m.id === form.aws_model_id) || form.aws_model_id === '') && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="text-[11px] font-mono text-emerald-500 uppercase tracking-wider">Insera o ID físico oficial da AWS</label>
                    <input
                      type="text"
                      value={form.aws_model_id}
                      onChange={e => update('aws_model_id', e.target.value)}
                      placeholder="Ex: global.anthropic.claude-opus-4-7"
                      className="w-full bg-slate-950 border border-emerald-500/30 rounded-md px-3 py-2 text-sm text-slate-100 placeholder:text-slate-700 font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <p className="text-[10px] text-slate-500 font-mono">
                      Você pode copiar o identificador estável diretamente do console do Amazon Bedrock.
                    </p>
                  </div>
                )}
              </div>

              {/* Temperature slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">Temperatura</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${form.temperature <= 0.3 ? 'bg-blue-500/10 text-blue-400'
                      : form.temperature <= 0.6 ? 'bg-emerald-500/10 text-emerald-400'
                        : form.temperature <= 0.8 ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}>
                      {form.temperature <= 0.3 ? 'Determinístico' : form.temperature <= 0.6 ? 'Balanceado' : form.temperature <= 0.8 ? 'Criativo' : 'Aleatório'}
                    </span>
                    <span className="text-sm font-mono text-slate-200 w-8 text-right">{form.temperature.toFixed(2)}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={form.temperature}
                  onChange={e => update('temperature', Number.parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-slate-900
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-colors
                    [&::-webkit-slider-thumb]:hover:bg-emerald-300"
                />
                <div className="flex justify-between text-[10px] text-slate-600 font-mono">
                  <span>0.00 — Preciso</span>
                  <span>0.50</span>
                  <span>Criativo — 1.00</span>
                </div>
              </div>

              {/* Textract toggle (only for bedrock endpoints that might also want async Textract pipeline) */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <p className="text-sm text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-violet-400" />
                    Suporta Amazon Textract (Assíncrono)
                  </p>
                  <p className="text-[11px] text-slate-500">Habilita processamento assíncrono de PDFs e documentos via Textract + SQS antes de mandar pro Bedrock</p>
                </div>
                <button
                  onClick={() => update('supports_textract', !form.supports_textract)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${form.supports_textract
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                >
                  {form.supports_textract ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                  {form.supports_textract ? 'Habilitado' : 'Desabilitado'}
                </button>
              </div>

              {/* System Prompt */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">System Prompt</label>
                  {form.current_prompt && (
                    <span className="text-[10px] font-mono text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                      v{form.current_prompt.version} · {form.current_prompt.created_by}
                    </span>
                  )}
                </div>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setDirty(true) }}
                  rows={6}
                  placeholder="Instrução de sistema para o modelo..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-slate-100 font-mono leading-relaxed placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
                />
                <p className="text-[10px] text-slate-600">{prompt.length} caracteres</p>
              </div>

              {/* User Prompt Template */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-500 uppercase tracking-wider">
                  Template de Usuário{' '}
                  <span className="normal-case text-slate-700">(opcional)</span>
                </label>
                <textarea
                  value={userTemplate}
                  onChange={e => { setUserTemplate(e.target.value); setDirty(true) }}
                  rows={3}
                  placeholder="Use {{variavel}} para campos dinâmicos..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2.5 text-sm text-slate-100 font-mono leading-relaxed placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/60 transition-colors resize-none"
                />
              </div>
            </>
          ) : (
            <div className="p-4 bg-violet-950/20 border border-violet-500/20 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold text-violet-300 flex items-center gap-1.5">
                <FileText size={16} /> Extração Direta (Textract) Ativa
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Este endpoint está configurado no modo de OCR síncrono. Clientes podem enviar arquivos (PDF, Imagens ou Word) diretamente para obter tabelas e textos estruturados em JSON ou CSV na mesma hora.
              </p>
              <p className="text-xs text-slate-500 font-mono">
                Rota de integração: POST /v1/analyze/{form.slug}/direct?format=json
              </p>
            </div>
          )}

          {/* Status toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
            <div>
              <p className="text-sm text-slate-300">Status do Endpoint</p>
              <p className="text-[11px] text-slate-500">Controla se o endpoint aceita requisições</p>
            </div>
            <button
              onClick={() => update('is_active', !form.is_active)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border transition-all ${form.is_active
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-500'
                }`}
            >
              {form.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.is_active ? 'Ativo' : 'Inativo'}
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors font-mono"
          >
            Cancelar
          </button>
          <div className="flex items-center gap-2">
            {form.endpoint_type === 'bedrock' && (
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-600 rounded-md transition-all font-mono">
                <RefreshCw size={12} /> Nova Versão
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-md transition-all"
            >
              <Save size={13} /> Salvar Alterações
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function EndpointsPage() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Endpoint | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modelosDaAws, setModelosDaAws] = useState<{ id: string; label: string; provider: string }[]>([]);

  useEffect(() => {
    async function fetchEndpoints() {
      try {
        // CORRIGIDO: Modificado para ler do .env usando crases
        const response = await fetch(`${import.meta.env.VITE_API_URL}/v1/endpoints`);
        if (!response.ok) {
          throw new Error('Falha ao buscar endpoints');
        }
        const data = await response.json();
        setEndpoints(data);

        // CORRIGIDO: Modificado para ler do .env usando crases
        const responseModels = await fetch(`${import.meta.env.VITE_API_URL}/v1/endpoints/available-models`);
        if (responseModels.ok) {
          const dataModels = await responseModels.json();
          setModelosDaAws(dataModels);
        }

      } catch (err: any) {
        setError(err.message || 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    }

    fetchEndpoints();
  }, []);

  const filtered = endpoints.filter(ep => {
    const matchSearch = ep.name.toLowerCase().includes(search.toLowerCase()) || ep.slug.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || (filter === 'active' && ep.is_active) || (filter === 'inactive' && !ep.is_active)
    return matchSearch && matchFilter
  })

  async function handleSave(updated: Endpoint) {
    try {
      const isNew = !endpoints.some(e => e.id === updated.id);

      // CORRIGIDO: Substituídas as URLs fixas por variáveis com crases
      const url = isNew
        ? `${import.meta.env.VITE_API_URL}/v1/endpoints`
        : `${import.meta.env.VITE_API_URL}/v1/endpoints/${updated.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao salvar endpoint');
      }

      // CORRIGIDO: Modificado o refetch final para ler do .env usando crases
      const getRes = await fetch(`${import.meta.env.VITE_API_URL}/v1/endpoints`);
      const data = await getRes.json();
      setEndpoints(data);

    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleCreateNew() {
    // Use window.crypto ou um fallback simples se necessário
    const newId = typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : Math.random().toString(36).substring(2) + Date.now().toString(36);

    const newEndpoint: Endpoint = {
      id: newId,
      slug: 'novo-endpoint',
      name: 'Novo Endpoint',
      aws_model_id: 'us.amazon.nova-lite-v1:0',
      temperature: 0.5,
      is_active: true,
      is_multimodal: true,
      supports_textract: false,
      endpoint_type: 'bedrock',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      current_prompt: {
        id: crypto.randomUUID ? crypto.randomUUID() : newId + '-p', // Use o mesmo fallback aqui
        endpoint_id: '',
        system_prompt: 'Instrução principal da IA...',
        user_prompt_template: null,
        version: 1,
        is_current: true,
        created_at: new Date().toISOString(),
        created_by: 'system'
      }
    }
    setEditing(newEndpoint)
  }
  return (
    <div className="p-6 space-y-5">
      {/* Loading & Error States */}
      {isLoading && (
        <div className="text-sm text-slate-400 font-mono flex items-center justify-center p-8">
          Carregando endpoints...
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-md font-mono mb-4">
          Erro: {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100">Endpoints & Prompts</h1>
          <p className="text-xs text-slate-500 mt-0.5">{endpoints.filter(e => e.is_active).length} de {endpoints.length} ativos</p>
        </div>
        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-md transition-all"
        >
          <Plus size={14} /> Novo Endpoint
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar endpoints..."
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-8 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-slate-700 transition-colors"
          />
        </div>
        <div className="flex rounded-md border border-slate-800 overflow-hidden">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-[11px] font-mono transition-colors ${filter === f ? 'bg-slate-800 text-slate-200' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-900'
                }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map(ep => (
          <div
            key={ep.id}
            className={`group rounded-lg border bg-slate-900/60 hover:bg-slate-900 transition-all ${ep.is_active ? 'border-slate-800/60 hover:border-slate-700' : 'border-slate-800/30 opacity-60 hover:opacity-80'
              }`}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between p-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-md ${ep.is_active ? 'bg-emerald-500/10' : 'bg-slate-800'}`}>
                  <Zap size={14} className={ep.is_active ? 'text-emerald-400' : 'text-slate-600'} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-100">{ep.name}</h3>
                  <p className="text-[11px] text-slate-500 font-mono">/{ep.slug}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${ep.is_active
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : 'text-slate-600 bg-slate-800/60 border-slate-700/40'
                }`}>
                <span className={`w-1 h-1 rounded-full ${ep.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                {ep.is_active ? 'Ativo' : 'Inativo'}
              </div>
            </div>

            {/* Model Badge + Textract badge */}
            <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
              <ModelBadge modelId={ep.aws_model_id} endpointType={ep.endpoint_type} />
              {ep.supports_textract && ep.endpoint_type !== 'textract' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono text-violet-400 bg-violet-500/10 border-violet-500/20">
                  <FileText size={10} /> Textract
                </span>
              )}
            </div>

            {/* Prompt preview */}
            {ep.endpoint_type !== 'textract' && ep.current_prompt && (
              <div className="mx-4 mb-3 p-2.5 rounded-md bg-slate-950/60 border border-slate-800/60">
                <p className="text-[11px] text-slate-500 font-mono mb-1">system_prompt · v{ep.current_prompt.version}</p>
                <p className="text-[12px] text-slate-400 leading-relaxed line-clamp-2">
                  {ep.current_prompt.system_prompt}
                </p>
              </div>
            )}

            {/* Temperature */}
            {ep.endpoint_type !== 'textract' && (
              <div className="px-4 pb-3">
                <p className="text-[10px] text-slate-600 font-mono mb-1.5 uppercase tracking-wider">Temperatura</p>
                <TemperatureBar value={ep.temperature} />
              </div>
            )}

            {/* Card Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800/60">
              <div className="flex items-center gap-1 text-[10px] text-slate-600">
                <Clock size={11} />
                <span className="font-mono">
                  {new Date(ep.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <button
                onClick={() => setEditing(ep)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-slate-400 hover:text-slate-100 border border-slate-700 hover:border-slate-500 rounded-md transition-all bg-slate-900"
              >
                Editar Configuração
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-600">
          <Zap size={32} className="mb-3 opacity-30" />
          <p className="text-sm">Nenhum endpoint encontrado</p>
          <p className="text-xs mt-1">Tente ajustar os filtros</p>
        </div>
      )}

      {editing && (
        <EditModal
          endpoint={editing}
          modelosDaAws={modelosDaAws}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

    </div>
  )
}