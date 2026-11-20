// Checks every internal link in the built site (dist/): the page that a link
// points to must exist, and so must the link's #anchor. Runs after
// `astro build`. On a broken link, lists each broken link with the source file
// that contains it, and exits 1.
//
//   node scripts/check-links.mjs [dist-dir]
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { root } from '../src/lib/sources.mjs';

const dist = process.argv[2] ?? join(root, 'dist');
if (!existsSync(dist)) {
	console.error(`${dist} does not exist: run npm run build first.`);
	process.exit(1);
}
// Files that the build generates itself, which have no anchors worth checking.
const skipped = [/^\/_astro\//, /^\/pagefind\//, /^\/sitemap[^/]*\.xml$/];

function htmlFiles(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) htmlFiles(path, out);
		else if (name.endsWith('.html')) out.push(path);
	}
	return out;
}

/** The URL path that a built file is served at: dist/spec/memory/index.html → /spec/memory/. */
function routeOf(file) {
	const rel = relative(dist, file).split(sep).join('/');
	if (rel === 'index.html') return '/';
	if (rel.endsWith('/index.html')) return `/${rel.slice(0, -'index.html'.length)}`;
	return `/${rel}`;
}

/** The built file served at a URL path, or undefined when there is none. */
function fileFor(pathname) {
	const clean = decode(pathname).replace(/\/+$/, '');
	for (const candidate of [join(dist, clean, 'index.html'), join(dist, `${clean}.html`), join(dist, clean)]) {
		if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
	}
	return undefined;
}

const decode = (s) => {
	try {
		return decodeURIComponent(s);
	} catch {
		return s;
	}
};

/** An attribute value with its character references (&amp;, &#38;, &#x26;) decoded. */
const unescape = (value) =>
	value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos));/gi, (all, dec, hex, named) => {
		if (named) return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
		const code = dec ? Number(dec) : parseInt(hex, 16);
		return code <= 0x10ffff ? String.fromCodePoint(code) : all;
	});

// HTML comments hold no anchors and no links.
const uncommented = (html) => html.replace(/<!--[\s\S]*?-->/g, '');
// The HTML with <pre> and <code> content also removed, so that code examples
// containing HTML are not read as links.
const markup = (html) => uncommented(html).replace(/<(pre|code|script|style)\b[\s\S]*?<\/\1>/gi, '');

const pages = new Map(); // file → { ids, links, source }
for (const file of htmlFiles(dist)) {
	const html = readFileSync(file, 'utf8');
	const body = markup(html);
	// Attribute values in either quoting: Astro writes "…", but a page's own HTML
	// may use '…'.
	const value = (m) => unescape(m[1] ?? m[2] ?? m[3]);
	const attribute = (name) => String.raw`\s${name}\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'\s>]+))`;
	// A fragment matches an element's id attribute, or the name attribute of an
	// <a> element; the name attribute of any other element does not count.
	const ids = new Set(
		[
			...uncommented(html).matchAll(new RegExp(`<[a-z][^>]*?${attribute('id')}`, 'gi')),
			...uncommented(html).matchAll(new RegExp(`<a\\b[^>]*?${attribute('name')}`, 'gi')),
		].map(value),
	);
	const links = [...body.matchAll(new RegExp(`<a\\b[^>]*?${attribute('href')}`, 'gi'))].map(value);
	const source = html.match(/<meta name="zane:source" content="([^"]+)"/)?.[1];
	pages.set(file, { ids, links, source });
}

const broken = [];
for (const [file, page] of pages) {
	const base = new URL(routeOf(file), 'https://site.invalid');
	for (const href of page.links) {
		if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
		const url = new URL(href, base);
		if (url.origin !== base.origin) continue; // an external link: not checked
		if (skipped.some((re) => re.test(url.pathname))) continue;

		const target = url.pathname === base.pathname ? file : fileFor(url.pathname);
		if (!target) {
			broken.push({ page, file, href, reason: 'no such page' });
			continue;
		}
		const hash = decode(url.hash.slice(1));
		if (hash && pages.has(target) && !pages.get(target).ids.has(hash)) {
			broken.push({ page, file, href, reason: `no #${hash} on ${routeOf(target)}` });
		}
	}
}

if (broken.length) {
	const byPage = Map.groupBy(broken, (b) => b.page.source ?? routeOf(b.file));
	for (const [where, items] of byPage) {
		console.error(`${where}:`);
		for (const b of items) console.error(`  ${b.href} — ${b.reason}`);
	}
	console.error(`\n${broken.length} broken link(s) on ${byPage.size} page(s).`);
	process.exit(1);
}
console.log(`Checked the links on ${pages.size} pages: none broken.`);
