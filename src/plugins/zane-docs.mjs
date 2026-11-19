// A Sätteri HTML-tree plugin for pages fetched from the Zane repositories:
// rewrites their links to site routes (src/lib/links.mjs) and renders GitHub
// alerts (`> [!NOTE]` and the other four kinds) as callouts.
import { fileURLToPath } from 'node:url';
import { resolveHref } from '../lib/links.mjs';
import { locateFile, siteMap } from '../lib/site-map.mjs';

const alertKinds = { NOTE: 'Note', TIP: 'Tip', IMPORTANT: 'Important', WARNING: 'Warning', CAUTION: 'Caution' };

/** Turns a blockquote that starts with [!KIND] into a callout; undefined if it is a plain quote. */
export function alertFrom(node) {
	const paragraph = node.children.find((c) => c.type === 'element');
	if (paragraph?.tagName !== 'p') return undefined;
	const first = paragraph.children[0];
	const m = first?.type === 'text' && first.value.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n)?/);
	if (!m) return undefined;
	const rest = first.value.slice(m[0].length);
	const body = { ...paragraph, children: [...(rest ? [{ type: 'text', value: rest }] : []), ...paragraph.children.slice(1)] };
	const children = node.children.map((c) => (c === paragraph ? body : c));
	// A marker alone on its paragraph's first line leaves an empty paragraph behind.
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
					const resolved = resolveHref(from, href, byFile);
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
