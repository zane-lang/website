import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const repository = 'https://github.com/zane-lang/docs.git';
const ref = process.env.ZANE_DOCS_REF || 'main';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = join(root, 'src/content');
const destination = join(contentDirectory, 'docs');

if (process.argv.includes('--skip-if-exists')) {
	try {
		await access(destination);
		console.log('Docs already exist, skipping download.');
		process.exit(0);
	} catch {}
}

await mkdir(contentDirectory, { recursive: true });
const workDirectory = await mkdtemp(join(contentDirectory, '.docs-'));
const checkout = join(workDirectory, 'checkout');

try {
	await execFileAsync(
		'git',
		['clone', '--depth=1', '--branch', ref, '--single-branch', repository, checkout],
		{ timeout: 30_000 },
	);

	await rm(join(checkout, '.git'), { recursive: true, force: true });
	await rm(destination, { recursive: true, force: true });
	await rename(checkout, destination);
	console.log(`Cloned zane-lang/docs@${ref} to src/content/docs`);
} catch (error) {
	const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
	throw new Error(stderr || error?.message || 'Failed to clone documentation', { cause: error });
} finally {
	await rm(workDirectory, { recursive: true, force: true });
}
