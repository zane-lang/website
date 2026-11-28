// A Sätteri HTML-tree plugin for pages downloaded from the Zane repositories.
// The plugin rewrites the pages' links to site routes (src/lib/links.mjs) and
// renders GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`
// and `[!CAUTION]`) as callouts.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHref } from '../lib/links.mjs';
import { locateFile, siteMap } from '../lib/site-map.mjs';
import { reposDir, sources } from '../lib/sources.mjs';

/** Whether a path lies inside a folder that the site downloaded but does not exist there, which makes a link to it broken. */
export function isMissing(repo, repoPath, dir = reposDir) {
	const fetched = sources.some((s) => s.repo === repo && (repoPath === s.folder || repoPath.startsWith(`${s.folder}/`)));
	return fetched && !existsSync(join(dir, repo, repoPath));
}

/**
 * Whether a path is a file or a folder in the downloaded copy of a repository,
 * or undefined when the copy does not hold the path. A sparse clone also holds
 * the repository's top-level files, so the function reports a link to the repository's LICENSE as a file.
 */
export function kindOf(repo, repoPath, dir = reposDir) {
	const stat = statSync(join(dir, repo, repoPath), { throwIfNoEntry: false });
	return stat ? (stat.isDirectory() ? 'dir' : 'file') : undefined;
}

const alertKinds = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

/** Turns a blockquote that starts with [!KIND] into a callout; returns undefined for a plain quote. */
export function alertFrom(node) {
	const paragraph = node.children.find((c) => c.type === 'element');
	if (paragraph?.tagName !== 'p') return undefined;
	const first = paragraph.children[0];
	const m = first?.type === 'text' && first.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n)?/);
	if (!m) return undefined;
	const rest = first.value.slice(m[0].length);
	const body = { ...paragraph, children: [...(rest ? [{ type: 'text', value: rest }] : []), ...paragraph.children.slice(1)] };
	const children = node.children.map((c) => (c === paragraph ? body : c));
	// When the marker is alone on the paragraph's first line, removing it leaves
	// an empty paragraph, which is dropped.
	const kept = children.filter((c) => !(c === body && body.children.length === 0));
	return {
		type: 'element',
		tagName: 'aside',
		properties: { className: ['alert', `alert--${m[1].toLowerCase()}`] },
		children: [
			{ type: 'element', tagName: 'p', properties: { className: ['alert__title'] }, children: [{ type: 'text', value: alertKinds[m[1]] }] },
			...kept,
		],
	};
}

export function zaneDocs(ctx) {
	const from = ctx.fileURL ? locateFile(fileURLToPath(ctx.fileURL)) : undefined;
	const { byFile } = siteMap();
	return {
		name: 'zane-docs',
		element: [
			{
				filter: ['a'],
				visit(node, visitCtx) {
					const href = node.properties?.href;
					if (!from || typeof href !== 'string') return;
					const resolved = resolveHref(from, href, byFile, isMissing, kindOf);
					if (resolved !== href) visitCtx.setProperty(node, 'href', resolved);
				},
			},
			{
				filter: ['blockquote'],
				visit(node) {
					return alertFrom(node);
				},
			},
		],
	};
}
