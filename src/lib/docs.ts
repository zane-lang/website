import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';
import yaml from 'js-yaml';

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
	try {
		const res = await fetch(`${RAW}/${path}`);
		if (!res.ok) return null;
		return await res.text();
	} catch {
		// Network failure: treated as "not found" so callers degrade gracefully
		// rather than rejecting (e.g. one bad request in getNav's Promise.all).
		return null;
	}
}

// ── Frontmatter ────────────────────────────────────────────────────────────

/** Parse a leading YAML frontmatter block, returning its data and the body. */
function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	if (!match) return { data: {}, body: raw };
	try {
		const data = yaml.load(match[1]);
		return {
			data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
			body: raw.slice(match[0].length),
		};
	} catch {
		return { data: {}, body: raw.slice(match[0].length) };
	}
}

/** Read a frontmatter value as a string, if it is one. */
function str(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

/** Turn a filename stem into a display title, e.g. `getting-started` → `Getting Started`. */
function titleFromPath(path: string): string {
	const stem = path.replace(/\.(md|mdx)$/, '').split('/').pop() ?? path;
	return stem
		.split(/[-_]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function toEntry(path: string, title?: string): DocEntry {
	const id = path.replace(/\.(md|mdx)$/, '');
	return {
		id,
		slug: id === 'docs' ? undefined : id.replace(/^docs\//, ''),
		path,
		data: { title: title || titleFromPath(path) },
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
let inflightNav: Promise<DocEntry[]> | null = null;

/**
 * List the docs for the sidebar from the repo file names alone — a single
 * rate-limited tree-API call, no per-file content fetch. Titles are derived
 * from the file names; the real frontmatter title is used for the page being
 * viewed (see `renderDoc`). Cached for `TTL`, with concurrent cold-cache
 * requests deduped onto one in-flight fetch so a burst can't stampede the
 * rate-limited GitHub API.
 */
export async function getNav(): Promise<DocEntry[]> {
	if (navCache && Date.now() - navCache.at < TTL) return navCache.nav;
	if (inflightNav) return inflightNav;

	inflightNav = (async () => {
		// Degrade gracefully on any failure — a network error, non-OK status, or
		// invalid JSON. An empty sidebar beats a broken page, and individual docs
		// still render (they don't depend on this listing).
		try {
			const res = await fetch(TREE, { headers: ghHeaders() });
			if (!res.ok) return navCache?.nav ?? [];
			const tree = (await res.json()) as { tree?: { path: string; type: string }[] };
			if (!Array.isArray(tree.tree)) return navCache?.nav ?? [];

			const nav = tree.tree
				.filter((n) => n.type === 'blob')
				.map((n) => n.path)
				// Only the doc root and the docs/ tree are routable, so keep the
				// sidebar to those — stray root files (CONTRIBUTING.md, etc.) don't leak.
				.filter((p) => p === 'docs.md' || p === 'docs.mdx' || p.startsWith('docs/'))
				.filter((p) => /\.(md|mdx)$/.test(p))
				.filter((p) => !/(^|\/)(README|LICENSE)/i.test(p))
				.map((path) => toEntry(path))
				.sort((a, b) => a.id.localeCompare(b.id));

			navCache = { at: Date.now(), nav };
			return nav;
		} catch {
			return navCache?.nav ?? [];
		} finally {
			inflightNav = null;
		}
	})();

	return inflightNav;
}

// ── Render a doc to HTML (cached) ───────────────────────────────────────────

const docCache = new Map<string, { at: number; doc: RenderedDoc }>();

/**
 * Fetch and render the doc for a URL slug, straight from the raw CDN, and cache
 * the result (content included) for `TTL`. Returns `null` if no matching source
 * file exists. Independent of the tree API, so docs render even when the sidebar
 * listing is unavailable.
 */
export async function renderDoc(slug: string | undefined): Promise<RenderedDoc | null> {
	const key = slug ?? '';
	const cached = docCache.get(key);
	if (cached && Date.now() - cached.at < TTL) return cached.doc;

	let doc: RenderedDoc | null = null;
	for (const path of slugToCandidates(slug)) {
		const raw = await fetchRaw(path);
		if (raw === null) continue;
		const { data, body } = parseFrontmatter(raw);
		try {
			const processor = await getProcessor();
			const result = await processor.render(body);
			doc = {
				title: str(data.title) || titleFromPath(path),
				description: str(data.description),
				html: result.code,
				headings: result.metadata.headings,
			};
			break;
		} catch {
			// A malformed doc shouldn't 500 the page — skip it (router shows 404).
			continue;
		}
	}

	// Only cache successful renders — caching a `null` would turn a transient
	// fetch failure into a TTL-long 404 for a doc that actually exists.
	if (doc) docCache.set(key, { at: Date.now(), doc });
	return doc;
}
