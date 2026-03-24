/**
 * ImportPage.tsx — Plugin WP Importer (Walker)
 *
 * UI React para importação de posts do WordPress via arquivo XML (WXR).
 */

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface ImportResult {
    success: boolean;
    posts: { imported: number; skipped: number; errors: string[]; imagesImported: number };
    authors: { imported: number; skipped: number };
    categories: { imported: number; skipped: number };
    errors: string[];
}

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith('.xml') && f.type !== 'text/xml' && f.type !== 'application/xml') {
            setError('Por favor, selecione um arquivo XML exportado do WordPress.');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);
    };

    const handleImport = async () => {
        if (!file) { setError('Selecione um arquivo XML.'); return; }
        setImporting(true);
        setError('');
        setResult(null);
        triggerToast('Processando importação do WordPress...', 'progress', 20);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/admin/plugins/import/wordpress', {
                method: 'POST',
                body: formData,
            });

            const data: ImportResult & { error?: string } = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Erro ${res.status}`);
            }

            setResult(data);
            if (data.success) {
                triggerToast(`Importação concluída! ${data.posts.imported} posts importados.`, 'success');
            } else {
                triggerToast('Importação concluída com erros. Verifique os detalhes.', 'info');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao importar');
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            {/* Instruções */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Como exportar do WordPress</p>
                <ol className="space-y-1.5">
                    {[
                        'No painel WordPress, vá em Ferramentas → Exportar',
                        'Selecione "Todos os posts" ou "Todo o conteúdo"',
                        'Clique em "Baixar arquivo de exportação"',
                        'Faça upload do arquivo .xml aqui',
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* O que será importado */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">O que será importado</p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: '📝', label: 'Posts publicados e rascunhos' },
                        { icon: '👥', label: 'Autores' },
                        { icon: '🏷️', label: 'Categorias' },
                        { icon: '🖼️', label: 'Imagens (quando disponíveis)' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600">
                            <span>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                    Posts com o mesmo slug já existentes serão ignorados. Autores e categorias duplicados também.
                </p>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Arquivo de Exportação (.xml)</p>

                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {file ? (
                        <>
                            <FileText className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                            <p className="font-medium text-slate-800 text-sm">{file.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar</p>
                        </>
                    ) : (
                        <>
                            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-medium text-slate-500 text-sm">Clique para selecionar o arquivo XML</p>
                            <p className="text-xs text-slate-400 mt-1">Arquivo exportado do WordPress (.xml)</p>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Erro */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Resultado */}
            {result && (
                <div className={`bg-white rounded-2xl border shadow-sm p-6 ${result.success ? 'border-green-200' : 'border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className={`w-5 h-5 ${result.success ? 'text-green-500' : 'text-amber-500'}`} />
                        <p className="font-bold text-slate-800">
                            {result.success ? 'Importação concluída!' : 'Importação concluída com erros'}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Posts', imported: result.posts.imported, skipped: result.posts.skipped },
                            { label: 'Autores', imported: result.authors.imported, skipped: result.authors.skipped },
                            { label: 'Categorias', imported: result.categories.imported, skipped: result.categories.skipped },
                        ].map(s => (
                            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-violet-600">{s.imported}</p>
                                <p className="text-xs text-slate-500">{s.label} importados</p>
                                {s.skipped > 0 && <p className="text-xs text-slate-400">{s.skipped} ignorados</p>}
                            </div>
                        ))}
                    </div>

                    {result.posts.imagesImported > 0 && (
                        <p className="text-sm text-slate-600 mb-3">
                            🖼️ {result.posts.imagesImported} imagem(ns) importada(s) com sucesso.
                        </p>
                    )}

                    {result.posts.errors.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros nos posts</p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {result.posts.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{e}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.errors.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros gerais</p>
                            {result.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600">{e}</p>
                            ))}
                        </div>
                    )}

                    <a href="/admin/posts" className="mt-4 inline-block text-sm text-violet-600 hover:underline font-medium">
                        → Ver posts importados
                    </a>
                </div>
            )}

            {/* Botão importar */}
            <button
                type="button"
                onClick={handleImport}
                disabled={importing || !file}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
            >
                {importing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                    <><Upload className="w-4 h-4" /> Importar do WordPress</>
                )}
            </button>

            {importing && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-sm text-violet-700 font-medium">
                        Importando posts e baixando imagens... Isso pode levar alguns minutos dependendo do tamanho do arquivo.
                    </p>
                </div>
            )}
        </div>
    );
}
