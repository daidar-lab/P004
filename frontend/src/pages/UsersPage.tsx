import { useState, useEffect } from 'react';
import { Users, Plus, Shield, User, Lock, Edit2, Trash2, ShieldAlert, Check } from 'lucide-react';
import type { User as UserType } from '../App';

interface UsersPageProps {
  currentUser: UserType;
}

export function UsersPage({ currentUser }: UsersPageProps) {
  const [users, setUsers] = useState<UserType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados de criação e edição
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  
  // Campos do formulário
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const response = await fetch('http://localhost:3334/v1/users');
      if (!response.ok) throw new Error('Falha ao buscar usuários');
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }

  const openCreateForm = () => {
    setEditingUser(null);
    setUsername('');
    setName('');
    setPassword('');
    setRole('user');
    setIsFormOpen(true);
  };

  const openEditForm = (user: UserType) => {
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name);
    setPassword(''); // Deixar em branco por padrão ao editar
    setRole(user.role);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || (!editingUser && !password.trim())) {
      alert('Preencha os campos obrigatórios.');
      return;
    }

    try {
      const url = editingUser 
        ? `http://localhost:3334/v1/users/${editingUser.id}` 
        : 'http://localhost:3334/v1/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim(),
          role,
          ...(password ? { password } : {})
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar usuário');
      }

      if (editingUser) {
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, username, name, role } : u));
      } else {
        setUsers([data, ...users]);
      }

      setIsFormOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser.id) {
      alert('Você não pode excluir a sua própria conta ativa.');
      return;
    }

    if (!confirm('Tem certeza de que deseja remover este usuário?')) return;

    try {
      const response = await fetch(`http://localhost:3334/v1/users/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao excluir usuário');
      }

      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto font-mono">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Users size={18} className="text-emerald-400" />
            Configuração de Usuários
          </h1>
          <p className="text-xs text-slate-500 mt-1">Gerencie os usuários do dashboard e configure suas permissões.</p>
        </div>
        <button 
          onClick={openCreateForm}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded-md transition-all cursor-pointer"
        >
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      {error && (
        <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-md flex items-center gap-2">
          <ShieldAlert size={16} /> {error}
        </div>
      )}

      {/* Formulário Inline */}
      {isFormOpen && (
        <form onSubmit={handleSave} className="p-5 bg-slate-900 border border-slate-800 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            {editingUser ? 'Editar Usuário' : 'Novo Cadastro de Usuário'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Nome Completo</label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Ex: joao.silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">
                Senha {editingUser && <span className="text-[10px] text-slate-500 lowercase">(deixe em branco para manter a atual)</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Cargo / Função</label>
              <select
                value={role}
                onChange={e => setRole(e.target.value as 'admin' | 'user')}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500/60 cursor-pointer"
              >
                <option value="user">User (Visualizador)</option>
                <option value="admin">Admin (Administrador)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={() => { setIsFormOpen(false); setEditingUser(null); }}
              className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-md border border-slate-700 transition-all cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="text-sm text-slate-500 text-center py-12">Carregando usuários...</div>
      ) : (
        <div className="space-y-3">
          {users.length === 0 && (
            <div className="text-center py-12 border border-slate-800/50 border-dashed rounded-xl bg-slate-900/30">
              <Users size={24} className="mx-auto text-slate-600 mb-3" />
              <p className="text-sm text-slate-400">Nenhum usuário cadastrado.</p>
            </div>
          )}

          {users.map(u => {
            const isMe = u.id === currentUser.id;
            return (
              <div 
                key={u.id} 
                className="flex items-center justify-between p-4 rounded-lg border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <User size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-slate-100">{u.name}</h3>
                      {isMe && (
                        <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                          Você
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">@{u.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Cargo */}
                  <div className="flex items-center gap-1.5">
                    {u.role === 'admin' ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        <Shield size={10} /> Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
                        User
                      </span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditForm(u)}
                      className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                      title="Editar usuário"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={isMe}
                      className={`p-1.5 rounded transition-colors ${
                        isMe 
                          ? 'text-slate-800 cursor-not-allowed' 
                          : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer'
                      }`}
                      title={isMe ? 'Não é possível excluir seu próprio usuário' : 'Excluir usuário'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
