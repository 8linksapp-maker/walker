import React, { useState, useEffect } from 'react';
import { Loader2, LayoutTemplate } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function ContatoEditor() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [contato, setContato] = useState<any>(null);
    const [fileSha, setFileSha] = useState('');
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});

    useEffect(() => {
        githubApi('read', 'src/data/contato.json')
            .then(data => { setContato(JSON.parse(data?.content || "{}")); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSaving(true); setError('');
        triggerToast('Sincronizando Página de Contato...', 'progress', 20);
        try {
            let finalJson = { ...contato };
            for (const [keyPath, fileObj] of Object.entries(pendingUploads)) {
                const base64Content = await fileToBase64(fileObj);
                const fileExt = fileObj.name.split('.').pop() || 'jpg';
                const ghPath = `public/uploads/${Date.now()}-${keyPath}.${fileExt}`;
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload imagem ${ghPath}` });
                if (keyPath === 'seoImg') { if (!finalJson.seo) finalJson.seo = {}; finalJson.seo.image = ghPath.replace('public', ''); }
            }
            const res = await githubApi('write', 'src/data/contato.json', { content: JSON.stringify(finalJson, null, 2), sha: fileSha, message: 'CMS: Customização da Página Contato' });
            setFileSha(res.sha); setContato(finalJson); setPendingUploads({});
            triggerToast('Página de Contato atualizada!', 'success', 100);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        if (uiKey === 'seoImg') setContato({ ...contato, seo: { ...contato?.seo, image: URL.createObjectURL(file) } });
        e.target.value = '';
    };

    const updateField = (section: string, key: string, value: string) => {
        setContato({ ...contato, [section]: { ...(contato[section] || {}), [key]: value } });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-32 text-slate-400 bg-white rounded-2xl border border-slate-200">
            <LayoutTemplate className="w-10 h-10 animate-pulse mb-6 text-slate-300" />
            <p className="font-semibold text-sm animate-pulse text-slate-500">Buscando contato.json...</p>
        </div>
    );

    const cardClass = "p-8 mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm";
    const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm";
    const labelClass = "block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1";

    return (
        <div className="max-w-4xl pb-32">
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Editar Página: Contato</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edita o arquivo <code className="bg-slate-100 px-1 rounded">src/data/contato.json</code></p>
                </div>
                <button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium mb-4">{error}</div>}

            <form onSubmit={handleSave} className="space-y-6">
                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">1. Chamada de Topo (Hero)</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título Principal (H1)</label><input type="text" value={contato?.hero?.title || ''} onChange={e => updateField('hero', 'title', e.target.value)} className={inputClass} /></div>
                        <div><label className={labelClass}>Subtítulo</label><textarea rows={3} value={contato?.hero?.subtitle || ''} onChange={e => updateField('hero', 'subtitle', e.target.value)} className={`${inputClass} resize-y`} /></div>
                    </div>
                </div>

                <div className={cardClass}>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900">2. Textos do Bloco de Informações</h3>
                        <span className="text-[10px] bg-slate-100 text-slate-800 font-bold px-2 py-1 rounded">Contatos reais editados em Configurações</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2"><label className={labelClass}>Título do Box de Informações</label><input type="text" value={contato?.cards?.napTitle || ''} onChange={e => updateField('cards', 'napTitle', e.target.value)} className={inputClass} /></div>
                        {[
                            { key: 'addressLabel', label: 'Aviso de Endereço' },
                            { key: 'phoneLabel', label: 'Aviso de Telefone' },
                            { key: 'emailLabel', label: 'Aviso de E-mail' },
                            { key: 'formSubmitText', label: 'Texto do Botão de Envio' },
                        ].map(f => (
                            <div key={f.key}><label className={labelClass}>{f.label}</label><input type="text" value={contato?.cards?.[f.key] || ''} onChange={e => updateField('cards', f.key, e.target.value)} className={inputClass} /></div>
                        ))}
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">3. Google Maps</h3>
                    <div className="space-y-4">
                        <div>
                            <label className={labelClass}>URL do Google Maps (Embed)</label>
                            <input type="text" value={contato?.googleMapsUrl || ''} onChange={e => setContato({ ...contato, googleMapsUrl: e.target.value })} placeholder="https://www.google.com/maps/embed?pb=..." className={inputClass} />
                            <p className="text-xs text-slate-400 mt-1">Google Maps &rarr; Compartilhar &rarr; Incorporar &rarr; copie a URL do src=""</p>
                        </div>
                    </div>
                </div>

                <div className={cardClass}>
                    <h3 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">SEO</h3>
                    <div className="space-y-4">
                        <div><label className={labelClass}>Título SEO</label><input type="text" value={contato?.seo?.title || ''} onChange={e => updateField('seo', 'title', e.target.value)} className={inputClass} placeholder="Contato | Nome do Site" /></div>
                        <div><label className={labelClass}>Meta Descrição</label><textarea rows={3} value={contato?.seo?.description || ''} onChange={e => updateField('seo', 'description', e.target.value)} className={`${inputClass} resize-y text-xs`} /></div>
                        <div>
                            <label className={labelClass}>Imagem Social (Open Graph)</label>
                            <input type="file" accept="image/*" onChange={e => handleFileSelect(e, 'seoImg')} className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:border-0 file:bg-violet-50 file:text-violet-700" />
                            {contato?.seo?.image && <img src={contato?.seo?.image} className="w-full aspect-video object-cover mt-3 rounded" />}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
