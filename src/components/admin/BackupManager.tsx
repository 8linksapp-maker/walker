import React, { useState, useRef } from 'react';
import {
  Download, Upload, FileArchive, CheckCircle2, AlertTriangle, Loader2, X, Info, FileText, Image as ImageIcon,
} from 'lucide-react';
import { triggerToast } from './CmsToaster';

type PreviewItem = { name: string; size: number; exists: boolean; status?: 'created' | 'skipped' | 'overwritten' | 'error'; error?: string };
type PreviewResult = {
  manifest?: any;
  posts: PreviewItem[];
  images: PreviewItem[];
  total_size: number;
  applied?: boolean;
};

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function BackupManager({ siteName }: { siteName: string }) {
  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [conflictPolicy, setConflictPolicy] = useState<'skip' | 'overwrite'>('skip');

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/export?site=${encodeURIComponent(siteName)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const postsCount = res.headers.get('X-Posts-Count') || '?';
      const imagesCount = res.headers.get('X-Images-Count') || '?';
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cd = res.headers.get('Content-Disposition') || '';
      const fnameMatch = cd.match(/filename="([^"]+)"/);
      a.download = fnameMatch?.[1] || `msia-export.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      triggerToast(`Exportado: ${postsCount} posts + ${imagesCount} imagens`, 'success');
    } catch (err: any) {
      triggerToast(`Erro: ${err.message || err}`, 'error');
    } finally {
      setExporting(false);
    }
  }

  async function handleFilePicked(file: File | null) {
    setSelectedFile(file);
    setPreview(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      triggerToast('Selecione um arquivo .zip', 'error');
      return;
    }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mode', 'preview');
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
    } catch (err: any) {
      triggerToast(`Erro na leitura: ${err.message || err}`, 'error');
      setSelectedFile(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApplyImport() {
    if (!selectedFile || !preview) return;
    const conflicts = preview.posts.filter(p => p.exists).length + preview.images.filter(p => p.exists).length;
    if (conflicts > 0 && conflictPolicy === 'overwrite') {
      if (!confirm(`Tem ${conflicts} arquivo(s) com conflito. Eles serão SOBRESCRITOS. Confirma?`)) return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('mode', 'apply');
      fd.append('conflict', conflictPolicy);
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data: PreviewResult = await res.json();
      setPreview(data);
      const created = [...data.posts, ...data.images].filter(x => x.status === 'created').length;
      const overw = [...data.posts, ...data.images].filter(x => x.status === 'overwritten').length;
      const skipped = [...data.posts, ...data.images].filter(x => x.status === 'skipped').length;
      const errors = [...data.posts, ...data.images].filter(x => x.status === 'error').length;
      const msg = [
        created > 0 && `${created} criados`,
        overw > 0 && `${overw} sobrescritos`,
        skipped > 0 && `${skipped} pulados`,
        errors > 0 && `${errors} erros`,
      ].filter(Boolean).join(' · ');
      triggerToast(`Import concluído: ${msg}`, errors > 0 ? 'error' : 'success');
    } catch (err: any) {
      triggerToast(`Erro no import: ${err.message || err}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setSelectedFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const conflictsCount = preview ? preview.posts.filter(p => p.exists).length + preview.images.filter(p => p.exists).length : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
            <FileArchive className="w-6 h-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Backup de posts
            </h1>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Migre posts entre sites MSIA. O arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.zip</code> inclui todos os posts (markdown) + imagens referenciadas neles. Sem produtos, sem landings, sem configuração — só conteúdo editorial.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EXPORT */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-700" />
            </div>
            <h2 className="font-bold text-slate-900">Exportar</h2>
          </div>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Baixa um <code className="bg-slate-100 px-1 rounded text-xs">.zip</code> com todos os posts deste site + imagens.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Empacotando…' : 'Baixar export.zip'}
          </button>
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed">
            <Info className="w-3 h-3 inline-block mr-1" />
            Em produção, lê direto do GitHub do site (5000 req/h). Em dev, lê do filesystem local.
          </div>
        </div>

        {/* IMPORT */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
              <Upload className="w-5 h-5 text-amber-700" />
            </div>
            <h2 className="font-bold text-slate-900">Importar</h2>
          </div>
          <p className="text-sm text-slate-600 mb-5 leading-relaxed">
            Receba posts de outro site MSIA. Faça preview antes de aplicar.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => handleFilePicked(e.target.files?.[0] || null)}
          />
          {!selectedFile ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Selecionar .zip
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <FileArchive className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-mono text-xs text-slate-700 truncate">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">({fmtBytes(selectedFile.size)})</span>
              </div>
              <button onClick={reset} className="text-slate-400 hover:text-red-600 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PREVIEW */}
      {(previewing || preview) && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          {previewing ? (
            <div className="flex items-center justify-center py-12 text-slate-500 gap-3">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Lendo zip…</span>
            </div>
          ) : preview && (
            <>
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {preview.applied ? 'Importação concluída' : 'Preview do import'}
                  </h2>
                  {preview.manifest && (
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      origem: <span className="text-slate-700">{preview.manifest.source_site || '?'}</span>
                      {' · '}exportado em: <span className="text-slate-700">{preview.manifest.exported_at?.slice(0, 10) || '?'}</span>
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span><strong className="text-slate-900">{preview.posts.length}</strong> <span className="text-slate-500">posts</span></span>
                  <span><strong className="text-slate-900">{preview.images.length}</strong> <span className="text-slate-500">imagens</span></span>
                  <span className="text-slate-400">{fmtBytes(preview.total_size)}</span>
                </div>
              </div>

              {conflictsCount > 0 && !preview.applied && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-2">
                        {conflictsCount} arquivo(s) já existem no site
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setConflictPolicy('skip')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            conflictPolicy === 'skip'
                              ? 'bg-amber-700 text-white'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          Pular conflitos (default)
                        </button>
                        <button
                          onClick={() => setConflictPolicy('overwrite')}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                            conflictPolicy === 'overwrite'
                              ? 'bg-red-700 text-white'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-red-300'
                          }`}
                        >
                          Sobrescrever todos
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabelas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FileTable title="Posts" icon={FileText} items={preview.posts} />
                <FileTable title="Imagens" icon={ImageIcon} items={preview.images} />
              </div>

              {!preview.applied && (
                <div className="mt-6 flex items-center justify-end gap-3">
                  <button onClick={reset} className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-slate-900">
                    Cancelar
                  </button>
                  <button
                    onClick={handleApplyImport}
                    disabled={importing}
                    className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {importing ? 'Importando…' : 'Aplicar import'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FileTable({ title, icon: Icon, items }: { title: string; icon: React.ElementType; items: PreviewItem[] }) {
  if (items.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-400">
        <Icon className="w-5 h-5 inline-block mr-2 opacity-50" /> Sem {title.toLowerCase()}
      </div>
    );
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</span>
        <span className="text-xs text-slate-400 ml-auto">{items.length}</span>
      </div>
      <ul className="max-h-72 overflow-y-auto divide-y divide-slate-200">
        {items.map((item) => (
          <li key={item.name} className="px-4 py-2 text-xs flex items-center gap-2">
            <StatusBadge item={item} />
            <span className="font-mono text-slate-700 truncate flex-1" title={item.name}>{item.name}</span>
            <span className="text-slate-400 shrink-0 text-[10px]">{fmtBytes(item.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ item }: { item: PreviewItem }) {
  if (item.status === 'created') return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-100 text-green-800 shrink-0">novo</span>;
  if (item.status === 'overwritten') return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">sobrescrito</span>;
  if (item.status === 'skipped') return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">pulado</span>;
  if (item.status === 'error') return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-800 shrink-0" title={item.error}>erro</span>;
  if (item.exists) return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">existe</span>;
  return <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">novo</span>;
}
