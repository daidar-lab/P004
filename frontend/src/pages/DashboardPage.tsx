import { Activity, Zap, KeyRound, TrendingUp, ArrowUpRight, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { MOCK_ENDPOINTS, MOCK_API_KEYS } from '../data/mockData'

const stats = [
  {
    label: 'Endpoints Ativos',
    value: MOCK_ENDPOINTS.filter(e => e.is_active).length,
    total: MOCK_ENDPOINTS.length,
    icon: Zap,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    label: 'Chaves de API',
    value: MOCK_API_KEYS.filter(k => k.is_active).length,
    total: MOCK_API_KEYS.length,
    icon: KeyRound,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    label: 'Req. Hoje',
    value: '12.4k',
    icon: Activity,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  {
    label: 'Taxa de Sucesso',
    value: '99.2%',
    icon: TrendingUp,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
]

const recentActivity = [
  { endpoint: 'energy', status: 'ok', latency: '342ms', time: 'agora' },
  { endpoint: 'intervention', status: 'ok', latency: '198ms', time: '12s' },
  { endpoint: 'energy', status: 'error', latency: '—', time: '45s' },
  { endpoint: 'report-gen', status: 'ok', latency: '1.2s', time: '1m' },
  { endpoint: 'energy', status: 'ok', latency: '289ms', time: '2m' },
  { endpoint: 'intervention', status: 'ok', latency: '220ms', time: '3m' },
]

export function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold text-slate-100">Visão Geral</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Estado atual do gateway — atualizado em tempo real
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className={`rounded-lg border ${stat.border} ${stat.bg} p-4 flex items-start justify-between`}
            >
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider font-mono">{stat.label}</p>
                <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                {stat.total !== undefined && (
                  <p className="text-[10px] text-slate-600 mt-0.5">{stat.total} total</p>
                )}
              </div>
              <div className={`p-2 rounded-md ${stat.bg}`}>
                <Icon size={16} className={stat.color} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Endpoints status */}
        <div className="lg:col-span-2 rounded-lg border border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Endpoints</h2>
            <span className="text-[11px] text-slate-500">{MOCK_ENDPOINTS.length} configurados</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {MOCK_ENDPOINTS.map((ep) => (
              <div key={ep.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/20 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ep.is_active ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{ep.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">/{ep.slug}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-36">
                    {ep.aws_model_id.split('.')[1]?.split('-').slice(0, 3).join('-') ?? ep.aws_model_id}
                  </p>
                  <p className="text-[10px] text-slate-600">temp: {ep.temperature.toFixed(2)}</p>
                </div>
                <ArrowUpRight size={14} className="text-slate-700 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="rounded-lg border border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
            <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Atividade</h2>
            <Clock size={13} className="text-slate-600" />
          </div>
          <div className="divide-y divide-slate-800/40">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                {a.status === 'ok'
                  ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                  : <XCircle size={13} className="text-rose-500 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-slate-300 font-mono truncate">/{a.endpoint}</p>
                  <p className="text-[10px] text-slate-600">{a.latency}</p>
                </div>
                <span className="text-[10px] text-slate-600 flex-shrink-0">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
