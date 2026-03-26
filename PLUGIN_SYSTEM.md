# Sistema de Atualização Individual de Plugins — Walker

**Data:** 2026-03-25
**Projeto:** `sites-prontos/walker`
**Status:** Implementação pendente

---

## Contexto

O Walker é um template de blog Astro SSG com 13 plugins. Os plugins vivem em `src/plugins/` e são importados diretamente nos layouts (`BaseLayout.astro`, `[slug].astro`). O problema atual:

- Para adicionar/atualizar um plugin, é preciso editar código manualmente
- Não há versão rastreada por plugin (só versão do template inteiro)
- Não há forma visual de instalar um plugin novo sem tocar em código
- O `PluginsHub.tsx` tem a lista de plugins hardcoded no TSX

A solução cria um **sistema de atualização individual** onde o admin (aluno leigo) pode atualizar ou instalar qualquer plugin com 1 clique, sem editar código.

---

## Repositório Central de Plugins

Um repo separado (`8linksapp-maker/cms-plugins`) centraliza todos os plugins e serve como fonte da verdade para versões e arquivos:

```
cms-plugins/
├── registry.json                  # índice: todos os plugins + versões atuais
├── plugins/
│   ├── google-analytics/
│   │   ├── plugin.json            # metadados, files, slots, configDefaults, hub card
│   │   ├── GoogleAnalytics.astro
│   │   └── SettingsGA.tsx
│   ├── seo/
│   │   ├── plugin.json
│   │   ├── SchemaMarkup.astro
│   │   ├── SEOScoreWidget.tsx
│   │   └── SettingsSEO.tsx
│   └── ... (13 plugins)
└── templates/
    └── walker/
        └── social-share/SocialShare.astro   # override visual por template
```

### `plugin.json` — o coração do auto-registro

Cada plugin declara tudo que precisa para se integrar automaticamente:

```json
{
  "name": "google-analytics",
  "version": "1.0.0",
  "description": "Google Analytics GA4",
  "files": [
    { "src": "GoogleAnalytics.astro", "dest": "src/plugins/google-analytics/GoogleAnalytics.astro" },
    { "src": "SettingsGA.tsx",        "dest": "src/plugins/google-analytics/SettingsGA.tsx" }
  ],
  "adminPages": [
    { "src": "analytics.astro", "dest": "src/pages/admin/analytics.astro" }
  ],
  "configDefaults": {
    "googleAnalytics": { "measurementId": "" }
  },
  "hub": {
    "label": "Google Analytics",
    "description": "Rastreie visitas e comportamento dos leitores com GA4.",
    "icon": "BarChart3",
    "color": "text-orange-600",
    "bg": "bg-orange-50"
  },
  "slots": [
    {
      "slot": "head",
      "import": "import GoogleAnalytics from '../google-analytics/GoogleAnalytics.astro';",
      "component": "<GoogleAnalytics />"
    }
  ],
  "changelog": "Versão inicial"
}
```

---

## Sistema de Slots (arquivos agregadores)

Em vez de cada plugin editar `BaseLayout.astro` ou `[slug].astro` diretamente, usamos **arquivos agregadores por slot**. Os layouts importam os agregadores **uma vez** e nunca mais precisam ser editados.

### Slots disponíveis

| Slot | Arquivo agregador | Importado em | Props | Plugins atuais |
|------|-------------------|--------------|-------|----------------|
| `head` | `_slots/HeadPlugins.astro` | `BaseLayout.astro` `<head>` | nenhum | GoogleAnalytics, MetaPixel, AdSenseHead |
| `body-end` | `_slots/BodyEndPlugins.astro` | `BaseLayout.astro` antes `</body>` | nenhum | EmailPopup, CookieConsent |
| `post-bottom` | `_slots/PostBottomPlugins.astro` | `[slug].astro` seção post-bottom | `title` | SocialShare (context=post-bottom) |
| `post-after` | `_slots/PostAfterPlugins.astro` | `[slug].astro` após author box | `currentSlug`, `category` | RelatedPosts |
| `post-schema` | `_slots/PostSchemaPlugins.astro` | `[slug].astro` topo | todos os dados do post | SchemaMarkup |

### Exemplo: HeadPlugins.astro

```astro
---
import GoogleAnalytics from '../google-analytics/GoogleAnalytics.astro';
import MetaPixel from '../meta-pixel/MetaPixel.astro';
import AdSenseHead from '../adsense/AdSenseHead.astro';
---
<GoogleAnalytics />
<MetaPixel />
<AdSenseHead />
```

Quando instala novo plugin com `slot: "head"`, a API appenda o import e o component neste arquivo automaticamente.

---

## Arquivos a Criar/Editar no Walker

### NOVOS (10 arquivos)

| # | Arquivo | Propósito |
|---|---------|-----------|
| 1 | `src/data/pluginVersions.json` | Versão instalada de cada plugin (rastreamento local) |
| 2 | `src/data/pluginRegistry.json` | Catálogo dos plugins instalados (dados para PluginsHub) |
| 3 | `src/plugins/_slots/HeadPlugins.astro` | Agregador: head (GA, Pixel, AdSense) |
| 4 | `src/plugins/_slots/BodyEndPlugins.astro` | Agregador: body-end (EmailPopup, CookieConsent) |
| 5 | `src/plugins/_slots/PostBottomPlugins.astro` | Agregador: post-bottom (SocialShare) |
| 6 | `src/plugins/_slots/PostAfterPlugins.astro` | Agregador: post-after (RelatedPosts) |
| 7 | `src/plugins/_slots/PostSchemaPlugins.astro` | Agregador: post-schema (SchemaMarkup) |
| 8 | `src/pages/api/admin/plugin-updates.ts` | API GET (check updates) + POST (install/update) |
| 9 | `src/plugins/updater/PluginUpdatesPanel.tsx` | UI: cards por plugin, botão atualizar/instalar |
| 10 | `src/pages/admin/plugin-updates.astro` | Página admin para atualizações de plugins |

### EDITAR (4 arquivos)

| # | Arquivo | Mudança |
|---|---------|---------|
| 1 | `src/lib/templateConfig.ts` | Adicionar `PLUGINS_REPO = '8linksapp-maker/cms-plugins'` |
| 2 | `src/layouts/BaseLayout.astro` | Trocar imports diretos (GA, Pixel, AdSense, EmailPopup, CookieConsent) por `HeadPlugins` + `BodyEndPlugins` |
| 3 | `src/pages/blog/[slug].astro` | Trocar imports diretos (SocialShare, SchemaMarkup, RelatedPosts) por slot aggregators |
| 4 | `src/components/admin/PluginsHub.tsx` | Ler de `pluginRegistry.json` em vez de array hardcoded + link para `/admin/plugin-updates` |

---

## Estrutura dos Arquivos de Dados

### `src/data/pluginVersions.json`
Versão local instalada de cada plugin:
```json
{
  "google-analytics": "1.0.0",
  "meta-pixel": "1.0.0",
  "adsense": "1.0.0",
  "social-share": "1.0.0",
  "seo": "1.0.0",
  "related-posts": "1.0.0",
  "email-list": "1.0.0",
  "cookie-consent": "1.0.0",
  "redirects": "1.0.0",
  "ai-generator": "1.0.0",
  "search-console": "1.0.0",
  "wp-importer": "1.0.0",
  "updater": "1.0.0"
}
```

### `src/data/pluginRegistry.json`
Catálogo dos plugins instalados (alimenta o PluginsHub):
```json
[
  {
    "name": "google-analytics",
    "label": "Google Analytics",
    "description": "Rastreie visitas e comportamento dos leitores com GA4.",
    "icon": "BarChart3",
    "color": "text-orange-600",
    "bg": "bg-orange-50",
    "href": "/admin/analytics"
  },
  ...
]
```

### `registry.json` (repo central cms-plugins)
Versões mais recentes disponíveis:
```json
{
  "google-analytics": { "version": "1.0.0", "description": "Google Analytics GA4" },
  "seo": { "version": "1.2.0", "description": "SEO Schema + Score Widget" },
  ...
}
```

---

## API `plugin-updates.ts`

### GET `/api/admin/plugin-updates`
Compara versões locais com o registry remoto:
```json
{
  "plugins": [
    {
      "name": "google-analytics",
      "label": "Google Analytics",
      "installedVersion": "1.0.0",
      "latestVersion": "1.0.0",
      "hasUpdate": false,
      "isInstalled": true
    },
    {
      "name": "seo",
      "label": "SEO Toolkit",
      "installedVersion": "1.0.0",
      "latestVersion": "1.2.0",
      "hasUpdate": true,
      "changelog": "Melhorias no score widget",
      "isInstalled": true
    },
    {
      "name": "novo-plugin",
      "label": "Novo Plugin",
      "installedVersion": null,
      "latestVersion": "1.0.0",
      "hasUpdate": false,
      "isInstalled": false
    }
  ]
}
```

### POST `/api/admin/plugin-updates`
Body: `{ plugin: "seo", action: "update" | "install" }`

**Lógica de update:**
1. Fetch `plugin.json` do repo central
2. Para cada file em `plugin.json.files`:
   - Checa override: `templates/walker/{plugin}/{file.src}`
   - Se existe → usa override; senão → usa `plugins/{plugin}/{file.src}`
   - `writeFileToRepo(file.dest, content)`
3. Atualiza `pluginVersions.json`

**Lógica de install (além do update):**
4. Merge `configDefaults` em `pluginsConfig.json`
5. Adiciona entry em `pluginRegistry.json`
6. Para cada slot: appenda import + component no arquivo agregador correspondente

---

## Fluxos de Uso

### Atualizar plugin existente (admin)
1. Admin abre `/admin/plugin-updates`
2. UI faz GET → compara versões locais com registry remoto
3. Cards mostram "Atualização disponível" + changelog
4. Admin clica "Atualizar"
5. API POST → baixa arquivos + atualiza `pluginVersions.json`
6. Vercel rebuild automático → plugin atualizado em ~2min

### Instalar plugin novo (admin)
1. Novo plugin aparece no registry remoto mas não em `pluginVersions.json`
2. UI mostra card "Não instalado" com botão "Instalar"
3. Admin clica "Instalar"
4. API POST:
   - Copia todos os files + adminPages
   - Merge configDefaults em `pluginsConfig.json`
   - Adiciona entry em `pluginRegistry.json`
   - Appenda import + component nos slot aggregators correspondentes
   - Adiciona em `pluginVersions.json`
5. Vercel rebuild → plugin funcional

### Criar plugin novo (desenvolvedor)
1. Desenvolve no Walker local normalmente
2. Copia arquivos para `cms-plugins/plugins/{nome}/`
3. Cria `plugin.json` com metadados, files, slots, configDefaults
4. Atualiza `registry.json`
5. Push no repo cms-plugins
6. Todos os templates Walker veem "Novo plugin disponível"

---

## Estado Atual dos Plugins no Walker

### Plugins existentes em `src/plugins/`
| Plugin | Pasta | Arquivos |
|--------|-------|---------|
| Google Analytics | `google-analytics/` | GoogleAnalytics.astro, SettingsGA.tsx |
| Meta Pixel | `meta-pixel/` | MetaPixel.astro, SettingsMetaPixel.tsx |
| AdSense | `adsense/` | AdSenseHead.astro, SettingsAdSense.tsx |
| Social Share | `social-share/` | SocialShare.astro, SettingsSocialShare.tsx |
| SEO | `seo/` | SchemaMarkup.astro, SEOScoreWidget.tsx, SettingsSEO.tsx |
| Related Posts | `related-posts/` | RelatedPosts.astro |
| Email List | `email-list/` | EmailPopup.astro, EmailInlineBanner.astro, SettingsEmailList.tsx, ... |
| Cookie Consent | `cookie-consent/` | SettingsCookieConsent.tsx |
| Redirects | `redirects/` | RedirectsManager.tsx |
| AI Generator | `ai-generator/` | AIPostGenerator.tsx, SettingsAI.tsx, ... |
| Search Console | `search-console/` | SearchConsolePanel.tsx, SettingsGSC.tsx, gsc-api.ts |
| WP Importer | `wp-importer/` | ImportPage.tsx, wordpress-importer.ts |
| Updater | `updater/` | UpdatesPanel.tsx |

### Como os plugins são injetados hoje (antes da refatoração)
**BaseLayout.astro** (imports diretos no `<head>` e antes do `</body>`):
```astro
import GoogleAnalytics from '../plugins/google-analytics/GoogleAnalytics.astro';
import MetaPixel from '../plugins/meta-pixel/MetaPixel.astro';
import AdSenseHead from '../plugins/adsense/AdSenseHead.astro';
import EmailPopup from '../plugins/email-list/EmailPopup.astro';
import CookieConsent from '../components/layout/CookieConsent.astro';
```

**[slug].astro** (imports diretos):
```astro
import SocialShare from '../../plugins/social-share/SocialShare.astro';
import SchemaMarkup from '../../plugins/seo/SchemaMarkup.astro';
import RelatedPosts from '../../plugins/related-posts/RelatedPosts.astro';
import EmailInlineBanner from '../../plugins/email-list/EmailInlineBanner.astro';
```

### Como ficará após a refatoração
**BaseLayout.astro:**
```astro
import HeadPlugins from '../plugins/_slots/HeadPlugins.astro';
import BodyEndPlugins from '../plugins/_slots/BodyEndPlugins.astro';
// ...
<HeadPlugins />     <!-- no <head> -->
<BodyEndPlugins />  <!-- antes do </body> -->
```

**[slug].astro:**
```astro
import PostSchemaPlugins from '../../plugins/_slots/PostSchemaPlugins.astro';
import PostBottomPlugins from '../../plugins/_slots/PostBottomPlugins.astro';
import PostAfterPlugins from '../../plugins/_slots/PostAfterPlugins.astro';
```

**EmailInlineBanner** permanece com import direto em `[slug].astro` pois usa lógica especial de injeção via JS.

---

## Checklist de Verificação

- [ ] `pluginVersions.json` e `pluginRegistry.json` existem com 13 plugins
- [ ] Slot aggregators renderizam corretamente (`bun run build` passa)
- [ ] `BaseLayout.astro` usa `HeadPlugins` + `BodyEndPlugins`
- [ ] `[slug].astro` usa os 3 slot aggregators de post
- [ ] `PluginsHub.tsx` lê de `pluginRegistry.json` dinamicamente
- [ ] GET `/api/admin/plugin-updates` retorna status por plugin
- [ ] POST update: arquivos substituídos + versão atualizada em `pluginVersions.json`
- [ ] POST install: config merged + registry atualizado + slot editado
- [ ] `/admin/plugin-updates` carrega a `PluginUpdatesPanel`
- [ ] `bun run build` passa sem erros

---

## Stack Técnica do Walker

- **Framework:** Astro 5.1 (SSG estático)
- **Package manager:** bun
- **Estilização:** Tailwind CSS 3 + Bootstrap 5.3 (CDN)
- **React:** @astrojs/react (componentes admin)
- **Deploy:** Vercel (SSG)
- **Dados:** JSON em `src/data/` (lidos em build time + escritos via GitHub API em prod)
- **Ícones:** lucide-react
- **Autenticação admin:** cookie de sessão + middleware

---

## Observações Importantes

1. **Dev vs Prod:** `writeFileToRepo()` usa filesystem local em dev, GitHub API em prod (Vercel). Isso significa que em dev as mudanças são imediatas, em prod geram um commit que dispara rebuild.

2. **EmailInlineBanner não é slot:** Usa injeção JS especial (insere o banner após o N-ésimo parágrafo do post). Permanece com import direto.

3. **SocialShare aparece 2x no [slug].astro:** Uma vez em `post-bottom` (dentro do artigo) e outra em `author-box`. Apenas a primeira será movida para o slot aggregator. A segunda permanece inline.

4. **PluginsHub vs plugin-updates:** São páginas distintas. PluginsHub (`/admin/plugins`) é o hub de configuração de cada plugin. Plugin Updates (`/admin/plugin-updates`) é exclusiva para instalar/atualizar versões.

5. **registry.json remoto:** Enquanto o repo `cms-plugins` não existir, a API retorna os plugins como "up to date" sem erro (graceful fallback).
