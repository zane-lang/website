// Downloads the documentation folders the site publishes (src/lib/sources.mjs)
// into src/content/repos/<repo>, one shallow sparse clone per repository.
//
//   ZANE_<REPO>_REF=<branch or tag>  read that ref instead of main
//   ZANE_<REPO>_PATH=<directory>     use a local checkout instead (linked, so edits show live)
//   --skip-if-exists                 keep repositories that are already downloaded
//   --verbose                        list every page no index links
//
// Afterwards it reads every index and reports pages no index links, and fails
// when a source has no index at all.
import { execFile } from 'node:child_process';
import { existsSync, lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { defaultRef, envName, github, keepsRef, manifestPath, repos, reposDir, root } from '../src/lib/sources.mjs';
import { buildSiteMap } from '../src/lib/site-map.mjs';

const run = promisify(execFile);
const skipIfExists = process.argv.includes('--skip-if-exists');

async function git(args, options = {}) {
	const { stdout } = await run('git', args, { timeout: 180_000, maxBuffer: 16 << 20, ...options });
	return stdout.trim();
}

async function readManifest() {
	try {
		return JSON.parse(await readFile(manifestPath, 'utf8'));
	} catch {
		return { repos: {} };
	}
}

async function removeEntry(path) {
	// rm on a symlink removes the link, not the checkout it points to.
	if (existsSync(path) || isLink(path)) await rm(path, { recursive: true, force: true });
}

function isLink(path) {
	try {
		return lstatSync(path).isSymbolicLink();
	} catch {
		return false;
	}
}

async function useLocal(repo, localPath) {
	const target = isAbsolute(localPath) ? localPath : resolve(root, localPath);
	if (!existsSync(target)) throw new Error(`${envName(repo, 'PATH')}=${localPath}: no such directory`);
	const destination = join(reposDir, repo);
	await removeEntry(destination);
	// A junction needs no administrator rights on Windows; elsewhere the type is ignored.
	await symlink(target, destination, process.platform === 'win32' ? 'junction' : 'dir');
	const commit = await git(['-C', target, 'rev-parse', 'HEAD']).catch(() => undefined);
	console.log(`Linked ${repo} to ${target}`);
	return { kind: 'local', path: target, commit };
}

async function clone(repo, folders, ref) {
	const destination = join(reposDir, repo);
	const work = await mkdtemp(join(reposDir, `.${repo}-`));
	const checkout = join(work, 'checkout');
	const previous = join(work, 'previous');
	try {
		await git(['clone', '--depth=1', '--filter=blob:none', '--sparse', '--single-branch', '--branch', ref, `${github}/${repo}.git`, checkout]);
		await git(['-C', checkout, 'sparse-checkout', 'set', '--cone', ...folders]);
		const commit = await git(['-C', checkout, 'rev-parse', 'HEAD']);
		await rm(join(checkout, '.git'), { recursive: true, force: true });

		// Move the old copy aside rather than deleting it, so a failed swap can put it back.
		const hadPrevious = existsSync(destination) || isLink(destination);
		if (hadPrevious) await rename(destination, previous);
		try {
			await rename(checkout, destination);
		} catch (error) {
			if (hadPrevious) await rename(previous, destination);
			throw error;
		}
		console.log(`Fetched zane-lang/${repo}@${ref} (${commit.slice(0, 12)}): ${folders.join(', ')}`);
		return { kind: 'clone', ref, commit };
	} catch (error) {
		const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
		throw new Error(`zane-lang/${repo}@${ref}: ${stderr || error?.message || 'clone failed'}`, { cause: error });
	} finally {
		// A failed cleanup must not hide the error that got us here.
		await rm(work, { recursive: true, force: true }).catch((error) => {
			console.warn(`Could not remove ${work}: ${error.message}`);
		});
	}
}

await mkdir(reposDir, { recursive: true });
const previousManifest = await readManifest();
const manifest = { repos: {} };

const results = await Promise.allSettled(
	repos.map(async ({ repo, folders }) => {
		const localPath = process.env[envName(repo, 'PATH')];
		if (localPath) return [repo, await useLocal(repo, localPath)];

		const destination = join(reposDir, repo);
		const ref = process.env[envName(repo, 'REF')] || defaultRef;
		const kept = previousManifest.repos?.[repo];
		const entries = await readdir(destination).catch(() => []);
		if (skipIfExists && entries.length > 0 && !isLink(destination) && keepsRef(kept, ref)) {
			console.log(`Keeping zane-lang/${repo}@${kept.ref} (${kept.commit?.slice(0, 12)}); run npm run fetch to refresh.`);
			return [repo, kept];
		}
		return [repo, await clone(repo, folders, ref)];
	}),
);

const failures = results.filter((r) => r.status === 'rejected');
for (const r of results) if (r.status === 'fulfilled') manifest.repos[r.value[0]] = r.value[1];
await writeFile(manifestPath, JSON.stringify(manifest, null, '\t') + '\n');

if (failures.length) {
	for (const f of failures) console.error(f.reason.message);
	process.exit(1);
}

// Errors stop the build; unlisted pages are only reported (many are maintainer notes).
const { problems } = buildSiteMap();
const errors = problems.filter((p) => p.level === 'error');
const warnings = problems.filter((p) => p.level === 'warning');
const verbose = process.argv.includes('--verbose');
for (const p of verbose ? warnings : warnings.slice(0, 5)) console.warn(`warning: ${p.message}`);
if (!verbose && warnings.length > 5) console.warn(`… and ${warnings.length - 5} more unlisted pages (--verbose lists them).`);
for (const p of errors) console.error(`error: ${p.message}`);
if (errors.length) process.exit(1);
