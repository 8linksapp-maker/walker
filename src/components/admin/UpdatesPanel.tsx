import React, { useState, useEffect } from 'react';
import {
    RefreshCw, Download, CheckCircle, AlertCircle, Loader2,
    ArrowUpCircle, ExternalLink, FileText, Info,
    ShieldCheck, GitBranch, Eye, X, ChevronDown, ChevronUp
} from 'lucide-react';
import { triggerToast } from './CmsToaster';

type CheckResult = {
    configured: boolean;
    templateRepo?: string;
    current?: string;
    latest?: string;
    hasUpdate?: boolean;
    releaseTag?: string;
    releaseName?: string;
    releaseNotes?: string;
    releaseUrl?: string;
    publishedAt?: string;
    error?: string;
};

type Manifest = {
    version: string;
    files: string[];
    note?: string;
};

type ApplyResult = {
    success: boolean;
    version: string;
    updated: number;
    errors: number;
    skipped: number;
    devMode: boolean;
    results: { file: string; status: 'ok' | 'error'; error?: string }[];
    error?: string;
};

const PROTECTED = ['src/data/', 'src/content/'];

function parseMarkdown(text: string) {
    return text
        .replace(/^### (.+)$/gm, '<h4 class="font-bold text-slate-700 mt-3 mb-1 text-sm">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 class="font-bold text-slate-800 mt-4 mb-2">$1</h3>')
        .replace(/^- (.+)$/gm, '<li class="ml-4 text-slate-600 text-sm list-none">• $1</li>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br/><br/>');
}

// Modal de confirmação
function ConfirmModal({
    manifest, result, onConfirm, onCancel, applying
}: {
    manifest: Manifest;
    result: CheckResult;
    onConfirm: () => void;
    onCancel: () => void;
    applying: boolean;
}) {
    const safe = manifest.files.filter(f => !PROTECTED.some(p => f.startsWith(p)));
    const blocked = manifest.files.filter(f => PROTECTED.some(p => f.startsWith(p)));

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900 text-lg">Confirmar Atualização</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {result.current} → <span className="font-bold text-violet-600">v{result.latest}</span>
                        </p>
                    </div>
                    <button onClick={onCancel} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Arquivos que serão alterados */}
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                            Arquivos que serão atualizados ({safe.length})
                        </p>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-48 overflow-y-auto space-y-1">
                            {safe.map(f => (
                                <div key={f} className="flex items-center gap-2 text-xs">
                                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="font-mono text-slate-600">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Protegidos (nunca alterados) */}
                    <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-green-700">Seus dados estão protegidos</p>
                            <p className="text-xs text-green-600 mt-0.5">
                                Artigos, configurações, imagens e dados em <code className="bg-green-100 px-1 rounded">src/data/</code> e <code className="bg-green-100 px-1 rounded">src/content/</code> nunca são alterados.
                                {blocked.length > 0 && ` (${blocked.length} arquivo(s) do manifesto foram ignorados por segurança)`}
                            </p>
                        </div>
                    </div>

                    {/* Rollback */}
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                        <GitBranch className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-blue-700">Rollback disponível</p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                O Git mantém o histórico completo. Se algo der errado, é possível reverter para a versão anterior no GitHub.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={applying}
                        className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={applying}
                        className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-500 disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                    >
                        {applying
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Atualizando...</>
                            : <><Download className="w-4 h-4" /> Confirmar e Atualizar</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function UpdatesPanel() {
    const [checking, setChecking] = useState(false);
    const [loadingManifest, setLoadingManifest] = useState(false);
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState<CheckResult | null>(null);
    const [manifest, setManifest] = useState<Manifest | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
    const [showNotes, setShowNotes] = useState(true);
    const [currentVersion, setCurrentVersion] = useState('1.0.0');
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/admin/updates')
            .then(r => r.json())
            .then(data => {
                if (data.current) setCurrentVersion(data.current);
            })
            .catch(() => {});
    }, []);

    async function check() {
        setChecking(true);
        setManifest(null);
        setApplyResult(null);
        setShowConfirm(false);
        try {
            const res = await fetch('/api/admin/updates');
            const data = await res.json();
            setResult(data);
            if (data.current) setCurrentVersion(data.current);
            if (data.error) triggerToast('error', data.error);
        } catch {
            triggerToast('error', 'Erro de conexão ao verificar atualizações');
        } finally {
            setChecking(false);
        }
    }

    async function loadManifest() {
        if (!result?.templateRepo || !result?.releaseTag) return;
        setLoadingManifest(true);
        try {
            const url = `https://raw.githubusercontent.com/${result.templateRepo}/${result.releaseTag}/update-manifest.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Manifesto não encontrado nesta release');
            const data: Manifest = await res.json();
            setManifest(data);
            setShowConfirm(true);
        } catch (err: any) {
            triggerToast('error', err.message);
        } finally {
            setLoadingManifest(false);
        }
    }

    async function apply() {
        if (!result?.releaseTag) return;
        setApplying(true);
        try {
            const res = await fetch('/api/admin/updates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ releaseTag: result.releaseTag }),
            });
            const data: ApplyResult = await res.json();
            setApplyResult(data);
            setShowConfirm(false);
            if (data.success) {
                triggerToast('success', `Atualizado para v${data.version}!`);
                setCurrentVersion(data.version);
                setLastUpdated(new Date().toISOString());
                setResult(prev => prev ? { ...prev, hasUpdate: false, current: data.version } : prev);
            } else if (data.error) {
                triggerToast('error', data.error);
            } else {
                triggerToast('error', `${data.errors} arquivo(s) com erro`);
            }
        } catch {
            triggerToast('error', 'Erro ao aplicar atualização');
        } finally {
            setApplying(false);
        }
    }

    return (
        <>
            {/* Modal de confirmação */}
            {showConfirm && manifest && result && (
                <ConfirmModal
                    manifest={manifest}
                    result={result}
                    onConfirm={apply}
                    onCancel={() => setShowConfirm(false)}
                    applying={applying}
                />
            )}

            <div className="max-w-2xl space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <ArrowUpCircle className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Atualizações do Template</h2>
                        <p className="text-sm text-slate-500">Mantenha seu site sempre atualizado</p>
                    </div>
                </div>

                {/* Versão atual + botão verificar */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Versão Instalada</p>
                        <p className="text-2xl font-bold text-slate-800">v{currentVersion}</p>
                        {lastUpdated && (
                            <p className="text-xs text-slate-400 mt-0.5">
                                Atualizado em {new Date(lastUpdated).toLocaleDateString('pt-BR')}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={check}
                        disabled={checking}
                        className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 disabled:opacity-50 transition-all"
                    >
                        {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {checking ? 'Verificando...' : 'Verificar'}
                    </button>
                </div>

                {/* Resultado da verificação */}
                {result && !result.error && result.configured && (
                    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                        result.hasUpdate ? 'border-violet-200' : 'border-slate-200'
                    }`}>
                        {result.hasUpdate ? (
                            <>
                                {/* Cabeçalho da update */}
                                <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                                            <p className="text-sm font-bold text-violet-700">Nova versão disponível!</p>
                                        </div>
                                        <p className="text-2xl font-bold text-slate-800">v{result.latest}</p>
                                        {result.releaseName && <p className="text-sm text-slate-500 mt-0.5">{result.releaseName}</p>}
                                        {result.publishedAt && (
                                            <p className="text-xs text-slate-400 mt-1">
                                                Publicado em {new Date(result.publishedAt).toLocaleDateString('pt-BR')}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button
                                            onClick={loadManifest}
                                            disabled={loadingManifest || applying}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 disabled:opacity-60 transition-all"
                                        >
                                            {loadingManifest
                                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</>
                                                : <><Eye className="w-4 h-4" /> Ver e Atualizar</>
                                            }
                                        </button>
                                        {result.releaseUrl && (
                                            <a
                                                href={result.releaseUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 justify-center"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Ver no GitHub
                                            </a>
                                        )}
                                    </div>
                                </div>

                                {/* Notas do release (expansível) */}
                                {result.releaseNotes && (
                                    <div className="border-b border-slate-100">
                                        <button
                                            onClick={() => setShowNotes(v => !v)}
                                            className="w-full flex items-center justify-between px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                <FileText className="w-3.5 h-3.5" />
                                                O que mudou nesta versão
                                            </span>
                                            {showNotes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        {showNotes && (
                                            <div
                                                className="px-5 pb-4 text-sm text-slate-600 leading-relaxed"
                                                dangerouslySetInnerHTML={{ __html: parseMarkdown(result.releaseNotes) }}
                                            />
                                        )}
                                    </div>
                                )}

                                {/* Aviso de proteção */}
                                <div className="px-5 py-4 flex items-start gap-2 bg-slate-50">
                                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-slate-500">
                                        Seus artigos, configurações e imagens <strong>nunca são alterados</strong>. Você verá exatamente quais arquivos serão modificados antes de confirmar.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="p-5 flex items-center gap-3">
                                <CheckCircle className="w-8 h-8 text-green-500 shrink-0" />
                                <div>
                                    <p className="font-bold text-slate-800">Você está atualizado!</p>
                                    <p className="text-sm text-slate-500">v{result.current} é a versão mais recente.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Resultado após aplicar */}
                {applyResult && (
                    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${
                        applyResult.success ? 'border-green-200' : 'border-red-200'
                    }`}>
                        <div className="flex items-center gap-2 mb-4">
                            {applyResult.success
                                ? <CheckCircle className="w-5 h-5 text-green-500" />
                                : <AlertCircle className="w-5 h-5 text-red-500" />
                            }
                            <p className="font-bold text-slate-800">
                                {applyResult.success ? `Atualizado para v${applyResult.version}` : 'Atualização com erros'}
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            {[
                                { label: 'Atualizados', value: applyResult.updated, color: 'text-green-600' },
                                { label: 'Com erro', value: applyResult.errors, color: 'text-red-600' },
                                { label: 'Ignorados', value: applyResult.skipped, color: 'text-slate-400' },
                            ].map(s => (
                                <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                    <p className="text-xs text-slate-500">{s.label}</p>
                                </div>
                            ))}
                        </div>

                        {applyResult.devMode && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                <strong>Modo dev:</strong> arquivos escritos localmente. Em produção, serão enviados ao GitHub e o Vercel fará o deploy automaticamente.
                            </div>
                        )}

                        {applyResult.results.length > 0 && (
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {applyResult.results.map(r => (
                                    <div key={r.file} className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${
                                        r.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                        {r.status === 'ok'
                                            ? <CheckCircle className="w-3 h-3 shrink-0" />
                                            : <AlertCircle className="w-3 h-3 shrink-0" />
                                        }
                                        <span className="font-mono">{r.file}</span>
                                        {r.error && <span className="ml-auto shrink-0">{r.error}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Erro de verificação */}
                {result?.error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-red-700 text-sm">{result.error}</span>
                    </div>
                )}

                {/* Como funciona */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Como funciona</p>
                    <div className="space-y-2.5">
                        {[
                            { step: '1', text: 'Clique em "Verificar" para ver se há novidades disponíveis' },
                            { step: '2', text: 'Clique em "Ver e Atualizar" para revisar o que vai mudar' },
                            { step: '3', text: 'Confirme — o site é atualizado automaticamente em alguns minutos' },
                        ].map(item => (
                            <div key={item.step} className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {item.step}
                                </span>
                                <p className="text-sm text-slate-600">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
