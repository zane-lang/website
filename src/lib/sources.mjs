// The documentation the site publishes: one tab per source folder. Each folder
// follows the layout in PUBLISHING.md. Plain JavaScript, so that the build
// scripts and the Astro pages share one list.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const github = 'https://github.com/zane-lang';

/** @typedef {{ id: string, label: string, repo: string, folder: string, blurb: string }} Source */

/** @type {Source[]} */
export const sources = [
	{
		id: 'docs',
		label: 'Learn',
		repo: 'docs',
		folder: 'docs',
		blurb: 'Install Zane, build a first project and take the language tour.',
	},
	{
		id: 'spec',
		label: 'Spec',
		repo: 'spec',
		folder: 'spec',
		blurb: 'The language specification: what every construct means.',
	},
	{
		id: 'stories',
		label: 'Stories',
		repo: 'spec',
		folder: 'stories',
		blurb: 'How and why each part of the language came to be.',
	},
	{
		id: 'tools',
		label: 'Tools',
		repo: 'zane',
		folder: 'docs',
		blurb: 'The design of the zane command and how it is released.',
	},
	{
		id: 'std',
		label: 'Library',
		repo: 'std',
		folder: 'docs',
		blurb: 'The core, math and regex packages.',
	},
	{
		id: 'compiler',
		label: 'Compiler',
		repo: 'compiler',
		folder: 'docs',
		blurb: 'How zanec implements the language, and where it differs from the spec.',
	},
];

/** The branch every source is read from, unless ZANE_<REPO>_REF says otherwise. */
export const defaultRef = 'main';

/** Each repository once, with the folders the site needs from it. */
export const repos = [...new Set(sources.map((s) => s.repo))].map((repo) => ({
	repo,
	folders: sources.filter((s) => s.repo === repo).map((s) => s.folder),
}));

/** The website's root: the nearest folder up from here with astro.config.mjs (also when bundled into dist/). */
export const root = (() => {
	let dir = dirname(fileURLToPath(import.meta.url));
	while (!existsSync(join(dir, 'astro.config.mjs'))) {
		const parent = dirname(dir);
		if (parent === dir) return process.cwd();
		dir = parent;
	}
	return dir;
})();

/**
 * Where fetch-sources.mjs puts each repository: src/content/repos/<repo>, or
 * ZANE_SITE_REPOS_DIR (the tests use a scratch folder).
 */
export const reposDir = process.env.ZANE_SITE_REPOS_DIR || join(root, 'src/content/repos');

export const manifestPath = join(reposDir, 'manifest.json');

export const routeOf = (source) => `/${source.id}`;

/** The environment variable names for a repository, e.g. ZANE_SPEC_REF. */
export const envName = (repo, kind) => `ZANE_${repo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${kind}`;
