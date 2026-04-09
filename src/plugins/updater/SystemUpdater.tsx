/**
 * SystemUpdater.tsx — Painel unificado de atualizações (core + plugins)
 */
import { useState, useEffect } from 'react';
import {
    RefreshCw, Download, CheckCircle, ArrowUpCircle,
    Loader2, AlertCircle, Package, Sparkles, Zap,
    ChevronDown, ChevronUp, ExternalLink, ShieldCheck,
} from 'lucide-react';

interface PluginStatus {
    name: string;
    installedVersion: string | null;
    latestVersion: string;
    hasUpdate: boolean;
    isInstalled: boolean;
    description?: string;
}

interface CoreStatus {
    current: string;
    latest: string;
    hasUpdate: boolean;
    releaseTag: string;
    releaseName: string;
    releaseNotes: string;
    releaseUrl: string;
    publishedAt: string;
}

interface UpdateResult {
    item: string;
    status: 'ok' | 'skipped' | 'error';
    detail?: string;
}

export default function SystemUpdater() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [core, setCore] = useState<CoreStatus | null>(null);
    const [plugins, setPlugins] = useState<PluginStatus[]>([]);
    const [totalUpdates, setTotalUpdates] = useState(0);

    const [updating, setUpdating] = useState(false);
    const [updateTarget, setUpdateTarget] = useState('');
    const [results, setResults] = useState<UpdateResult[] | null>(null);
    const [showNotes, setShowNotes] = useState(false);
    const [showPlugins, setShowPlugins] = useState(true);

    const load = () => {
        setLoading(true);
        setError('');
        setResults(null);
        fetch('/api/admin/system-updates', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setCore(data.core);
                setPlugins(data.plugins ?? []);
                setTotalUpdates(data.totalUpdates ?? 0);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(load, []);

    const doUpdate = async (action: string, plugin?: string) => {
        setUpdating(true);
        setUpdateTarget(plugin || action);
        setResults(null);
        try {
            const body: any = { action };
            if (plugin) body.plugin = plugin;
            if (core?.releaseTag) body.releaseTag = core.releaseTag;

            const res = await fetch('/api/admin/system-updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResults(data.results ?? []);
            // Reload status
            setTimeout(load, 1500);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setUpdating(false);
            setUpdateTarget('');
        }
    };

    const pluginUpdates = plugins.filter(p => p.hasUpdate);
    const installed = plugins.filter(p => p.isInstalled);
    const available = plugins.filter(p => !p.isInstalled);

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Verificando atualizações...</p>
        </div>
    );

    if (error && !core) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0 mt-0.5" />
            <div>
                <h3 className="text-xl font-bold mb-2">Erro ao verificar atualizações</h3>
                <p className="text-sm">{error}</p>
                <button onClick={load} className="mt-4 text-sm font-bold underline">Tentar novamente</button>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header + Refresh */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <ArrowUpCircle className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Atualizações do Sistema</h2>
                        <p className="text-sm text-slate-500">Template e plugins em um só lugar</p>
                    </div>
                </div>
                <button
                    onClick={load}
                    disabled={updating}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-violet-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className="w-4 h-4" />
                    Verificar
                </button>
            </div>

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Template</p>
                    <p className="text-2xl font-bold text-slate-800">v{core?.current}</p>
                    {core?.hasUpdate && (
                        <p className="text-xs font-bold text-amber-600 mt-1">v{core.latest} disponível</p>
                    )}
                    {!core?.hasUpdate && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Atualizado
                        </p>
                    )}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Plugins</p>
                    <p className="text-2xl font-bold text-slate-800">{installed.length}</p>
                    {pluginUpdates.length > 0 && (
                        <p className="text-xs font-bold text-amber-600 mt-1">{pluginUpdates.length} update(s)</p>
                    )}
                    {pluginUpdates.length === 0 && (
                        <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Todos atualizados
                        </p>
                    )}
                </div>
            </div>

            {/* Update All button */}
            {totalUpdates > 0 && (
                <button
                    onClick={() => doUpdate('update-all')}
                    disabled={updating}
                    className="w-full flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white px-6 py-4 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-violet-600/20"
                >
                    {updating && updateTarget === 'update-all' ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Atualizando tudo...</>
                    ) : (
                        <><Zap className="w-5 h-5" /> Atualizar Tudo ({totalUpdates} update{totalUpdates > 1 ? 's' : ''})</>
                    )}
                </button>
            )}

            {/* Restore All — aparece quando há muitos plugins não registrados */}
            {available.length > 5 && !results && (
                <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
                    <div className="flex items-start gap-3 mb-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-slate-800 text-sm">Plugins desconectados?</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Seus plugins estão no site mas não aparecem como instalados. Clique abaixo para restaurar o registro de todos de uma vez.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => doUpdate('restore-all')}
                        disabled={updating}
                        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white px-4 py-3 rounded-xl text-sm font-bold transition-all"
                    >
                        {updating && updateTarget === 'restore-all' ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Restaurando...</>
                        ) : (
                            <><Download className="w-4 h-4" /> Restaurar Todos os Plugins</>
                        )}
                    </button>
                </div>
            )}

            {totalUpdates === 0 && !results && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-emerald-500 shrink-0" />
                    <div>
                        <p className="font-bold text-slate-800">Tudo atualizado!</p>
                        <p className="text-sm text-slate-500">Template e plugins estão na versão mais recente.</p>
                    </div>
                </div>
            )}

            {/* Results */}
            {results && results.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Resultado da atualização</p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {results.map((r, i) => (
                            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${
                                r.status === 'ok' ? 'bg-emerald-50 text-emerald-700' :
                                r.status === 'skipped' ? 'bg-slate-50 text-slate-500' :
                                'bg-red-50 text-red-700'
                            }`}>
                                {r.status === 'ok' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> :
                                 r.status === 'skipped' ? <Package className="w-3.5 h-3.5 shrink-0" /> :
                                 <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                                <span className="font-medium">{r.item}</span>
                                {r.detail && <span className="ml-auto text-xs opacity-70">{r.detail}</span>}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700">
                            O Vercel fará o deploy automaticamente em alguns minutos. Seus artigos e configurações <strong>não são alterados</strong>.
                        </p>
                    </div>
                </div>
            )}

            {/* Core release notes */}
            {core?.hasUpdate && core.releaseNotes && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowNotes(v => !v)}
                        className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                        <span>Notas da versão {core.latest}</span>
                        {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showNotes && (
                        <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                            {core.releaseNotes}
                            {core.releaseUrl && (
                                <a href={core.releaseUrl} target="_blank" rel="noopener noreferrer"
                                   className="mt-3 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                                    <ExternalLink className="w-3 h-3" /> Ver no GitHub
                                </a>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Plugin updates detail */}
            {pluginUpdates.length > 0 && (
                <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-5">
                    <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">
                        Plugins com atualização ({pluginUpdates.length})
                    </p>
                    <div className="space-y-2">
                        {pluginUpdates.map(p => (
                            <div key={p.name} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl">
                                <Package className="w-4 h-4 text-amber-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                                    <span className="text-xs text-slate-400 ml-2">v{p.installedVersion} → v{p.latestVersion}</span>
                                </div>
                                <button
                                    onClick={() => doUpdate('update-plugin', p.name)}
                                    disabled={updating}
                                    className="text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {updating && updateTarget === p.name ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Atualizar'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Installed plugins (collapsible) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <button
                    onClick={() => setShowPlugins(v => !v)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Plugins Instalados ({installed.filter(p => !p.hasUpdate).length})
                        </span>
                    </div>
                    {showPlugins ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {showPlugins && (
                    <div className="px-5 pb-4 space-y-1.5">
                        {installed.filter(p => !p.hasUpdate).map(p => (
                            <div key={p.name} className="flex items-center gap-3 text-sm text-slate-600 py-1.5">
                                <Package className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-slate-400 font-mono">v{p.installedVersion}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Available to install */}
            {available.length > 0 && (
                <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <p className="text-xs font-bold text-violet-600 uppercase tracking-widest">
                            Disponíveis para Instalar ({available.length})
                        </p>
                    </div>
                    <div className="space-y-2">
                        {available.map(p => (
                            <div key={p.name} className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-xl">
                                <Package className="w-4 h-4 text-violet-400 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                                    <span className="text-xs text-violet-500 ml-2">v{p.latestVersion}</span>
                                    {p.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{p.description}</p>}
                                </div>
                                <button
                                    onClick={() => doUpdate('update-plugin', p.name)}
                                    disabled={updating}
                                    className="text-xs font-bold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                    {updating && updateTarget === p.name
                                        ? <Loader2 className="w-3 h-3 animate-spin" />
                                        : <><Download className="w-3 h-3" /> Instalar</>}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error banner */}
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
