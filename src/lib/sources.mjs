// The documentation that the site publishes, with one tab per source folder.
// Each folder follows the layout in PUBLISHING.md. This file is plain
// JavaScript, so that the build scripts and the Astro pages share one list.
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
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

/** The branch that every source is read from, unless ZANE_<REPO>_REF names another branch or tag. */
export const defaultRef = 'main';

/** Each repository listed once, with the folders that the site needs from the repository. */
export const repos = [...new Set(sources.map((s) => s.repo))].map((repo) => ({
	repo,
	folders: sources.filter((s) => s.repo === repo).map((s) => s.folder),
}));

/** The website's root: the nearest folder above this file that contains astro.config.mjs (also when this file is bundled into dist/). */
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
 * The folder where fetch-sources.mjs puts each repository: src/content/repos/<repo>,
 * or the folder that ZANE_SITE_REPOS_DIR names (the tests set it to a scratch folder).
 */
export const reposDir = process.env.ZANE_SITE_REPOS_DIR || join(root, 'src/content/repos');

export const manifestPath = join(reposDir, 'manifest.json');

export const routeOf = (source) => `/${source.id}`;

/** The environment variable names for a repository, e.g. ZANE_SPEC_REF. */
export const envName = (repo, kind) => `ZANE_${repo.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${kind}`;

/**
 * Whether a download recorded in the manifest can be reused instead of fetching
 * `ref` again (`npm run dev` keeps downloads). Only a clone of the same ref can
 * be reused.
 * @param {{ kind?: string, ref?: string } | undefined} kept
 * @param {string} ref
 */
export function keepsRef(kept, ref) {
	return kept?.kind === 'clone' && kept.ref === ref;
}

/**
 * Whether linking `destination` to the local checkout `target` would delete
 * `target`. The fetch removes a downloaded folder before linking, so a target
 * that is that folder, or lies inside it, would be deleted with it. Removing a
 * symlink deletes only the symlink, not the folder it points to, so an
 * existing symlink is always safe to replace.
 * @param {string} destination  src/content/repos/<repo>
 * @param {string} target  the checkout that ZANE_<REPO>_PATH names
 */
export function removalDeletes(destination, target) {
	let stat;
	try {
		stat = lstatSync(destination);
	} catch {
		return false;
	}
	if (stat.isSymbolicLink()) return false;
	const dest = realpathSync(destination);
	const real = realpathSync(target);
	return real === dest || real.startsWith(dest + sep);
}
