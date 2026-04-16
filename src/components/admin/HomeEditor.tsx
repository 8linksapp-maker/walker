import React, { useState, useEffect } from 'react';
import { Home, TrendingUp, Sparkles, Type, Save, Loader2, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type PostMeta = { slug: string; title: string; path: string };

type HomeConfig = {
    sectionTitles: {
        editorsPick: string;
        trending: string;
        inspiration: string;
        latestPosts: string;
        popularTab: string;
        recentTab: string;
    };
    editorsPick: { mainSlug: string; sideSlugs: string[] };
    trending: { slugs: string[] };
    inspiration: { slugs: string[] };
    latestPosts: { limit: number; btnText: string; btnLink: string };
};

const DEFAULT: HomeConfig = {
    sectionTitles: {
        editorsPick: 'Escolha dos Editores',
        trending: 'Em Alta',
        inspiration: 'Inspiração',
        latestPosts: 'Posts Recentes',
        popularTab: 'Popular',
        recentTab: 'Recente',
    },
    editorsPick: { mainSlug: '', sideSlugs: ['', '', '', ''] },
    trending: { slugs: ['', '', '', ''] },
    inspiration: { slugs: ['', '', '', ''] },
    latestPosts: { limit: 6, btnText: 'Ver Todos os Posts', btnLink: '/blog' },
};

function parseFrontmatterTitle(content: string): string {
    const m = content.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
    return m ? m[1].trim() : '';
}

function humanize(slug: string) {
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function mergeConfig(partial: any): HomeConfig {
    const sideSlugs = Array.isArray(partial.editorsPick?.sideSlugs)
        ? [...partial.editorsPick.sideSlugs, '', '', '', ''].slice(0, 4)
        : ['', '', '', ''];
    return {
        sectionTitles: { ...DEFAULT.sectionTitles, ...(partial.sectionTitles || {}) },
        editorsPick: { mainSlug: partial.editorsPick?.mainSlug || '', sideSlugs },
        trending: { slugs: Array.isArray(partial.trending?.slugs) ? [...partial.trending.slugs, '', '', '', ''].slice(0, 4) : ['', '', '', ''] },
        inspiration: { slugs: Array.isArray(partial.inspiration?.slugs) ? [...partial.inspiration.slugs, '', '', '', ''].slice(0, 4) : ['', '', '', ''] },
        latestPosts: {
            limit: partial.latestPosts?.limit ?? 6,
            btnText: partial.latestPosts?.btnText || 'Ver Todos os Posts',
            btnLink: partial.latestPosts?.btnLink || '/blog',
        },
    };
}

function PostPicker({ value, posts, onChange, placeholder }: {
    value: string; posts: PostMeta[]; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
        >
            <option value="">{placeholder || '— Auto (mais recente) —'}</option>
            {posts.map(p => (
                <option key={p.slug} value={p.slug}>{p.title}</option>
            ))}
        </select>
    );
}

type Tab = 'curation' | 'titles' | 'latest';

export default function HomeEditor() {
    const [config, setConfig] = useState<HomeConfig>(DEFAULT);
    const [fileSha, setFileSha] = useState('');
    const [posts, setPosts] = useState<PostMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('curation');

    useEffect(() => {
        async function load() {
            try {
                // Load home.json config
                const configData = await githubApi('read', 'src/data/home.json').catch(() => null);
                if (configData) {
                    setConfig(mergeConfig(JSON.parse(configData?.content || "{}")));
                    setFileSha(configData.sha);
                }

                // Load all blog posts and read titles in parallel
                const fileList = await githubApi('list', 'src/content/blog').catch(() => ({ data: [] }));
                const mdFiles = ((fileList.data || fileList) as any[]).filter(f => f.name.endsWith('.md'));

                const metas = await Promise.all(
                    mdFiles.map(async (f: any) => {
                        const slug = f.name.replace('.md', '');
                        try {
                            const data = await githubApi('read', f.path);
                            const title = parseFrontmatterTitle(data.content) || humanize(slug);
                            return { slug, title, path: f.path } as PostMeta;
                        } catch {
                            return { slug, title: humanize(slug), path: f.path } as PostMeta;
                        }
                    })
                );
                setPosts(metas.sort((a, b) => a.title.localeCompare(b.title)));
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function save() {
        setSaving(true);
        try {
            await githubApi('write', 'src/data/home.json', {
                content: JSON.stringify(config, null, 4),
                sha: fileSha,
            });
            const fresh = await githubApi('read', 'src/data/home.json');
            setFileSha(fresh.sha);
            triggerToast('success', 'Homepage atualizada!');
        } catch (err: any) {
            triggerToast('error', err.message);
        } finally {
            setSaving(false);
        }
    }

    const setEditorMain = (slug: string) =>
        setConfig(c => ({ ...c, editorsPick: { ...c.editorsPick, mainSlug: slug } }));

    const setEditorSide = (i: number, slug: string) =>
        setConfig(c => {
            const s = [...c.editorsPick.sideSlugs];
            s[i] = slug;
            return { ...c, editorsPick: { ...c.editorsPick, sideSlugs: s } };
        });

    const setTrending = (i: number, slug: string) =>
        setConfig(c => {
            const s = [...c.trending.slugs];
            s[i] = slug;
            return { ...c, trending: { slugs: s } };
        });

    const setInspiration = (i: number, slug: string) =>
        setConfig(c => {
            const s = [...c.inspiration.slugs];
            s[i] = slug;
            return { ...c, inspiration: { slugs: s } };
        });

    const setTitle = (key: keyof HomeConfig['sectionTitles'], value: string) =>
        setConfig(c => ({ ...c, sectionTitles: { ...c.sectionTitles, [key]: value } }));

    const setLatest = (key: keyof HomeConfig['latestPosts'], value: any) =>
        setConfig(c => ({ ...c, latestPosts: { ...c.latestPosts, [key]: value } }));

    if (loading) return (
        <div className="flex items-center justify-center h-64 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            <span className="text-sm">Carregando artigos e configuração...</span>
        </div>
    );

    if (error) return (
        <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200 max-w-lg">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-red-700 text-sm">{error}</span>
        </div>
    );

    const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
        { id: 'curation', label: 'Curadoria', icon: Home },
        { id: 'titles', label: 'Títulos', icon: Type },
        { id: 'latest', label: 'Recentes', icon: RefreshCw },
    ];

    return (
        <div className="max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <Home className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 text-lg">Homepage</h2>
                        <p className="text-sm text-slate-500">Curadoria de seções e títulos</p>
                    </div>
                </div>
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 disabled:opacity-60 transition-all shadow-sm"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {tabs.map(t => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                tab === t.id
                                    ? 'bg-white text-violet-700 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab: Curadoria */}
            {tab === 'curation' && (
                <div className="space-y-5">
                    <p className="text-sm text-slate-500">
                        Escolha quais artigos aparecem em cada seção. Deixe em branco para usar os mais recentes automaticamente.
                    </p>

                    {/* Escolha dos Editores */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Check className="w-4 h-4 text-amber-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">{config.sectionTitles.editorsPick}</h3>
                            <span className="text-xs text-slate-400 ml-auto">1 destaque + 4 laterais</span>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                    Destaque Principal (card grande)
                                </label>
                                <PostPicker value={config.editorsPick.mainSlug} posts={posts} onChange={setEditorMain} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    Lista Lateral (4 posts menores)
                                </label>
                                <div className="space-y-2">
                                    {config.editorsPick.sideSlugs.map((slug, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 w-4 shrink-0">{i + 1}</span>
                                            <PostPicker
                                                value={slug}
                                                posts={posts}
                                                onChange={v => setEditorSide(i, v)}
                                                placeholder="— Auto —"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Em Alta */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-rose-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">{config.sectionTitles.trending}</h3>
                            <span className="text-xs text-slate-400 ml-auto">4 posts em grade 2×2</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {config.trending.slugs.map((slug, i) => (
                                <div key={i}>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Post {i + 1} · {i < 2 ? 'coluna esquerda' : 'coluna direita'}
                                    </label>
                                    <PostPicker value={slug} posts={posts} onChange={v => setTrending(i, v)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Inspiração */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-violet-600" />
                            </div>
                            <h3 className="font-bold text-slate-800">{config.sectionTitles.inspiration}</h3>
                            <span className="text-xs text-slate-400 ml-auto">4 posts · carrossel</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {config.inspiration.slugs.map((slug, i) => (
                                <div key={i}>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                                        Post {i + 1}
                                    </label>
                                    <PostPicker value={slug} posts={posts} onChange={v => setInspiration(i, v)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Títulos */}
            {tab === 'titles' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <p className="text-sm text-slate-500 mb-2">Edite os títulos exibidos em cada seção da homepage.</p>
                    {([
                        { key: 'editorsPick' as const, label: 'Seção: Escolha dos Editores' },
                        { key: 'trending' as const, label: 'Seção: Em Alta' },
                        { key: 'inspiration' as const, label: 'Seção: Inspiração' },
                        { key: 'latestPosts' as const, label: 'Seção: Posts Recentes' },
                        { key: 'popularTab' as const, label: 'Aba Hero: Popular' },
                        { key: 'recentTab' as const, label: 'Aba Hero: Recente' },
                    ]).map(({ key, label }) => (
                        <div key={key}>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                {label}
                            </label>
                            <input
                                type="text"
                                value={config.sectionTitles[key]}
                                onChange={e => setTitle(key, e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Tab: Recentes */}
            {tab === 'latest' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                    <p className="text-sm text-slate-500">
                        A seção de posts recentes é sempre automática (ordenada por data). Configure aqui o número de posts exibidos e o botão "ver todos".
                    </p>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Quantidade de Posts
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={config.latestPosts.limit}
                            onChange={e => setLatest('limit', parseInt(e.target.value) || 6)}
                            className="w-24 px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Texto do Botão
                        </label>
                        <input
                            type="text"
                            value={config.latestPosts.btnText}
                            onChange={e => setLatest('btnText', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                            Link do Botão
                        </label>
                        <input
                            type="text"
                            value={config.latestPosts.btnLink}
                            onChange={e => setLatest('btnLink', e.target.value)}
                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
