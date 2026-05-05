/**
 * AffiliateManager.tsx — Plugin Amazon Affiliates Manager
 *
 * CRUD de produtos afiliados + configurações do plugin.
 * Salva em src/data/affiliateProducts.json e src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import {
  Save, Loader2, AlertCircle, Plus, Trash2, Edit2,
  ToggleLeft, ToggleRight, ShoppingCart, Copy, Settings, Package,
  Tag, Zap, Eye, TrendingUp, KeyRound, EyeOff,
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const PRODUCTS_PATH = 'src/data/affiliateProducts.json';
const CONFIG_PATH = 'src/data/pluginsConfig.json';

interface ExtraLink {
  label: string;
  url: string;
}

interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  amazonUrl: string;
  extraLinks: ExtraLink[];
  price: string;
  originalPrice: string;
  rating: number;
  pros: string[];
  cons: string[];
  badge: string;
  buttonText: string;
  enabled: boolean;
}

interface AffiliateConfig {
  enabled: boolean;
  amazonTag: string;
  amazonAccessKey: string;
  amazonSecretKey: string;
  defaultButtonText: string;
  buttonColor: string;
  showPrices: boolean;
  showRatings: boolean;
  showProscons: boolean;
  showBadges: boolean;
  disclaimer: string;
  showDisclaimer: boolean;
}

const defaultConfig: AffiliateConfig = {
  enabled: true,
  amazonTag: '',
  amazonAccessKey: '',
  amazonSecretKey: '',
  defaultButtonText: 'Ver na Amazon',
  buttonColor: '#FF9900',
  showPrices: true,
  showRatings: true,
  showProscons: true,
  showBadges: true,
  disclaimer: 'Este artigo contém links de afiliado. Podemos receber uma comissão por compras feitas através deles.',
  showDisclaimer: true,
};

const emptyProduct = (): Omit<Product, 'id'> => ({
  slug: '',
  title: '',
  description: '',
  image: '',
  amazonUrl: '',
  extraLinks: [],
  price: '',
  originalPrice: '',
  rating: 4.5,
  pros: [],
  cons: [],
  badge: '',
  buttonText: '',
  enabled: true,
});

const BADGE_OPTIONS = [
  '', 'Melhor Escolha', 'Mais Vendido', 'Melhor Custo-Benefício',
  'Recomendado', "Editor's Choice", 'Premium', 'Orçamento',
];

const BADGE_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  'Melhor Escolha':          { bg: 'bg-amber-100',   text: 'text-amber-800',  icon: '🏆' },
  'Mais Vendido':            { bg: 'bg-green-100',   text: 'text-green-800',  icon: '🔥' },
  'Melhor Custo-Benefício':  { bg: 'bg-blue-100',    text: 'text-blue-800',   icon: '💡' },
  'Recomendado':             { bg: 'bg-violet-100',  text: 'text-violet-800', icon: '⭐' },
  "Editor's Choice":         { bg: 'bg-rose-100',    text: 'text-rose-800',   icon: '✍️' },
  'Premium':                 { bg: 'bg-purple-100',  text: 'text-purple-800', icon: '💎' },
  'Orçamento':               { bg: 'bg-slate-100',   text: 'text-slate-700',  icon: '💰' },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <span
          key={i}
          className={
            i < full
              ? 'text-amber-400'
              : i === full && half
              ? 'text-amber-300'
              : 'text-slate-200'
          }
          style={{ fontSize: '12px' }}
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-slate-500 text-xs font-bold tabular-nums">
        {Number(rating).toFixed(1)}
      </span>
    </div>
  );
}

function LivePreview({
  form,
  prosText,
  consText,
  buttonColor,
  defaultButtonText,
}: {
  form: Omit<Product, 'id'>;
  prosText: string;
  consText: string;
  buttonColor: string;
  defaultButtonText: string;
}) {
  const pros = prosText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const cons = consText.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const btnText = form.buttonText || defaultButtonText;
  const badgeInfo = form.badge ? BADGE_STYLES[form.badge] : null;
  const hasContent = !!(form.title || form.image || form.price);

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
          <Eye className="w-6 h-6 text-amber-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Preencha os dados</p>
        <p className="text-xs text-slate-300 mt-1">A prévia do card aparece aqui</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {form.badge && badgeInfo && (
        <div className={`px-3 py-1.5 ${badgeInfo.bg} ${badgeInfo.text} font-bold uppercase tracking-wider flex items-center gap-1.5`} style={{ fontSize: '10px' }}>
          <span>{badgeInfo.icon}</span>
          {form.badge}
        </div>
      )}
      <div className="flex gap-3 p-3">
        {form.image && (
          <div className="w-16 h-16 shrink-0 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden">
            <img
              src={form.image}
              alt=""
              className="w-full h-full object-contain"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 leading-tight mb-1 line-clamp-2" style={{ fontSize: '12px' }}>
            {form.title || <span className="text-slate-300 font-normal">Título do produto...</span>}
          </p>
          {form.rating > 0 && <StarRating rating={form.rating} />}
          {form.price && (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="font-bold text-amber-700" style={{ fontSize: '13px' }}>{form.price}</span>
              {form.originalPrice && (
                <span className="text-slate-400 line-through" style={{ fontSize: '10px' }}>{form.originalPrice}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {(pros.length > 0 || cons.length > 0) && (
        <div className="px-3 pb-2 grid grid-cols-2 gap-x-2">
          <div className="space-y-0.5">
            {pros.map((p, i) => (
              <div key={i} className="flex items-start gap-1 text-slate-600" style={{ fontSize: '11px' }}>
                <span className="text-green-500 shrink-0 mt-0.5 font-bold">✓</span>
                <span className="leading-tight">{p}</span>
              </div>
            ))}
          </div>
          <div className="space-y-0.5">
            {cons.map((c, i) => (
              <div key={i} className="flex items-start gap-1 text-slate-600" style={{ fontSize: '11px' }}>
                <span className="text-red-400 shrink-0 mt-0.5 font-bold">✗</span>
                <span className="leading-tight">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-3 pb-3">
        <div
          className="text-white font-bold text-center py-2 rounded-lg"
          style={{ background: buttonColor, fontSize: '11px' }}
        >
          {btnText} →
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
const labelClass = 'block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-0.5';

export default function AffiliateManager() {
  const [tab, setTab] = useState<'products' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsSha, setProductsSha] = useState('');
  const [configSha, setConfigSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [config, setConfig] = useState<AffiliateConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct());
  const [prosText, setProsText] = useState('');
  const [consText, setConsText] = useState('');
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [asinInput, setAsinInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const activeCount = products.filter(p => p.enabled !== false).length;

  useEffect(() => {
    Promise.all([
      githubApi('read', PRODUCTS_PATH).catch(() => null),
      githubApi('read', CONFIG_PATH).catch(() => null),
    ]).then(([prodData, cfgData]) => {
      if (prodData) {
        const arr = JSON.parse(prodData.content);
        setProducts(Array.isArray(arr) ? arr : []);
        setProductsSha(prodData.sha);
      }
      if (cfgData) {
        const cfg = JSON.parse(cfgData.content);
        setFullConfig(cfg);
        setConfigSha(cfgData.sha);
        if (cfg.affiliates) setConfig({ ...defaultConfig, ...cfg.affiliates });
      }
    }).finally(() => setLoading(false));
  }, []);

  const saveProducts = async (newList: Product[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await githubApi('write', PRODUCTS_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: productsSha || undefined,
        message: 'CMS: Update affiliate products',
      });
      setProductsSha(res.sha || productsSha);
      setProducts(newList);
      triggerToast('Produtos salvos!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!fullConfig) return;
    setSavingConfig(true);
    setError('');
    try {
      const newFullConfig = { ...fullConfig, affiliates: config };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(newFullConfig, null, 4),
        sha: configSha || undefined,
        message: 'CMS: Update affiliates config',
      });
      setConfigSha(res.sha || configSha);
      setFullConfig(newFullConfig);
      triggerToast('Configurações salvas!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const importFromAmazon = async () => {
    const asin = asinInput.trim();
    if (!asin) return;
    setImporting(true);
    try {
      const res = await fetch('/api/admin/amazon-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asin,
          accessKey: config.amazonAccessKey || undefined,
          secretKey: config.amazonSecretKey || undefined,
          partnerTag: config.amazonTag || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { triggerToast(data.error || 'Erro ao buscar produto', 'error'); return; }

      const features: string[] = data.features ?? [];
      const pros = features.slice(0, 4).join('\n');

      setForm(f => ({
        ...f,
        title: data.title || f.title,
        image: data.image || f.image,
        price: data.price || f.price,
        originalPrice: data.originalPrice || f.originalPrice,
        rating: data.rating || f.rating,
        amazonUrl: data.amazonUrl || f.amazonUrl,
        slug: f.slug || slugify(data.title),
      }));
      if (pros) setProsText(pros);
      triggerToast('Dados importados com sucesso!', 'success');
      setAsinInput('');
    } catch (e: any) {
      triggerToast(e.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(emptyProduct());
    setProsText('');
    setConsText('');
    setExtraLinks([]);
    setShowForm(true);
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug, title: p.title, description: p.description,
      image: p.image, amazonUrl: p.amazonUrl, extraLinks: p.extraLinks || [],
      price: p.price, originalPrice: p.originalPrice, rating: p.rating,
      pros: p.pros, cons: p.cons, badge: p.badge, buttonText: p.buttonText, enabled: p.enabled,
    });
    setProsText((p.pros || []).join('\n'));
    setConsText((p.cons || []).join('\n'));
    setExtraLinks(p.extraLinks || []);
    setShowForm(true);
  };

  const handleFormSave = () => {
    if (!form.title.trim()) { triggerToast('Preencha o título do produto', 'error'); return; }
    const hasMainUrl = form.amazonUrl.trim().length > 0;
    const hasExtraUrl = extraLinks.some(l => l.url.trim().length > 0);
    if (!hasMainUrl && !hasExtraUrl) {
      triggerToast('Adicione pelo menos um link (Amazon ou outra loja)', 'error');
      return;
    }

    const finalSlug = form.slug.trim() || slugify(form.title);
    const finalPros = prosText.split('\n').map(s => s.trim()).filter(Boolean);
    const finalCons = consText.split('\n').map(s => s.trim()).filter(Boolean);

    const product: Product = {
      ...form,
      slug: finalSlug,
      pros: finalPros,
      cons: finalCons,
      extraLinks: extraLinks.filter(l => l.label.trim() && l.url.trim()),
      id: editingId || `p_${Date.now()}`,
    };

    const newList = editingId
      ? products.map(p => p.id === editingId ? product : p)
      : [...products, product];

    setShowForm(false);
    setEditingId(null);
    saveProducts(newList);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este produto?')) return;
    saveProducts(products.filter(p => p.id !== id));
  };

  const handleToggle = (id: string) => {
    saveProducts(products.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const copyShortcode = (slug: string) => {
    navigator.clipboard.writeText(`[affiliate:${slug}]`);
    triggerToast('Shortcode copiado!', 'success', 100);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
      <p className="font-medium animate-pulse">Carregando produtos...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-5">

      {/* ── PLUGIN HEADER ── */}
      <div
        className="rounded-2xl overflow-hidden p-6 text-white"
        style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)',
          boxShadow: '0 8px 32px -4px rgba(245, 158, 11, 0.35)',
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h2 className="font-black text-xl tracking-tight">Afiliados</h2>
            </div>
            <p className="text-amber-100 text-sm font-medium ml-12">
              Amazon, Mercado Livre, Magalu, Shopee — produtos com prós, contras e CTA via shortcode
            </p>
          </div>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${
              config.enabled
                ? 'bg-white/15 border-white/30 text-white'
                : 'bg-black/20 border-black/20 text-white/50'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${config.enabled ? 'bg-green-300 animate-pulse' : 'bg-white/30'}`} />
            {config.enabled ? 'Plugin ativo' : 'Desativado'}
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {[
            {
              icon: <Package className="w-3.5 h-3.5 text-amber-200" />,
              value: products.length,
              label: 'Produtos',
              mono: false,
            },
            {
              icon: <Zap className="w-3.5 h-3.5 text-green-300" />,
              value: activeCount,
              label: 'Ativos',
              mono: false,
            },
            {
              icon: <Tag className="w-3.5 h-3.5 text-amber-200" />,
              value: config.amazonTag || '—',
              label: 'Associate Tag',
              mono: true,
            },
            {
              icon: (
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-white/40"
                  style={{ background: config.buttonColor }}
                />
              ),
              value: config.buttonColor,
              label: 'Cor CTA',
              mono: true,
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-white/20"
            >
              {stat.icon}
              <div>
                <div className={`font-black leading-none ${stat.mono ? 'font-mono text-sm' : 'text-lg tabular-nums'}`}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-amber-200 uppercase tracking-wide font-bold mt-0.5">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TABS + NEW BUTTON ── */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setTab('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'products' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" /> Produtos
          </button>
          <button
            onClick={() => setTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" /> Configurações
          </button>
        </div>

        {tab === 'products' && !showForm && (
          <button
            onClick={handleAdd}
            className="text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              boxShadow: '0 4px 12px -2px rgba(245, 158, 11, 0.4)',
            }}
          >
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <>
          {/* Form with live preview */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              {/* Form header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-amber-50/40 rounded-t-2xl">
                <div>
                  <h3 className="font-bold text-slate-800">
                    {editingId ? '✏️ Editar Produto' : '✨ Novo Produto'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Preencha os dados — a prévia ao vivo atualiza instantaneamente →
                  </p>
                </div>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>

              {/* 2-column layout: form | live preview */}
              <div className="grid lg:grid-cols-[1fr_300px] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

                {/* Left — form fields */}
                <div className="p-6 space-y-4">

                  {/* Amazon import */}
                  <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={asinInput}
                        onChange={e => setAsinInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && importFromAmazon()}
                        className="w-full bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
                        placeholder="ASIN (ex: B09XS7JWHH)"
                      />
                    </div>
                    <button
                      onClick={importFromAmazon}
                      disabled={importing || !asinInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
                    >
                      {importing
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</>
                        : <><ShoppingCart className="w-3.5 h-3.5" /> Importar da Amazon</>
                      }
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Título *</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={e => {
                          const title = e.target.value;
                          setForm(f => ({ ...f, title, slug: f.slug || slugify(title) }));
                        }}
                        className={inputClass}
                        placeholder="Sony WH-1000XM5"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Slug (auto)</label>
                      <input
                        type="text"
                        value={form.slug}
                        onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                        className={`${inputClass} font-mono`}
                        placeholder="sony-wh-1000xm5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Descrição curta</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      className={inputClass}
                      placeholder="Fone com cancelamento de ruído líder de mercado."
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div>
                      <label className={labelClass}>URL da Imagem</label>
                      <input
                        type="url"
                        value={form.image}
                        onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                        className={inputClass}
                        placeholder="https://m.media-amazon.com/images/..."
                      />
                    </div>
                    {form.image && (
                      <img
                        src={form.image}
                        alt="preview"
                        className="w-14 h-14 object-contain rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
                        onError={e => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                      />
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      URL principal <span className="text-slate-400 font-normal normal-case tracking-normal">— Amazon ou outra loja (opcional se houver lojas adicionais abaixo)</span>
                    </label>
                    <input
                      type="url"
                      value={form.amazonUrl}
                      onChange={e => setForm(f => ({ ...f, amazonUrl: e.target.value }))}
                      className={`${inputClass} font-mono text-xs`}
                      placeholder="https://www.amazon.com.br/dp/... ou https://www.mercadolivre.com.br/..."
                    />
                  </div>

                  {/* Extra links */}
                  <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className={`${labelClass} mb-0`}>Links adicionais</label>
                      <button
                        type="button"
                        onClick={() => setExtraLinks(l => [...l, { label: '', url: '' }])}
                        className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Adicionar loja
                      </button>
                    </div>
                    {extraLinks.length === 0 ? (
                      <p className="text-xs text-slate-400">Mercado Livre, Magalu, Shopee...</p>
                    ) : (
                      <div className="space-y-3">
                        {extraLinks.map((link, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <label className="text-xs font-bold text-slate-500 flex-1">Loja {i + 1}</label>
                              <button
                                type="button"
                                onClick={() => setExtraLinks(ls => ls.filter((_, j) => j !== i))}
                                className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={link.label}
                                onChange={e => setExtraLinks(ls => ls.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                                className={inputClass}
                                placeholder="Nome da loja (ex: Mercado Livre)"
                              />
                              <input
                                type="url"
                                value={link.url}
                                onChange={e => setExtraLinks(ls => ls.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                                className={`${inputClass} font-mono text-xs`}
                                placeholder="https://link-do-produto..."
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className={labelClass}>Preço</label>
                        <input
                          type="text"
                          value={form.price}
                          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                          className={inputClass}
                          placeholder="R$ 1.899"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Preço Original</label>
                        <input
                          type="text"
                          value={form.originalPrice}
                          onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                          className={inputClass}
                          placeholder="R$ 2.299"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Rating (1–5)</label>
                        <input
                          type="number"
                          min={1}
                          max={5}
                          step={0.5}
                          value={form.rating}
                          onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Prós (1 por linha)</label>
                        <textarea
                          value={prosText}
                          onChange={e => setProsText(e.target.value)}
                          rows={4}
                          className={inputClass}
                          placeholder={"Cancelamento excepcional\nBateria 30h\nConforto premium"}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Contras (1 por linha)</label>
                        <textarea
                          value={consText}
                          onChange={e => setConsText(e.target.value)}
                          rows={4}
                          className={inputClass}
                          placeholder={"Preço alto\nSem case rígido\nNão dobrável"}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Badge</label>
                        <select
                          value={form.badge}
                          onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                          className={inputClass}
                        >
                          {BADGE_OPTIONS.map(b => (
                            <option key={b} value={b}>{b || '— Sem badge —'}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Texto do Botão</label>
                        <input
                          type="text"
                          value={form.buttonText}
                          onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                          className={inputClass}
                          placeholder={config.defaultButtonText}
                        />
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors w-fit">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    />
                    <span className="text-sm font-medium text-slate-700">Produto ativo (visível nos posts)</span>
                  </label>

                  <div className="flex gap-3 pt-2 border-t border-slate-100">
                    <button
                      onClick={handleFormSave}
                      disabled={saving}
                      className="disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Criar produto'}
                    </button>
                    <button
                      onClick={() => { setShowForm(false); setEditingId(null); }}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>

                {/* Right — live preview panel */}
                <div className="p-5 bg-gradient-to-b from-slate-50/80 to-slate-100/40 rounded-br-2xl">
                  <div className="sticky top-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prévia ao vivo</p>
                    </div>

                    <LivePreview
                      form={form}
                      prosText={prosText}
                      consText={consText}
                      buttonColor={config.buttonColor}
                      defaultButtonText={config.defaultButtonText}
                    />

                    {(form.slug || form.title) && (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2">
                          Shortcode para usar no post
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-white border border-amber-200 rounded-lg px-2 py-1.5 font-mono text-amber-800 flex-1 truncate">
                            [affiliate:{form.slug || slugify(form.title) || 'seu-produto'}]
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`[affiliate:${form.slug || slugify(form.title)}]`);
                              triggerToast('Shortcode copiado!', 'success', 100);
                            }}
                            className="p-1.5 text-amber-500 hover:text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Products list */}
          {!showForm && products.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="font-bold text-slate-700 mb-2 text-lg">Nenhum produto ainda</h3>
              <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                Cadastre produtos da Amazon e insira-os nos seus posts com um shortcode simples
              </p>
              <button
                onClick={handleAdd}
                className="text-white px-6 py-3 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                  boxShadow: '0 4px 16px -2px rgba(245, 158, 11, 0.45)',
                }}
              >
                <Plus className="w-4 h-4" /> Cadastrar primeiro produto
              </button>
            </div>
          )}

          {!showForm && products.length > 0 && (
            <div className="space-y-2.5">
              {products.map(p => {
                const badgeInfo = p.badge ? BADGE_STYLES[p.badge] : null;
                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-2xl border transition-all group ${
                      !p.enabled
                        ? 'border-slate-100 opacity-60'
                        : 'border-slate-200 hover:border-amber-200 hover:shadow-sm hover:shadow-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {p.image ? (
                          <img src={p.image} alt={p.title} className="w-full h-full object-contain" />
                        ) : (
                          <ShoppingCart className="w-6 h-6 text-slate-200" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-bold text-slate-800 leading-tight">{p.title}</p>
                          {p.badge && badgeInfo && (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeInfo.bg} ${badgeInfo.text}`}>
                              {badgeInfo.icon} {p.badge}
                            </span>
                          )}
                          {!p.enabled && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                              Inativo
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-wrap mt-1">
                          {p.rating > 0 && <StarRating rating={p.rating} />}
                          {p.price && (
                            <span className="text-sm font-bold text-amber-700">{p.price}</span>
                          )}
                          {p.originalPrice && (
                            <span className="text-xs text-slate-400 line-through">{p.originalPrice}</span>
                          )}
                          {p.extraLinks && p.extraLinks.length > 0 && (
                            <span className="text-xs text-slate-400 font-medium">
                              +{p.extraLinks.length} loja{p.extraLinks.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1.5">
                          <code className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-mono">
                            [affiliate:{p.slug}]
                          </code>
                          <button
                            onClick={() => copyShortcode(p.slug)}
                            title="Copiar shortcode"
                            className="p-1 text-amber-400 hover:text-amber-600 transition-colors rounded"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleEdit(p)}
                          title="Editar"
                          className="p-2 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-xl transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(p.id)}
                          title={p.enabled ? 'Desativar' : 'Ativar'}
                          className="p-2 transition-colors"
                        >
                          {p.enabled
                            ? <ToggleRight className="w-5 h-5 text-amber-500" />
                            : <ToggleLeft className="w-5 h-5 text-slate-300" />
                          }
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          title="Remover"
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Shortcode help */}
          {!showForm && (
            <div className="rounded-2xl border border-amber-100 p-5 bg-gradient-to-br from-amber-50 to-orange-50/60">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Como usar nos artigos
              </p>
              <div className="space-y-2">
                {[
                  { code: '[affiliate:slug]', desc: 'Card completo com imagem, prós/contras e botão CTA' },
                  { code: '[affiliate-compare:slug1,slug2]', desc: 'Comparativo lado a lado entre dois ou mais produtos' },
                ].map(item => (
                  <div
                    key={item.code}
                    className="flex items-start gap-3 bg-white/70 rounded-xl p-3 border border-amber-100"
                  >
                    <code className="text-xs bg-white border border-amber-200 rounded-lg px-2 py-1 font-mono text-amber-800 shrink-0 shadow-sm whitespace-nowrap">
                      {item.code}
                    </code>
                    <span className="text-xs text-amber-800 font-medium pt-1">{item.desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-600/70 mt-3 ml-0.5">
                O shortcode deve estar em uma linha isolada no markdown do post.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amazon Associate Tag ID</label>
              <input
                type="text"
                value={config.amazonTag}
                onChange={e => setConfig(c => ({ ...c, amazonTag: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="meublog-20"
              />
              <p className="text-xs text-slate-400 mt-1.5 ml-1">
                Adicionado automaticamente em todos os links (<code className="font-mono">?tag=...</code>)
              </p>
            </div>
            <div>
              <label className={labelClass}>Texto padrão do botão</label>
              <input
                type="text"
                value={config.defaultButtonText}
                onChange={e => setConfig(c => ({ ...c, defaultButtonText: e.target.value }))}
                className={inputClass}
                placeholder="Ver na Amazon"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Cor do botão CTA</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.buttonColor}
                onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1 shadow-sm"
              />
              <input
                type="text"
                value={config.buttonColor}
                onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                className={`${inputClass} font-mono flex-1`}
                placeholder="#FF9900"
              />
              {/* Live button preview */}
              <div
                className="shrink-0 px-4 py-2.5 rounded-xl text-white text-sm font-bold whitespace-nowrap shadow-sm"
                style={{ background: config.buttonColor }}
              >
                {config.defaultButtonText} →
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Texto do Disclaimer</label>
            <textarea
              value={config.disclaimer}
              onChange={e => setConfig(c => ({ ...c, disclaimer: e.target.value }))}
              rows={2}
              className={inputClass}
              placeholder="Este artigo contém links de afiliado..."
            />
          </div>

          {/* PA-API credentials */}
          <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-bold text-slate-700">Credenciais PA-API 5.0</p>
              <span className="ml-auto text-xs text-slate-400">Necessário para "Importar da Amazon"</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Access Key</label>
                <input
                  type="text"
                  value={config.amazonAccessKey}
                  onChange={e => setConfig(c => ({ ...c, amazonAccessKey: e.target.value }))}
                  className={`${inputClass} font-mono`}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className={labelClass}>Secret Key</label>
                <div className="relative">
                  <input
                    type={showSecretKey ? 'text' : 'password'}
                    value={config.amazonSecretKey}
                    onChange={e => setConfig(c => ({ ...c, amazonSecretKey: e.target.value }))}
                    className={`${inputClass} font-mono pr-10`}
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCY"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-0.5">
              As chaves são salvas no <code className="font-mono">pluginsConfig.json</code> do seu repositório. Mantenha-o privado.
            </p>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <p className={labelClass}>Visibilidade dos elementos</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['showPrices', 'Mostrar preços'],
                ['showRatings', 'Mostrar avaliações (★)'],
                ['showProscons', 'Mostrar prós e contras'],
                ['showBadges', 'Mostrar badges'],
                ['showDisclaimer', 'Disclaimer no topo do post'],
                ['enabled', 'Plugin ativo'],
              ] as [keyof AffiliateConfig, string][]).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!!config[key]}
                    onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}
    </div>
  );
}
