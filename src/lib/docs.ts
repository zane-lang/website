import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';

// ── Source repo ────────────────────────────────────────────────────────────
//
// The docs are authored in a standalone repository and pulled in at request
// time rather than vendored at build time. Editing a file in that repo updates
// the live site within the CDN cache window — no rebuild of this site needed.

const REPO = 'zane-lang/docs';
const BRANCH = 'main';
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const TREE = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`;

// How long fetched listings/content are cached in a warm server instance. The
// CDN cache headers set on the page do most of the work; this just avoids
// re-fetching on every request that reaches the function.
const TTL = 5 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

/** A doc entry shaped to match what `DocsLayout` expects (`id` + `data.title`). */
export type DocEntry = {
	/** Path within the collection, sans extension, e.g. `docs` or `docs/cli`. */
	id: string;
	/** URL slug: `undefined` for the root doc, otherwise `id` without `docs/`. */
	slug: string | undefined;
	/** Repo-relative source path, e.g. `docs.md` or `docs/cli.md`. */
	path: string;
	data: { title: string; description?: string };
};

export type RenderedDoc = {
	title: string;
	description?: string;
	html: string;
	headings: MarkdownHeading[];
};

// ── GitHub fetch helpers ───────────────────────────────────────────────────

function ghHeaders(): HeadersInit {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'User-Agent': 'zane-website',
	};
	// Optional: lifts the unauthenticated 60/hr rate limit on the tree API.
	// Set GITHUB_TOKEN in the Vercel project's environment variables.
	const token = process.env.GITHUB_TOKEN;
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function fetchRaw(path: string): Promise<string | null> {
	const res = await fetch(`${RAW}/${path}`);
	if (!res.ok) return null;
	return res.text();
}

// ── Frontmatter ────────────────────────────────────────────────────────────

/** Minimal YAML frontmatter parser — the docs only use flat `key: value`. */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	if (!match) return { data: {}, body: raw };
	const data: Record<string, string> = {};
	for (const line of match[1].split(/\r?\n/)) {
		const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
		if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
	}
	return { data, body: raw.slice(match[0].length) };
}

function toEntry(path: string, title?: string, description?: string): DocEntry {
	const id = path.replace(/\.(md|mdx)$/, '');
	const filename = id.split('/').pop() ?? id;
	return {
		id,
		slug: id === 'docs' ? undefined : id.replace(/^docs\//, ''),
		path,
		data: { title: title || filename, ...(description ? { description } : {}) },
	};
}

/**
 * Candidate source paths for a URL slug, by convention. `/docs` maps to the
 * repo's `docs.md`; `/docs/cli` maps to `docs/cli.md`. Rendering a doc uses
 * these directly, so a page keeps working even if the tree API is unavailable.
 */
function slugToCandidates(slug: string | undefined): string[] {
	const base = slug ? `docs/${slug}` : 'docs';
	return [`${base}.md`, `${base}.mdx`];
}

// ── Markdown processor (Astro's own — matches build-time output) ────────────

let processorPromise: ReturnType<typeof createMarkdownProcessor> | null = null;
function getProcessor() {
	processorPromise ??= createMarkdownProcessor({});
	return processorPromise;
}

// ── Navigation listing (cached) ────────────────────────────────────────────

let navCache: { at: number; nav: DocEntry[] } | null = null;

/**
 * List every doc with its title, for the sidebar. One rate-limited tree-API
 * call plus one CDN raw fetch per file for the title; cached for `TTL`.
 */
export async function getNav(): Promise<DocEntry[]> {
	if (navCache && Date.now() - navCache.at < TTL) return navCache.nav;

	let res: Response;
	try {
		res = await fetch(TREE, { headers: ghHeaders() });
	} catch {
		return navCache?.nav ?? [];
	}
	if (!res.ok) {
		// Degrade gracefully: an empty sidebar is better than a broken page, and
		// individual docs still render (they don't depend on this listing).
		return navCache?.nav ?? [];
	}
	const tree = (await res.json()) as { tree: { path: string; type: string }[] };

	const paths = tree.tree
		.filter((n) => n.type === 'blob')
		.map((n) => n.path)
		.filter((p) => /\.(md|mdx)$/.test(p))
		.filter((p) => !/(^|\/)(README|LICENSE)/i.test(p));

	const nav = await Promise.all(
		paths.map(async (path) => {
			const raw = await fetchRaw(path);
			const { data } = raw ? parseFrontmatter(raw) : { data: {} as Record<string, string> };
			return toEntry(path, data.title, data.description);
		})
	);

	nav.sort((a, b) => a.id.localeCompare(b.id));
	navCache = { at: Date.now(), nav };
	return nav;
}

// ── Render a doc to HTML ────────────────────────────────────────────────────

/**
 * Fetch and render the doc for a URL slug, straight from the raw CDN. Returns
 * `null` if no matching source file exists. Independent of the tree API, so
 * docs render even when the sidebar listing is unavailable.
 */
export async function renderDoc(slug: string | undefined): Promise<RenderedDoc | null> {
	for (const path of slugToCandidates(slug)) {
		const raw = await fetchRaw(path);
		if (raw === null) continue;
		const { data, body } = parseFrontmatter(raw);
		const processor = await getProcessor();
		const result = await processor.render(body);
		const fallback = path.replace(/\.(md|mdx)$/, '').split('/').pop() ?? 'Docs';
		return {
			title: data.title || fallback,
			description: data.description,
			html: result.code,
			headings: result.metadata.headings,
		};
	}
	return null;
}
