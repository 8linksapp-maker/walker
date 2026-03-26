/**
 * PluginUpdatesPanel.tsx
 * Mostra o status de cada plugin instalado vs versão disponível no cms-plugins.
 * Permite atualizar plugins existentes ou instalar novos com 1 clique.
 */
import { useState, useEffect } from 'react';
import {
    RefreshCw, Download, CheckCircle, ArrowUpCircle,
    Loader2, AlertCircle, Package, Sparkles,
} from 'lucide-react';

interface PluginStatus {
    name: string;
    label: string;
    installedVersion: string | null;
    latestVersion: string;
    hasUpdate: boolean;
    isInstalled: boolean;
    description?: string;
    changelog?: string;
}

type ActionState = 'idle' | 'loading' | 'done' | 'error';

export default function PluginUpdatesPanel() {
    const [plugins, setPlugins] = useState<PluginStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actions, setActions] = useState<Record<string, ActionState>>({});
    const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

    const load = () => {
        setLoading(true);
        setError('');
        fetch('/api/admin/plugin-updates')
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setPlugins(data.plugins ?? []);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const handleAction = async (plugin: PluginStatus, action: 'update' | 'install') => {
        setActions(a => ({ ...a, [plugin.name]: 'loading' }));
        setActionErrors(e => ({ ...e, [plugin.name]: '' }));
        try {
            const res = await fetch('/api/admin/plugin-updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plugin: plugin.name, action }),
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`);
            setActions(a => ({ ...a, [plugin.name]: 'done' }));
            setPlugins(prev => prev.map(p =>
                p.name === plugin.name
                    ? { ...p, installedVersion: data.version, hasUpdate: false, isInstalled: true }
                    : p,
            ));
        } catch (e: any) {
            setActions(a => ({ ...a, [plugin.name]: 'error' }));
            setActionErrors(ae => ({ ...ae, [plugin.name]: e.message }));
        }
    };

    const installed = plugins.filter(p => p.isInstalled);
    const available = plugins.filter(p => !p.isInstalled);
    const updates = installed.filter(p => p.hasUpdate);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Verificando atualizações...</p>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0 mt-0.5" />
            <div>
                <h3 className="text-xl font-bold mb-2">Erro ao verificar plugins</h3>
                <p className="text-sm">{error}</p>
                <button onClick={load} className="mt-4 text-sm font-bold underline">Tentar novamente</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {/* Reload button */}
            <div className="flex justify-end">
                <button
                    onClick={load}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-violet-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Verificar novamente
                </button>
            </div>

            {/* Updates available */}
            {updates.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <ArrowUpCircle className="w-5 h-5 text-amber-500" />
                        <h2 className="font-bold text-slate-800">Atualizações Disponíveis</h2>
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{updates.length}</span>
                    </div>
                    <div className="space-y-3">
                        {updates.map(p => (
                            <PluginCard
                                key={p.name}
                                plugin={p}
                                actionState={actions[p.name] ?? 'idle'}
                                actionError={actionErrors[p.name] ?? ''}
                                onAction={() => handleAction(p, 'update')}
                                actionLabel="Atualizar"
                                highlight="amber"
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Installed plugins */}
            {installed.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <h2 className="font-bold text-slate-800">Plugins Instalados</h2>
                        <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{installed.length}</span>
                    </div>
                    <div className="space-y-3">
                        {installed.filter(p => !p.hasUpdate).map(p => (
                            <PluginCard
                                key={p.name}
                                plugin={p}
                                actionState={actions[p.name] ?? 'idle'}
                                actionError={actionErrors[p.name] ?? ''}
                                onAction={() => handleAction(p, 'update')}
                                actionLabel="Reinstalar"
                                highlight="none"
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Available to install */}
            {available.length > 0 && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-5 h-5 text-violet-500" />
                        <h2 className="font-bold text-slate-800">Disponíveis para Instalar</h2>
                        <span className="text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">{available.length}</span>
                    </div>
                    <div className="space-y-3">
                        {available.map(p => (
                            <PluginCard
                                key={p.name}
                                plugin={p}
                                actionState={actions[p.name] ?? 'idle'}
                                actionError={actionErrors[p.name] ?? ''}
                                onAction={() => handleAction(p, 'install')}
                                actionLabel="Instalar"
                                highlight="violet"
                            />
                        ))}
                    </div>
                </section>
            )}

            {plugins.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum plugin encontrado no registro</p>
                </div>
            )}

            {/* Info */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Como funciona</p>
                <ul className="space-y-1 text-sm text-blue-800">
                    <li>• Clique em <strong>Instalar</strong> ou <strong>Atualizar</strong> para ativar a funcionalidade no seu site</li>
                    <li>• O site é atualizado automaticamente em cerca de 2 minutos após a ação</li>
                    <li>• Você não precisa mexer em nenhum código — tudo acontece sozinho</li>
                </ul>
            </div>
        </div>
    );
}

// ─── PluginCard ───────────────────────────────────────────────────────────────

function PluginCard({
    plugin, actionState, actionError, onAction, actionLabel, highlight,
}: {
    plugin: PluginStatus;
    actionState: ActionState;
    actionError: string;
    onAction: () => void;
    actionLabel: string;
    highlight: 'amber' | 'violet' | 'none';
}) {
    const borderColor = highlight === 'amber'
        ? 'border-amber-200 bg-amber-50/30'
        : highlight === 'violet'
            ? 'border-violet-200 bg-violet-50/30'
            : 'border-slate-200 bg-white';

    const btnColor = highlight === 'amber'
        ? 'bg-amber-500 hover:bg-amber-600'
        : highlight === 'violet'
            ? 'bg-violet-600 hover:bg-violet-700'
            : 'bg-slate-500 hover:bg-slate-600';

    return (
        <div className={`rounded-2xl border p-5 flex items-center gap-4 ${borderColor}`}>
            <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-slate-400" />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{plugin.label || plugin.name}</span>
                    {plugin.isInstalled && (
                        <span className="text-xs text-slate-400 font-mono">v{plugin.installedVersion}</span>
                    )}
                    {plugin.hasUpdate && (
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            → v{plugin.latestVersion}
                        </span>
                    )}
                    {!plugin.isInstalled && (
                        <span className="text-xs font-bold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full">
                            v{plugin.latestVersion}
                        </span>
                    )}
                </div>
                {plugin.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{plugin.description}</p>
                )}
                {plugin.changelog && plugin.hasUpdate && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">✦ {plugin.changelog}</p>
                )}
                {actionError && (
                    <p className="text-xs text-red-600 mt-1 font-medium">{actionError}</p>
                )}
            </div>

            <div className="shrink-0">
                {actionState === 'done' ? (
                    <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                        <CheckCircle className="w-4 h-4" /> Pronto
                    </span>
                ) : (
                    <button
                        onClick={onAction}
                        disabled={actionState === 'loading'}
                        className={`flex items-center gap-2 ${btnColor} disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all`}
                    >
                        {actionState === 'loading'
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : actionLabel === 'Instalar'
                                ? <Download className="w-3.5 h-3.5" />
                                : <ArrowUpCircle className="w-3.5 h-3.5" />
                        }
                        {actionState === 'loading' ? 'Aguarde...' : actionLabel}
                    </button>
                )}
            </div>
        </div>
    );
}
