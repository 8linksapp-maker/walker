/**
 * RedirectsManager.tsx — Plugin Redirects Manager
 *
 * CRUD de redirects 301/302.
 * Salva em src/data/redirects.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, ArrowRight } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const REDIRECTS_PATH = 'src/data/redirects.json';

interface Redirect {
  id: string;
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
}

const emptyRedirect = (): Omit<Redirect, 'id'> => ({
  from: '',
  to: '',
  type: 301,
  enabled: true,
  note: '',
});

export default function RedirectsManager() {
  const [redirects, setRedirects] = useState<Redirect[]>([]);
  const [fileSha, setFileSha] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyRedirect());
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    githubApi('read', REDIRECTS_PATH)
      .then(data => {
        const arr = JSON.parse(data.content);
        setRedirects(Array.isArray(arr) ? arr : []);
        setFileSha(data.sha);
      })
      .catch(() => {
        // File may not exist yet
        setRedirects([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveRedirects = async (newList: Redirect[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await githubApi('write', REDIRECTS_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: fileSha || undefined,
        message: 'CMS: Update redirects',
      });
      setFileSha(res.sha || fileSha);
      setRedirects(newList);
      triggerToast('Redirects salvos!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyRedirect());
    setShowForm(true);
  };

  const handleEdit = (r: Redirect) => {
    setEditingId(r.id);
    setForm({ from: r.from, to: r.to, type: r.type, enabled: r.enabled, note: r.note });
    setShowForm(true);
  };

  const handleFormSave = () => {
    if (!form.from.trim() || !form.to.trim()) {
      triggerToast('Preencha os campos "De" e "Para"', 'error');
      return;
    }
    let newList: Redirect[];
    if (editingId) {
      newList = redirects.map(r => r.id === editingId ? { ...form, id: editingId } : r);
    } else {
      newList = [...redirects, { ...form, id: `r_${Date.now()}` }];
    }
    setShowForm(false);
    setEditingId(null);
    saveRedirects(newList);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este redirect?')) return;
    saveRedirects(redirects.filter(r => r.id !== id));
  };

  const handleToggle = (id: string) => {
    saveRedirects(redirects.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm font-mono';
  const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
      <p className="font-medium animate-pulse">Carregando redirects...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{redirects.length} redirect{redirects.length !== 1 ? 's' : ''} configurado{redirects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" /> Novo Redirect
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-800 mb-4">{editingId ? 'Editar Redirect' : 'Novo Redirect'}</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>De (origem)</label>
                <input
                  type="text"
                  value={form.from}
                  onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                  className={inputClass}
                  placeholder="/artigo-antigo"
                />
              </div>
              <div>
                <label className={labelClass}>Para (destino)</label>
                <input
                  type="text"
                  value={form.to}
                  onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                  className={inputClass}
                  placeholder="/blog/artigo-novo ou https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Tipo</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: Number(e.target.value) as 301 | 302 }))}
                  className={inputClass.replace('font-mono', '')}
                >
                  <option value={301}>301 — Permanente</option>
                  <option value={302}>302 — Temporário</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nota (opcional)</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputClass.replace('font-mono', '')}
                  placeholder="Ex: migração do WordPress"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-violet-50 transition-colors w-fit">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm font-medium text-slate-700">Ativo</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleFormSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* Redirects list */}
      {redirects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <ArrowRight className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Nenhum redirect configurado</p>
          <p className="text-slate-400 text-sm mt-1">Clique em "Novo Redirect" para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">De → Para</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-20">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nota</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">Ativo</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {redirects.map(r => (
                <tr key={r.id} className={`${!r.enabled ? 'opacity-40' : ''} hover:bg-slate-50 transition-colors`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{r.from}</code>
                      <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                      <code className="text-xs bg-violet-50 px-2 py-0.5 rounded text-violet-700 truncate max-w-48">{r.to}</code>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.type === 301 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs truncate max-w-40">{r.note || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(r.id)} className="text-slate-400 hover:text-violet-600 transition-colors">
                      {r.enabled
                        ? <ToggleRight className="w-5 h-5 text-violet-600" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleEdit(r)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Para que serve</p>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Use quando renomear ou mover uma página — quem acessar o endereço antigo chega ao novo automaticamente</li>
          <li>• Escolha <strong>301</strong> quando a mudança for definitiva (ex: renomeou um artigo)</li>
          <li>• Escolha <strong>302</strong> quando for temporário (ex: página em manutenção ou promoção por tempo limitado)</li>
          <li>• No campo <strong>De</strong>, coloque o endereço antigo. No campo <strong>Para</strong>, o endereço novo</li>
        </ul>
      </div>
    </div>
  );
}
