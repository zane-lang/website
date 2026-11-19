// Turns a link written in a source page into a link on the site. A link
// between published pages becomes a site route. A link to any other file in a
// Zane repository points at GitHub, so the link leads to the same file as it
// does when the page is read on GitHub.
import { posix } from 'node:path';
import { safeDecode } from './markdown.mjs';
import { github } from './sources.mjs';

const githubFile = /^https:\/\/github\.com\/zane-lang\/([^/]+)\/(?:blob|tree)\/main\/([^?#]*)(\?[^#]*)?(#.*)?$/;

function splitHref(href) {
	const m = href.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
	return { path: m[1], query: m[2] ?? '', hash: m[3] ?? '' };
}

function publishedRoute(byFile, repo, repoPath) {
	const clean = repoPath.replace(/\/+$/, '');
	const page = byFile.get(`${repo}:${clean}`) ?? byFile.get(`${repo}:${clean ? `${clean}/` : ''}README.md`);
	return page?.route;
}

/**
 * The GitHub page of a path in a repository: `blob` for a file, `tree` for a folder.
 * @param {'file' | 'dir'} [known]  whether the path is a file or a folder,
 *   when the downloaded copy shows which; otherwise a name with an extension
 *   is taken to be a file.
 */
export function githubUrl(repo, repoPath, known) {
	const clean = repoPath.replace(/\/+$/, '');
	const isFile = known ? known === 'file' : clean !== '' && /\.[A-Za-z0-9]+$/.test(posix.basename(clean));
	const kind = clean !== '' && isFile ? 'blob' : 'tree';
	return `${github}/${repo}/${kind}/main${clean ? `/${encodePath(clean)}` : ''}`;
}

/** A decoded repository path as a URL path, with each segment percent-encoded so that a `#` or `?` in a file name stays part of the name. */
export function encodePath(repoPath) {
	return repoPath.split('/').map(encodeURIComponent).join('/');
}

/** The URL that a link to a missing file points to, so that the link check reports the link. */
export const missingPrefix = '/missing-file';

/**
 * @param {{ repo: string, path: string }} from  the page the link is on
 * @param {string} href  the link as written
 * @param {Map<string, { route?: string }>} byFile  published pages, keyed repo:path
 * @param {(repo: string, path: string) => boolean} [isMissing]  whether a path
 *   inside a downloaded documentation folder does not exist
 * @param {(repo: string, path: string) => 'file' | 'dir' | undefined} [kindOf]
 *   whether a path is a file or a folder in the downloaded copy, when the
 *   downloaded copy holds the path
 * @returns {string} the link to put on the site
 */
export function resolveHref(from, href, byFile, isMissing = () => false, kindOf = () => undefined) {
	if (!href || href.startsWith('#')) return href;

	const remote = href.match(githubFile);
	if (remote) {
		const [, repo, repoPath, query = '', hash = ''] = remote;
		const path = safeDecode(repoPath).replace(/\/+$/, '');
		const route = publishedRoute(byFile, repo, path);
		if (route) return route + query + hash;
		return isMissing(repo, path) ? `${missingPrefix}/${repo}/${encodePath(path)}` : href;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('/')) return href;

	const { path, query, hash } = splitHref(href);
	if (!path) return href;
	const joined = posix.normalize(posix.join(posix.dirname(from.path), safeDecode(path)));
	if (joined === '..' || joined.startsWith('../')) return href; // outside the repository: leave for the link check
	const repoPath = joined === '.' ? '' : joined;

	const route = publishedRoute(byFile, from.repo, repoPath);
	if (route) return route + query + hash;
	if (isMissing(from.repo, repoPath)) return `${missingPrefix}/${from.repo}/${encodePath(repoPath)}`;
	return githubUrl(from.repo, repoPath, kindOf(from.repo, repoPath)) + query + hash;
}
