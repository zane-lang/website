// Builds the site's page tree from the fetched sources. Each source folder's
// README.md is its index: its `##` headings become sidebar groups and its links,
// in order, the pages (a link to a subfolder's README.md nests that folder).
// A page no index links is not published. See PUBLISHING.md.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { titleOf, descriptionOf, indexOutline } from './markdown.mjs';
import { sources, reposDir as defaultReposDir, routeOf } from './sources.mjs';

/**
 * @typedef {{
 *   kind: 'page' | 'group',
 *   title: string,
 *   label?: string,
 *   description?: string,
 *   route?: string,
 *   source: string,
 *   repo: string,
 *   path?: string,
 *   children: Node[],
 * }} Node
 * @typedef {import('./sources.mjs').Source} Source
 * @typedef {{ source: Source, root: Node | undefined, pages: Node[] }} Tab
 * @typedef {{ level: 'error' | 'warning', message: string }} Problem
 * @typedef {{ tabs: Tab[], byFile: Map<string, Node>, problems: Problem[] }} SiteMap
 */

/** The route of a page, from its path inside the repository. */
export function routeForPath(source, repoPath) {
	let rel = repoPath.slice(source.folder.length + 1).replace(/\.md$/i, '');
	if (rel === 'README') rel = '';
	else if (rel.endsWith('/README')) rel = rel.slice(0, -'/README'.length);
	return routeOf(source) + (rel ? `/${rel}` : '');
}

function walkMarkdown(dir, prefix, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.')) continue;
		const path = join(dir, entry.name);
		const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
		const isDir = entry.isDirectory() || (entry.isSymbolicLink() && statSync(path).isDirectory());
		if (isDir) walkMarkdown(path, rel, out);
		else if (/\.md$/i.test(entry.name)) out.push(rel);
	}
	return out;
}

/**
 * Sidebar labels: page titles without the words every page in the tab starts
 * with ("Zane Memory Model" → "Memory Model", "Stories: Types" → "Types").
 */
export function sharedPrefix(titles) {
	if (titles.length < 2) return '';
	const words = titles.map((t) => t.split(' '));
	let n = 0;
	while (words.every((w) => w.length > n + 1 && w[n] === words[0][n])) n++;
	return n ? words[0].slice(0, n).join(' ') + ' ' : '';
}

function labelPages(root) {
	const pages = [];
	const collect = (node) => {
		node.children.forEach((child) => {
			if (child.kind === 'page') pages.push(child);
			collect(child);
		});
	};
	collect(root);
	const prefix = sharedPrefix(pages.map((p) => p.title));
	for (const page of pages) page.label = page.title.slice(prefix.length);
}

/**
 * Builds the tree of every source. Problems are reported, not thrown.
 * @returns {SiteMap}
 */
export function buildSiteMap(reposDir = defaultReposDir) {
	const tabs = [];
	/** @type {Map<string, Node>} repo:path → published page */
	const byFile = new Map();
	const problems = [];

	for (const source of sources) {
		const repoDir = join(reposDir, source.repo);
		const folderDir = join(repoDir, source.folder);
		const indexPath = `${source.folder}/README.md`;
		if (!existsSync(join(repoDir, indexPath))) {
			problems.push({
				level: 'error',
				message: `${source.repo}/${indexPath} is missing: the ${source.label} tab needs an index page (PUBLISHING.md).`,
			});
			tabs.push({ source, root: undefined, pages: [] });
			continue;
		}

		const read = (repoPath) => readFileSync(join(repoDir, repoPath), 'utf8');
		const pageNode = (repoPath) => {
			const markdown = read(repoPath);
			const node = {
				kind: 'page',
				title: titleOf(markdown) ?? posix.basename(repoPath, '.md'),
				description: descriptionOf(markdown),
				route: routeForPath(source, repoPath),
				source: source.id,
				repo: source.repo,
				path: repoPath,
				children: [],
			};
			byFile.set(`${source.repo}:${repoPath}`, node);
			return node;
		};

		const visitIndex = (repoPath) => {
			const node = pageNode(repoPath);
			let group;
			for (const item of indexOutline(read(repoPath))) {
				if (item.type === 'group') {
					group = { kind: 'group', title: item.title, source: source.id, repo: source.repo, children: [] };
					node.children.push(group);
					continue;
				}
				const target = item.href.split(/[?#]/)[0];
				if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('/')) continue;
				let resolved = posix.normalize(posix.join(posix.dirname(repoPath), decodeURIComponent(target)));
				// A link to a folder means that folder's index.
				if (!/\.md$/i.test(resolved) && existsSync(join(repoDir, resolved, 'README.md'))) resolved = posix.join(resolved, 'README.md');
				if (!resolved.startsWith(`${source.folder}/`) || !/\.md$/i.test(resolved)) continue;
				if (byFile.has(`${source.repo}:${resolved}`)) continue;
				if (!existsSync(join(repoDir, resolved))) {
					problems.push({
						level: 'error',
						message: `${source.repo}/${repoPath} links ${item.href}, which does not exist.`,
					});
					continue;
				}
				const child = /(^|\/)README\.md$/i.test(resolved) ? visitIndex(resolved) : pageNode(resolved);
				(group ?? node).children.push(child);
			}
			return node;
		};

		const root = visitIndex(indexPath);
		labelPages(root);
		const pages = [];
		const flatten = (node) => {
			if (node.kind === 'page') pages.push(node);
			node.children.forEach(flatten);
		};
		flatten(root);
		tabs.push({ source, root, pages });

		for (const rel of walkMarkdown(folderDir, '')) {
			const repoPath = `${source.folder}/${rel}`;
			if (!byFile.has(`${source.repo}:${repoPath}`)) {
				problems.push({
					level: 'warning',
					message: `${source.repo}/${repoPath} is not linked from an index, so it is not published.`,
				});
			}
		}
	}

	return { tabs, byFile, problems };
}

/** Maps an absolute file path back to { repo, path }, also through symlinks. */
export function locateFile(absPath, reposDir = defaultReposDir) {
	for (const repo of new Set(sources.map((s) => s.repo))) {
		const bases = [join(reposDir, repo)];
		try {
			bases.push(realpathSync(join(reposDir, repo)));
		} catch {}
		for (const base of bases) {
			if (absPath.startsWith(base + '/')) return { repo, path: absPath.slice(base.length + 1) };
		}
	}
	return undefined;
}

let cached;
/**
 * buildSiteMap(), reused for a moment so that rendering many pages reads the indexes once.
 * @returns {SiteMap}
 */
export function siteMap() {
	const now = Date.now();
	if (!cached || now - cached.at > 2000) cached = { at: now, map: buildSiteMap() };
	return cached.map;
}
