import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repository = 'https://github.com/zane-lang/docs.git';
const ref = process.env.ZANE_DOCS_REF || 'main';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = join(root, 'src/content');
const destination = join(contentDirectory, 'docs');

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

// A clone from before the docs were fetched by this script still holds the old
// submodule checkout here. It may carry uncommitted work, so never replace it.
if (await exists(join(destination, '.git'))) {
	console.error(
		'src/content/docs is a leftover Git submodule checkout. Save any changes made ' +
			'there, delete the folder, and run this again.',
	);
	process.exit(1);
}

if (process.argv.includes('--skip-if-exists')) {
	const entries = await readdir(destination).catch(() => []);
	if (entries.length > 0) {
		console.log('Docs already exist, skipping download.');
		process.exit(0);
	}
}

await mkdir(contentDirectory, { recursive: true });
const workDirectory = await mkdtemp(join(contentDirectory, '.docs-'));
const checkout = join(workDirectory, 'checkout');
const previous = join(workDirectory, 'previous');

try {
	await execFileAsync(
		'git',
		['clone', '--depth=1', '--branch', ref, '--single-branch', repository, checkout],
		{ timeout: 30_000 },
	);
	await rm(join(checkout, '.git'), { recursive: true, force: true });

	// Move the old copy aside rather than deleting it, so a failed swap can put it back.
	const hadPrevious = await exists(destination);
	if (hadPrevious) await rename(destination, previous);
	try {
		await rename(checkout, destination);
	} catch (error) {
		if (hadPrevious) await rename(previous, destination);
		throw error;
	}
	console.log(`Cloned zane-lang/docs@${ref} to src/content/docs`);
} catch (error) {
	const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
	throw new Error(stderr || error?.message || 'Failed to clone documentation', { cause: error });
} finally {
	// A failed cleanup must not hide the error that got us here.
	await rm(workDirectory, { recursive: true, force: true }).catch((error) => {
		console.warn(`Could not remove ${workDirectory}: ${error.message}`);
	});
}
