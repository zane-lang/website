// Turns a link written in a source page into a link on the site. Links between
// published pages become site routes; links to anything else in a Zane
// repository point at GitHub, so they work the same as when read there.
import { posix } from 'node:path';
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

export function githubUrl(repo, repoPath) {
	const clean = repoPath.replace(/\/+$/, '');
	const kind = clean === '' || !/\.[A-Za-z0-9]+$/.test(posix.basename(clean)) ? 'tree' : 'blob';
	return `${github}/${repo}/${kind}/main${clean ? `/${clean}` : ''}`;
}

/**
 * @param {{ repo: string, path: string }} from  the page the link is on
 * @param {string} href  the link as written
 * @param {Map<string, { route?: string }>} byFile  published pages, keyed repo:path
 * @returns {string} the link to put on the site
 */
export function resolveHref(from, href, byFile) {
	if (!href || href.startsWith('#')) return href;

	const remote = href.match(githubFile);
	if (remote) {
		const [, repo, repoPath, query = '', hash = ''] = remote;
		const route = publishedRoute(byFile, repo, decodeURIComponent(repoPath));
		return route ? route + query + hash : href;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('/')) return href;

	const { path, query, hash } = splitHref(href);
	if (!path) return href;
	const joined = posix.normalize(posix.join(posix.dirname(from.path), decodeURIComponent(path)));
	if (joined === '..' || joined.startsWith('../')) return href; // outside the repository: leave for the link check
	const repoPath = joined === '.' ? '' : joined;

	const route = publishedRoute(byFile, from.repo, repoPath);
	if (route) return route + query + hash;
	return githubUrl(from.repo, repoPath) + query + hash;
}
