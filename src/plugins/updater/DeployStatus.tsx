/**
 * DeployStatus.tsx — Banner de status do deploy Vercel
 *
 * Verifica o status do último deployment via GitHub Deployments API.
 * Mostra banner quando há deploy em andamento ou recém-concluído.
 */
import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, AlertCircle, Rocket } from 'lucide-react';

type DeployState = 'idle' | 'building' | 'ready' | 'error';

interface DeployInfo {
    state: DeployState;
    url?: string;
    updatedAt?: string;
    environment?: string;
}

export default function DeployStatus() {
    const [deploy, setDeploy] = useState<DeployInfo>({ state: 'idle' });
    const [visible, setVisible] = useState(false);
    const [fadeOut, setFadeOut] = useState(false);

    const check = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/deploy-status', { credentials: 'same-origin' });
            if (!res.ok) return;
            const data: DeployInfo = await res.json();
            setDeploy(data);

            if (data.state === 'building') {
                setVisible(true);
                setFadeOut(false);
            } else if (data.state === 'ready') {
                setVisible(true);
                // Auto-hide after 8 seconds
                setTimeout(() => { setFadeOut(true); setTimeout(() => setVisible(false), 500); }, 8000);
            } else if (data.state === 'error') {
                setVisible(true);
            } else {
                if (visible && !fadeOut) {
                    setFadeOut(true);
                    setTimeout(() => setVisible(false), 500);
                }
            }
        } catch {}
    }, [visible, fadeOut]);

    useEffect(() => {
        check();
        const interval = setInterval(check, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, [check]);

    if (!visible) return null;

    const styles: Record<DeployState, { bg: string; border: string; text: string; icon: typeof Loader2 }> = {
        idle: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600', icon: Rocket },
        building: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: Loader2 },
        ready: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: CheckCircle },
        error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertCircle },
    };

    const s = styles[deploy.state];
    const Icon = s.icon;

    const messages: Record<DeployState, string> = {
        idle: '',
        building: 'Deploy em andamento... As alterações aparecerão no site em breve.',
        ready: 'Deploy concluído! Seu site foi atualizado.',
        error: 'Erro no deploy. Verifique o painel do Vercel para mais detalhes.',
    };

    return (
        <div className={`fixed top-0 left-64 right-0 z-40 px-6 py-3 ${s.bg} border-b ${s.border} flex items-center gap-3 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
            <Icon className={`w-4 h-4 ${s.text} shrink-0 ${deploy.state === 'building' ? 'animate-spin' : ''}`} />
            <p className={`text-sm font-medium ${s.text}`}>{messages[deploy.state]}</p>
            {deploy.state === 'building' && (
                <div className="ml-auto flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-amber-200 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                </div>
            )}
            {deploy.state !== 'building' && (
                <button onClick={() => { setFadeOut(true); setTimeout(() => setVisible(false), 300); }}
                    className={`ml-auto text-xs font-bold ${s.text} hover:underline`}>
                    Fechar
                </button>
            )}
        </div>
    );
}
