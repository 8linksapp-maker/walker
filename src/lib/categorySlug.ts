/**
 * Helper de categoria — abstrai os 2 schemas suportados em categories.json:
 *   1) array de strings:        ["Tecnologia", "Saúde"]
 *   2) array de objetos:        [{name, slug, description}, ...]
 *
 * Schema (2) permite o aluno escolher slug manual (ex: name="Segurança Digital",
 * slug="ciber"). Schema (1) deriva slug do name automaticamente.
 *
 * Posts no frontmatter podem referenciar `category:` pelo NOME ou pelo SLUG —
 * a função de match em [categoria].astro aceita ambos pra backward compat.
 */

export function slugifyCategory(s: string): string {
    return String(s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export interface CategoryEntry {
    name: string;
    slug: string;
    description?: string;
}

/** Normaliza array misto (strings OU objetos) em array de CategoryEntry */
export function normalizeCategories(raw: any): CategoryEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((c: any) => {
        if (c && typeof c === 'object' && c.name) {
            return {
                name: String(c.name),
                slug: String(c.slug || slugifyCategory(c.name)),
                description: c.description ? String(c.description) : undefined,
            };
        }
        if (typeof c === 'string' && c.trim()) {
            return { name: c.trim(), slug: slugifyCategory(c) };
        }
        return null;
    }).filter(Boolean) as CategoryEntry[];
}

/** Retorna o slug de uma categoria (string ou objeto). Consulta categories.json se necessário. */
export function getCategorySlug(cat: any, allCategories?: CategoryEntry[]): string {
    if (!cat) return '';
    if (typeof cat === 'object' && cat.name) {
        return cat.slug || slugifyCategory(cat.name);
    }
    const name = String(cat);
    if (allCategories) {
        const found = allCategories.find(c => c.name === name || c.slug === name);
        if (found) return found.slug;
    }
    return slugifyCategory(name);
}

/** Retorna o nome de exibição de uma categoria (string ou objeto). */
export function getCategoryName(cat: any, allCategories?: CategoryEntry[]): string {
    if (!cat) return '';
    if (typeof cat === 'object' && cat.name) return cat.name;
    const v = String(cat);
    if (allCategories) {
        const found = allCategories.find(c => c.name === v || c.slug === v);
        if (found) return found.name;
    }
    return v;
}

/** True se o `postCategory` (string que pode ser nome ou slug) bate com a category entry */
export function categoryMatches(postCategory: any, entry: CategoryEntry): boolean {
    const v = typeof postCategory === 'object' && postCategory?.name ? postCategory.name : String(postCategory || '');
    return v === entry.name || v === entry.slug || slugifyCategory(v) === entry.slug;
}
