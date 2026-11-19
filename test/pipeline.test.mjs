// The fetch script and the Markdown plugin, run against the fixture repositories
// in a scratch folder (ZANE_SITE_REPOS_DIR), as a build runs them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures/repos');
const scratch = mkdtempSync(join(tmpdir(), 'zane-repos-'));
process.env.ZANE_SITE_REPOS_DIR = scratch;
const { envName, routeOf, sources } = await import('../src/lib/sources.mjs');
const { zaneDocs } = await import('../src/plugins/zane-docs.mjs');
const { zaneSample } = await import('../src/lib/home.mjs');
const { markdownToHtml } = await import('satteri');

const fetchScript = join(here, '../scripts/fetch-sources.mjs');
const localEnv = Object.fromEntries(['docs', 'spec', 'zane', 'std', 'compiler'].map((r) => [envName(r, 'PATH'), join(fixtures, r)]));
const fetch = (env = {}) =>
	spawnSync('node', [fetchScript], { encoding: 'utf8', env: { ...process.env, ...localEnv, ...env } });

test('environment variables are named after the repository', () => {
	assert.equal(envName('spec', 'REF'), 'ZANE_SPEC_REF');
	assert.equal(envName('my-repo', 'PATH'), 'ZANE_MY_REPO_PATH');
	assert.deepEqual(sources.map(routeOf), ['/docs', '/spec', '/stories', '/tools', '/std', '/compiler']);
});

test('ZANE_<REPO>_PATH links local checkouts and reports index problems', () => {
	const run = fetch();
	for (const repo of ['docs', 'spec', 'zane', 'std', 'compiler']) {
		assert.ok(lstatSync(join(scratch, repo)).isSymbolicLink(), `${repo} is linked`);
	}
	const manifest = JSON.parse(readFileSync(join(scratch, 'manifest.json'), 'utf8'));
	assert.equal(manifest.repos.spec.kind, 'local');
	assert.equal(manifest.repos.spec.path, join(fixtures, 'spec'));
	assert.match(run.stderr, /warning: spec\/spec\/draft\.md is not linked/);
	assert.match(run.stderr, /error: docs\/docs\/tour\/README\.md links missing\.md, which does not exist\./);
	assert.equal(run.status, 1, 'an index linking a missing page stops the build');
});

test('a ZANE_<REPO>_PATH that does not exist fails with its name', () => {
	const run = fetch({ ZANE_STD_PATH: join(scratch, 'nowhere') });
	assert.equal(run.status, 1);
	assert.match(run.stderr, /ZANE_STD_PATH=.*nowhere: no such directory/);
});

test('the plugin rewrites links and renders alerts in a fetched page', async () => {
	fetch();
	const file = join(scratch, 'spec/spec/foundations.md');
	const source = readFileSync(file, 'utf8') + '\n> [!NOTE]\n> Mind this.\n\n[draft](draft.md) and [typo](typo.md)\n';
	const { html } = await markdownToHtml(source, { hastPlugins: [zaneDocs], fileURL: pathToFileURL(file) });
	assert.match(html, /href="\/spec\/types#2-values"/);
	assert.match(html, /href="\/stories\/types#why"/);
	assert.match(html, /href="https:\/\/github\.com\/zane-lang\/spec\/blob\/main\/spec\/draft\.md"/);
	assert.match(html, /href="\/missing-file\/spec\/spec\/typo\.md"/);
	assert.match(html, /<aside class="alert alert--note"><p class="alert__title">Note<\/p>/);
});

test('the home sample is read from the fetched zane README', () => {
	fetch();
	assert.ok(existsSync(join(scratch, 'zane/README.md')));
	assert.equal(zaneSample(), 'package hello;');
});
