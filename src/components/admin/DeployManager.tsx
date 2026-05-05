import React, { useEffect, useState } from 'react';
import { Rocket, AlertCircle, CheckCircle2, Loader2, Clock, X } from 'lucide-react';

type Status = {
    hookConfigured: boolean;
    pendingCommits: number;
    building: boolean;
    lastCommitSha?: string;
    lastCommitMessage?: string;
    lastCommitAt?: string;
    lastDeployedSha?: string;
    lastDeployedAt?: string;
    error?: string;
};

type UiState = 'loading' | 'up_to_date' | 'pending' | 'deploying' | 'success' | 'error' | 'snoozed' | 'not_configured';

const SNOOZE_KEY = 'cms_deploy_snooze_until';
const SNOOZE_HOURS = 4;
// Apos clicar Fazer Deploy, ficamos em 'deploying' por ate 4min mesmo que GitHub Deployments API
// ainda nao tenha registrado o build — evita o aluno clicar varias vezes pensando que nao funcionou.
const PENDING_BUILD_GRACE_MS = 4 * 60 * 1000;
const PENDING_DEPLOY_KEY = 'cms_pending_deploy';

function readPendingDeploy(): { sha: string; startedAt: number } | null {
    try {
        const raw = sessionStorage.getItem(PENDING_DEPLOY_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj?.sha || !obj?.startedAt) return null;
        return obj;
    } catch { return null; }
}

function writePendingDeploy(sha: string) {
    try { sessionStorage.setItem(PENDING_DEPLOY_KEY, JSON.stringify({ sha, startedAt: Date.now() })); } catch { }
}

function clearPendingDeploy() {
    try { sessionStorage.removeItem(PENDING_DEPLOY_KEY); } catch { }
}

function readSnooze(): number {
    try {
        const raw = sessionStorage.getItem(SNOOZE_KEY);
        if (!raw) return 0;
        const ts = parseInt(raw, 10);
        return Number.isFinite(ts) ? ts : 0;
    } catch { return 0; }
}

function writeSnooze(until: number) {
    try { sessionStorage.setItem(SNOOZE_KEY, String(until)); } catch { }
}

function clearSnooze() {
    try { sessionStorage.removeItem(SNOOZE_KEY); } catch { }
}

export default function DeployManager() {
    const [status, setStatus] = useState<Status | null>(null);
    const [ui, setUi] = useState<UiState>('loading');
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [deployingNow, setDeployingNow] = useState(false);
    const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
    const [showSuccess, setShowSuccess] = useState(false);

    async function fetchStatus() {
        try {
            const r = await fetch('/api/admin/deploy', { credentials: 'include' });
            if (!r.ok) {
                if (r.status === 401) return;
                setUi('error');
                setErrorMsg('Não foi possível verificar status do deploy.');
                return;
            }
            const data = await r.json() as Status;
            setStatus(data);

            if (!data.hookConfigured) { setUi('not_configured'); return; }

            // Se acabamos de clicar Deploy, manter UI 'deploying' ate o GitHub Deployments
            // confirmar o sha OU ate o grace timeout. Isso evita o aluno clicar varias vezes
            // achando que nao funcionou enquanto a Vercel ainda nao registrou o deployment.
            const pending = readPendingDeploy();
            if (pending) {
                const elapsed = Date.now() - pending.startedAt;
                const buildCompleted = data.lastDeployedSha && data.lastDeployedSha === pending.sha;
                const expired = elapsed > PENDING_BUILD_GRACE_MS;
                if (buildCompleted) {
                    clearPendingDeploy();
                    setDeployingNow(false);
                    if (data.pendingCommits > 0) { setUi('pending'); return; }
                    setUi('up_to_date');
                    return;
                }
                if (expired) {
                    clearPendingDeploy();
                    setDeployingNow(false);
                    // segue pro fluxo normal abaixo
                } else {
                    setUi('deploying');
                    return;
                }
            }

            const snoozeTs = readSnooze();
            if (snoozeTs > Date.now() && data.pendingCommits > 0 && !data.building) {
                setSnoozedUntil(snoozeTs);
                setUi('snoozed');
                return;
            }

            if (data.building) { setUi('deploying'); return; }
            if (data.pendingCommits > 0) { setUi('pending'); return; }
            setUi('up_to_date');
        } catch (e: any) {
            setUi('error');
            setErrorMsg(e?.message || 'Erro de conexão');
        }
    }

    useEffect(() => {
        fetchStatus();
        const id = setInterval(fetchStatus, 15_000);
        return () => clearInterval(id);
    }, []);

    async function triggerDeploy() {
        // Marca o sha que esta sendo deployado para o fetchStatus saber esperar
        const targetSha = status?.lastCommitSha || '';
        if (targetSha) writePendingDeploy(targetSha);

        setDeployingNow(true);
        setUi('deploying');
        clearSnooze();
        setSnoozedUntil(0);
        try {
            const r = await fetch('/api/admin/deploy', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } });
            const data = await r.json();
            if (!r.ok) {
                clearPendingDeploy();
                setUi('error');
                setErrorMsg(data.error || 'Falha ao iniciar deploy.');
                setDeployingNow(false);
                return;
            }
            setShowSuccess(true);
            // Apos 4s, esconde o banner verde mas NAO reseta deployingNow — o fetchStatus se vira
            // ate o build aparecer no GitHub Deployments OU o grace timeout estourar.
            setTimeout(() => { setShowSuccess(false); fetchStatus(); }, 4000);
        } catch (e: any) {
            clearPendingDeploy();
            setUi('error');
            setErrorMsg(e?.message || 'Erro de conexão');
            setDeployingNow(false);
        }
    }

    function snooze() {
        const until = Date.now() + SNOOZE_HOURS * 60 * 60 * 1000;
        writeSnooze(until);
        setSnoozedUntil(until);
        setUi('snoozed');
    }

    function unsnooze() {
        clearSnooze();
        setSnoozedUntil(0);
        fetchStatus();
    }

    if (ui === 'loading' || ui === 'up_to_date') return null;

    if (showSuccess) {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">Deploy iniciado! O site será atualizado em ~1 minuto.</p>
            </div>
        );
    }

    if (ui === 'not_configured') {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-slate-500 shrink-0" />
                <p className="text-sm text-slate-700">
                    Deploy manual ainda não está configurado neste site. Contate o suporte para ativar.
                </p>
            </div>
        );
    }

    if (ui === 'error') {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-red-800">Erro ao verificar deploy</p>
                        <p className="text-xs text-red-700 mt-0.5">{errorMsg}</p>
                    </div>
                </div>
                <button onClick={fetchStatus} className="text-xs font-medium text-red-700 underline hover:text-red-900">Tentar novamente</button>
            </div>
        );
    }

    if (ui === 'deploying') {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 shrink-0 animate-spin" />
                <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">Publicando no ar...</p>
                    <p className="text-xs text-blue-700 mt-0.5">As alterações estarão visíveis em ~1 a 2 minutos. Você não precisa clicar de novo.</p>
                </div>
            </div>
        );
    }

    if (ui === 'snoozed') {
        const minsLeft = Math.max(1, Math.round((snoozedUntil - Date.now()) / 60000));
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 mb-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-600">
                        Aviso de deploy oculto por ~{minsLeft >= 60 ? `${Math.round(minsLeft/60)}h` : `${minsLeft}min`}.
                        Suas alterações ainda não estão no ar.
                    </p>
                </div>
                <button onClick={unsnooze} className="text-xs font-medium text-violet-700 hover:text-violet-900 underline">Mostrar agora</button>
            </div>
        );
    }

    // pending
    const count = status?.pendingCommits ?? 0;
    const lastMsg = status?.lastCommitMessage ?? '';
    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-900">
                        {count === 1 ? 'Você tem 1 alteração não publicada' : `Você tem ${count} alterações não publicadas`}
                    </p>
                    <p className="text-xs text-amber-800 mt-0.5">
                        Para que apareçam no site, clique em <strong>Fazer Deploy</strong>.{lastMsg ? <span className="text-amber-700"> Última: "{lastMsg}"</span> : null}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={snooze}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 px-3 py-2"
                    title={`Esconder por ${SNOOZE_HOURS}h`}
                >
                    Lembrar depois
                </button>
                <button
                    onClick={triggerDeploy}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
                >
                    <Rocket className="w-4 h-4" />
                    Fazer Deploy
                </button>
            </div>
        </div>
    );
}
