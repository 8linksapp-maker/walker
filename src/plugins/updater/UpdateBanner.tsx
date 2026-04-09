/**
 * UpdateBanner.tsx — Banner de atualizações pendentes
 *
 * Verifica /api/admin/system-updates e mostra banner se há updates.
 * Aparece no topo de TODAS as páginas do admin.
 */
import { useState, useEffect } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';

export default function UpdateBanner() {
    const [count, setCount] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Só verifica 1x por sessão (não spammar a API)
        const key = 'cms_update_check';
        const cached = sessionStorage.getItem(key);
        if (cached) {
            const data = JSON.parse(cached);
            if (Date.now() - data.ts < 5 * 60 * 1000) { // cache 5 min
                setCount(data.count);
                return;
            }
        }

        fetch('/api/admin/system-updates', { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => {
                const total = data.totalUpdates || 0;
                setCount(total);
                sessionStorage.setItem(key, JSON.stringify({ count: total, ts: Date.now() }));
            })
            .catch(() => {});
    }, []);

    if (count === 0 || dismissed) return null;

    return (
        <div className="bg-violet-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
            <ArrowUpCircle className="w-4 h-4 shrink-0" />
            <span>
                <strong>{count} atualização{count > 1 ? 'ões' : ''}</strong> disponível{count > 1 ? 'is' : ''} para o seu site.
            </span>
            <a
                href="/admin/system-updates"
                className="font-bold underline underline-offset-2 hover:text-violet-200 transition-colors"
            >
                Atualizar agora
            </a>
            <button
                onClick={() => setDismissed(true)}
                className="ml-auto text-violet-200 hover:text-white transition-colors"
                aria-label="Fechar"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
