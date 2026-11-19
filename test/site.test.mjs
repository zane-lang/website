import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { titleOf, descriptionOf, indexOutline, lines } from '../src/lib/markdown.mjs';
import { buildSiteMap, sharedPrefix, routeForPath } from '../src/lib/site-map.mjs';
import { resolveHref, githubUrl } from '../src/lib/links.mjs';
import { alertFrom } from '../src/plugins/zane-docs.mjs';
import { sampleFrom } from '../src/lib/home.mjs';
import { sources } from '../src/lib/sources.mjs';

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
	assert.ok(messages.some((m) => m.startsWith('error: zane/docs/README.md is missing')));
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
	page('/spec/memory', '<a href="/spec/types#2-values">ok</a><a href="https://github.com/x">external</a><pre><a href="/nowhere">in code</a></pre>');
	const script = join(here, '../scripts/check-links.mjs');
	execFileSync('node', [script, dist]);

	page('/spec/lifetimes', '<a href="/spec/types#3-gone">anchor</a><a href="/spec/nowhere">page</a>');
	const run = spawnSync('node', [script, dist], { encoding: 'utf8' });
	assert.equal(run.status, 1);
	assert.match(run.stderr, /spec\/spec\/spec\/lifetimes\.md:/);
	assert.match(run.stderr, /\/spec\/types#3-gone — no #3-gone on \/spec\/types\//);
	assert.match(run.stderr, /\/spec\/nowhere — no such page/);
});
