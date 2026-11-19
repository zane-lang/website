import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { titleOf, descriptionOf, indexOutline, lines, plain } from '../src/lib/markdown.mjs';
import { buildSiteMap, sharedPrefix, routeForPath, locateFile } from '../src/lib/site-map.mjs';
import { resolveHref, githubUrl } from '../src/lib/links.mjs';
import { alertFrom, isMissing, kindOf } from '../src/plugins/zane-docs.mjs';
import { sampleFrom } from '../src/lib/home.mjs';
import { keepsRef, removalDeletes, sources } from '../src/lib/sources.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures/repos');
const map = buildSiteMap(fixtures);
const routes = (tab) => map.tabs.find((t) => t.source.id === tab).pages.map((p) => p.route);

test('titles come from the first level-one heading, outside code', () => {
	assert.equal(titleOf('```md\n# no\n```\n\n# The `zane` [command](x.md)\n'), 'The zane command');
	assert.equal(titleOf('## Only a subheading\n'), undefined);
});

test('the description is the first paragraph after the title', () => {
	assert.equal(descriptionOf('# T\n\n> quote\n\nFirst *real* line\ncontinues.\n\nSecond.'), 'First real line continues.');
	assert.match(descriptionOf(`# T\n\n${'word '.repeat(80)}`), /…$/);
});

test('a description with no space to cut at is cut at the limit', () => {
	assert.equal(descriptionOf(`# T\n\n${'x'.repeat(250)}`, 200), `${'x'.repeat(200)}…`);
});

test('a malformed %-escape in a link does not stop the build', () => {
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	// Left undecoded, `%zz` names a file called bad%zz.md, whose URL escapes the `%`.
	assert.equal(resolveHref(from, 'bad%zz.md', map.byFile), 'https://github.com/zane-lang/spec/blob/main/spec/bad%25zz.md');
	assert.equal(resolveHref(from, 'https://github.com/zane-lang/spec/blob/main/spec/%E0%A4%A.md', map.byFile),
		'https://github.com/zane-lang/spec/blob/main/spec/%E0%A4%A.md');
	assert.doesNotThrow(() => buildSiteMap(fixtures));
});

test('a fetched file maps back to its repository path', () => {
	assert.deepEqual(locateFile(join(fixtures, 'spec', 'spec', 'types.md'), fixtures), { repo: 'spec', path: 'spec/types.md' });
	assert.equal(locateFile(join(here, 'site.test.mjs'), fixtures), undefined);
});

test('fences follow CommonMark: a longer fence holds a shorter one', () => {
	const marks = lines('````md\n```zane\n# x\n```\n````\n# after').map((l) => l.code);
	assert.deepEqual(marks, [true, true, true, true, true, false]);
});

test('an index outline lists groups and links in order', () => {
	const items = indexOutline('# I\n\n## A\n\n- [a](a.md) and [b](b.md#x)\n![img](i.png)\n\n```\n[no](no.md)\n```\n');
	assert.deepEqual(items, [
		{ type: 'group', title: 'A' },
		{ type: 'link', href: 'a.md' },
		{ type: 'link', href: 'b.md#x' },
	]);
});

test('the index sets order and nesting, and lists each page once', () => {
	assert.deepEqual(routes('spec'), ['/spec', '/spec/foundations', '/spec/types']);
	assert.deepEqual(routes('docs'), ['/docs', '/docs/install', '/docs/tour', '/docs/tour/basics']);
	const spec = map.tabs.find((t) => t.source.id === 'spec').root;
	assert.deepEqual(spec.children.map((c) => [c.kind, c.title]), [
		['group', 'Foundations'],
		['group', 'Types'],
		['group', 'Reading order'],
	]);
	assert.equal(spec.children[2].children.length, 0, 'a page already listed is not repeated');
});

test('unlisted pages, missing link targets and missing indexes are reported', () => {
	const messages = map.problems.map((p) => `${p.level}: ${p.message}`);
	assert.ok(messages.some((m) => m.startsWith('warning: spec/spec/draft.md is not linked')));
	assert.ok(messages.some((m) => m.startsWith('error: docs/docs/tour/README.md links missing.md')));
	const empty = buildSiteMap(mkdtempSync(join(tmpdir(), 'zane-empty-')));
	assert.ok(empty.problems.some((p) => p.message.startsWith('zane/docs/README.md is missing')));
});

test('routes drop .md and README', () => {
	const spec = sources.find((s) => s.id === 'spec');
	assert.equal(routeForPath(spec, 'spec/README.md'), '/spec');
	assert.equal(routeForPath(spec, 'spec/memory.md'), '/spec/memory');
	assert.equal(routeForPath(sources.find((s) => s.id === 'docs'), 'docs/tour/README.md'), '/docs/tour');
});

test('sidebar labels drop the words every title shares', () => {
	assert.equal(sharedPrefix(['Zane Types', 'Zane Memory Model']), 'Zane ');
	assert.equal(sharedPrefix(['Stories: Types', 'Stories: Memory']), 'Stories: ');
	assert.equal(sharedPrefix(['Zane', 'Zane Types']), '', 'a label never becomes empty');
	assert.equal(sharedPrefix(['Install', 'Basics']), '');
	const labels = map.tabs.find((t) => t.source.id === 'spec').pages.slice(1).map((p) => p.label);
	assert.deepEqual(labels, ['Foundations', 'Types']);
});

test('links between published pages become routes, keeping anchors', () => {
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	assert.equal(resolveHref(from, 'types.md#2-values', map.byFile), '/spec/types#2-values');
	assert.equal(resolveHref(from, '../stories/types.md#why', map.byFile), '/stories/types#why');
	assert.equal(resolveHref(from, 'README.md', map.byFile), '/spec');
	assert.equal(resolveHref(from, './', map.byFile), '/spec');
	assert.equal(resolveHref(from, '#local', map.byFile), '#local');
	const docs = { repo: 'docs', path: 'docs/README.md' };
	assert.equal(resolveHref(docs, 'tour/', map.byFile), '/docs/tour');
	assert.equal(
		resolveHref(docs, 'https://github.com/zane-lang/spec/blob/main/spec/types.md#2-values', map.byFile),
		'/spec/types#2-values',
	);
	assert.equal(resolveHref(docs, 'https://github.com/zane-lang/spec/tree/main/stories', map.byFile), '/stories');
});

test('links to anything unpublished point at GitHub', () => {
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	assert.equal(resolveHref(from, 'draft.md', map.byFile), 'https://github.com/zane-lang/spec/blob/main/spec/draft.md');
	assert.equal(resolveHref(from, '../memorybench/', map.byFile), 'https://github.com/zane-lang/spec/tree/main/memorybench');
	assert.equal(resolveHref(from, '../LICENSE', map.byFile), 'https://github.com/zane-lang/spec/tree/main/LICENSE');
	assert.equal(resolveHref(from, '../README.md#x', map.byFile), 'https://github.com/zane-lang/spec/blob/main/README.md#x');
	const pinned = 'https://github.com/zane-lang/spec/blob/0123456789abcdef0123456789abcdef01234567/spec/types.md#a';
	assert.equal(resolveHref(from, pinned, map.byFile), pinned, 'a commit-pinned link stays as written');
	assert.equal(resolveHref(from, 'https://example.com/a.md', map.byFile), 'https://example.com/a.md');
	assert.equal(githubUrl('std', 'lib/core'), 'https://github.com/zane-lang/std/tree/main/lib/core');
});

test('an extensionless file the fetched copy holds links to its file view on GitHub', () => {
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	const kind = (repo, path) => kindOf(repo, path, fixtures);
	assert.equal(kind('spec', 'LICENSE'), 'file');
	assert.equal(kind('spec', 'memorybench'), 'dir');
	assert.equal(kind('spec', 'nowhere'), undefined);
	const resolve = (href) => resolveHref(from, href, map.byFile, () => false, kind);
	assert.equal(resolve('../LICENSE'), 'https://github.com/zane-lang/spec/blob/main/LICENSE');
	assert.equal(resolve('../memorybench'), 'https://github.com/zane-lang/spec/tree/main/memorybench');
	assert.equal(resolve('../memorybench/runbench.py'), 'https://github.com/zane-lang/spec/blob/main/memorybench/runbench.py');
	assert.equal(githubUrl('spec', 'Makefile.d', 'dir'), 'https://github.com/zane-lang/spec/tree/main/Makefile.d');
});

test('a link to a missing file in a fetched folder points where the link check reports it', () => {
	const missing = (repo, path) => isMissing(repo, path, fixtures);
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	assert.equal(resolveHref(from, 'typo.md#x', map.byFile, missing), '/missing-file/spec/spec/typo.md');
	assert.equal(resolveHref(from, '../stories/typo.md', map.byFile, missing), '/missing-file/spec/stories/typo.md');
	assert.equal(
		resolveHref(from, 'https://github.com/zane-lang/docs/blob/main/docs/typo.md', map.byFile, missing),
		'/missing-file/docs/docs/typo.md',
	);
	assert.equal(resolveHref(from, 'draft.md', map.byFile, missing), 'https://github.com/zane-lang/spec/blob/main/spec/draft.md');
	assert.equal(resolveHref(from, '../memorybench/', map.byFile, missing), 'https://github.com/zane-lang/spec/tree/main/memorybench');
});

const text = (value) => ({ type: 'text', value });
const p = (...children) => ({ type: 'element', tagName: 'p', properties: {}, children });
const quote = (...children) => ({ type: 'element', tagName: 'blockquote', properties: {}, children });

test('GitHub alerts become callouts; plain quotes stay quotes', () => {
	const alert = alertFrom(quote(text('\n'), p(text('[!WARNING]\nMind the '), { type: 'element', tagName: 'strong', properties: {}, children: [text('gap')] })));
	assert.equal(alert.tagName, 'aside');
	assert.deepEqual(alert.properties.className, ['alert', 'alert--warning']);
	assert.equal(alert.children[0].children[0].value, 'Warning');
	assert.equal(alert.children[2].children[0].value, 'Mind the ');
	const markerOnly = alertFrom(quote(p(text('[!NOTE]')), p(text('Body'))));
	assert.deepEqual(markerOnly.children.map((c) => c.children[0].value), ['Note', 'Body']);
	assert.equal(alertFrom(quote(p(text('Just a quote')))), undefined);
	assert.equal(alertFrom(quote(p(text('[!NOTICE] not a kind')))), undefined);
});

test('the home sample is the README taste of Zane', () => {
	const readme = '# Zane\n\n```zane\nnot this\n```\n\n## A taste of Zane\n\n```zane\npackage hello;\n```\n\nMore.\n';
	assert.equal(sampleFrom(readme), 'package hello;');
	assert.throws(() => sampleFrom('# Zane\n'), /A taste of Zane/);
});

test('the link check passes good links and names broken ones', () => {
	const dist = mkdtempSync(join(tmpdir(), 'zane-links-'));
	const page = (route, body) => {
		mkdirSync(join(dist, route), { recursive: true });
		writeFileSync(join(dist, route, 'index.html'), `<html><head><meta name="zane:source" content="spec/spec${route}.md"></head><body>${body}</body></html>`);
	};
	page('/spec/types', '<h2 id="2-values">Values</h2>');
	page('/spec/memory', '<a href="/spec/types#2-values">ok</a><a href="https://github.com/x">external</a><pre><a href="/nowhere">in code</a></pre><!-- <a href="/removed/">old</a> -->');
	const script = join(here, '../scripts/check-links.mjs');
	execFileSync('node', [script, dist]);

	page('/spec/quotes', "<h2 id='single'>S</h2><a href='/spec/quotes#single'>ok</a><a HREF = \"/spec/types#2-values\">ok</a>");
	execFileSync('node', [script, dist]);

	page('/spec/lifetimes', '<!-- <h2 id="commented">x</h2> --><a href="/spec/lifetimes#commented">commented anchor</a><a href="/spec/types#3-gone">anchor</a><a href="/spec/nowhere">page</a><a href=\'/spec/x%zz\'>bad escape</a>');
	const run = spawnSync('node', [script, dist], { encoding: 'utf8' });
	assert.equal(run.status, 1);
	assert.match(run.stderr, /spec\/spec\/spec\/lifetimes\.md:/);
	assert.match(run.stderr, /\/spec\/types#3-gone — no #3-gone on \/spec\/types\//);
	assert.match(run.stderr, /\/spec\/nowhere — no such page/);
	assert.match(run.stderr, /#commented — no #commented on/);
	assert.doesNotMatch(run.stderr, /removed/);
	assert.match(run.stderr, /\/spec\/x%zz — no such page/);

	const missing = spawnSync('node', [script, join(dist, 'nope')], { encoding: 'utf8' });
	assert.equal(missing.status, 1);
	assert.match(missing.stderr, /does not exist: run npm run build first/);
});

test('a kept download is reused only for the ref it was cloned from', () => {
	const kept = { kind: 'clone', ref: 'main', commit: 'abc' };
	assert.equal(keepsRef(kept, 'main'), true);
	assert.equal(keepsRef(kept, 'my-branch'), false, 'ZANE_SPEC_REF=my-branch npm run dev must fetch the branch');
	assert.equal(keepsRef({ kind: 'local', path: '/x' }, 'main'), false);
	assert.equal(keepsRef(undefined, 'main'), false);
});

test('a file name with # or ? keeps it in its GitHub URL', () => {
	const from = { repo: 'spec', path: 'spec/foundations.md' };
	assert.equal(resolveHref(from, 'draft%23notes.md?x=1#top', map.byFile),
		'https://github.com/zane-lang/spec/blob/main/spec/draft%23notes.md?x=1#top');
	assert.equal(githubUrl('spec', 'a b/c?.md'), 'https://github.com/zane-lang/spec/blob/main/a%20b/c%3F.md');
});

test('code spans keep their text, and underscores inside words are not emphasis', () => {
	assert.equal(titleOf('# `parse_unsigned_int`\n'), 'parse_unsigned_int');
	assert.equal(plain('snake_case_name and _emphasis_ and __strong__'), 'snake_case_name and emphasis and strong');
	assert.equal(plain('``a `tick` b`` *x*'), 'a `tick` b x');
});

test('a link shown inside a code span is not an index link', () => {
	const hrefs = indexOutline('Write `[Example](example.md)` to link; see [real](real.md) and ``[x](`y`.md)``.\n')
		.filter((i) => i.type === 'link')
		.map((i) => i.href);
	assert.deepEqual(hrefs, ['real.md']);
});

test('the home sample reads a README with CRLF line endings', () => {
	const readme = '# Zane\r\n\r\n## A taste of Zane\r\n\r\n```zane\r\npackage hello;\r\n```\r\n';
	assert.equal(sampleFrom(readme), 'package hello;');
});

test('the link check reads character references, and names only on <a>', () => {
	const dist = mkdtempSync(join(tmpdir(), 'zane-links-'));
	const page = (route, body) => {
		mkdirSync(join(dist, route), { recursive: true });
		writeFileSync(join(dist, route, 'index.html'), `<html><head><meta name="description" content="x"></head><body>${body}</body></html>`);
	};
	const script = join(here, '../scripts/check-links.mjs');
	page('/a', '<h2 id="a&amp;b">x</h2><a href="#a%26b">ok</a><a href="/a#a&#38;b">ok</a><a href="/a#a&#x26;b">ok</a><a name="old">x</a><a href="#old">ok</a>');
	execFileSync('node', [script, dist]);
	page('/b', '<a href="/a#description">a meta name is no anchor</a>');
	const run = spawnSync('node', [script, dist], { encoding: 'utf8' });
	assert.equal(run.status, 1);
	assert.match(run.stderr, /\/a#description — no #description on \/a\//);
});

/** A copy of the fixtures with `change` applied to it. */
function fixturesWith(change) {
	const dir = mkdtempSync(join(tmpdir(), 'zane-fixtures-'));
	cpSync(fixtures, dir, { recursive: true });
	change(dir);
	return dir;
}

test('a folder link that loops back is scanned once', () => {
	const dir = fixturesWith((d) => symlinkSync(join(d, 'spec/spec'), join(d, 'spec/spec/loop'), 'dir'));
	const errors = (map) => map.problems.filter((p) => p.level === 'error').map((p) => p.message);
	assert.deepEqual(errors(buildSiteMap(dir)), errors(map), 'the loop adds no problem of its own');
});

test('two pages that would share a route are an error', () => {
	const dir = fixturesWith((d) => {
		mkdirSync(join(d, 'docs/docs/install'));
		writeFileSync(join(d, 'docs/docs/install/README.md'), '# Install too\n');
		writeFileSync(join(d, 'docs/docs/README.md'), '# Learn\n\n- [Install](install.md)\n- [Again](install/README.md)\n');
		writeFileSync(join(d, 'docs/docs/install.md'), '# Install\n');
	});
	const errors = buildSiteMap(dir).problems.filter((p) => p.level === 'error').map((p) => p.message);
	assert.equal(errors.length, 1);
	assert.match(errors[0], /install\/README\.md, which would be published at \/docs\/install like docs\/docs\/install\.md/);
});

test('an index link to a .MD file is an error, not a page with no route', () => {
	const dir = fixturesWith((d) => {
		writeFileSync(join(d, 'docs/docs/README.md'), '# Learn\n\n- [Install](Install.MD)\n');
		writeFileSync(join(d, 'docs/docs/Install.MD'), '# Install\n');
	});
	const errors = buildSiteMap(dir).problems.filter((p) => p.level === 'error').map((p) => p.message);
	assert.equal(errors.length, 1);
	assert.match(errors[0], /ends in \.md, in lower case/);
});

test('a local checkout inside the download folder is refused, not deleted', () => {
	const dir = mkdtempSync(join(tmpdir(), 'zane-repos-'));
	const downloaded = join(dir, 'docs');
	mkdirSync(join(downloaded, 'docs'), { recursive: true });
	assert.equal(removalDeletes(downloaded, downloaded), true);
	assert.equal(removalDeletes(downloaded, join(downloaded, 'docs')), true);
	const elsewhere = mkdtempSync(join(tmpdir(), 'zane-checkout-'));
	assert.equal(removalDeletes(downloaded, elsewhere), false);
	const linked = join(dir, 'spec');
	symlinkSync(elsewhere, linked, 'dir');
	assert.equal(removalDeletes(linked, elsewhere), false, 'replacing a link leaves its target');
	assert.equal(removalDeletes(join(dir, 'none'), elsewhere), false);

	const run = spawnSync('node', [join(here, '../scripts/fetch-sources.mjs')], {
		encoding: 'utf8',
		env: { ...process.env, ZANE_SITE_REPOS_DIR: dir, ZANE_DOCS_PATH: downloaded, ZANE_SPEC_PATH: elsewhere, ZANE_ZANE_PATH: elsewhere, ZANE_STD_PATH: elsewhere, ZANE_COMPILER_PATH: elsewhere },
	});
	assert.equal(run.status, 1);
	assert.match(run.stderr, /ZANE_DOCS_PATH=.* is inside .*, which fetching replaces/);
	assert.ok(existsSync(join(downloaded, 'docs')), 'the checkout is still there');
});

test('reference-style links in an index count, in the order they appear', () => {
	const md = [
		'# Index',
		'',
		'- [Tour][tour] then [Install](install.md)',
		'- [Errors][] and [faq] and [Not defined][nope] and `[tour]`',
		'- [Spaced  Label][SPACED label]',
		'',
		'[tour]: tour/README.md "The tour"',
		'[errors]: <tour/errors.md>',
		'[FAQ]: faq.md',
		'[spaced label]: spaced.md',
		'',
		'```md',
		'[tour]: ignored.md',
		'```',
	].join('\n');
	const hrefs = indexOutline(md).filter((i) => i.type === 'link').map((i) => i.href);
	assert.deepEqual(hrefs, ['tour/README.md', 'install.md', 'tour/errors.md', 'faq.md', 'spaced.md']);
});
