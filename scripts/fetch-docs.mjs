import { spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
	const result = spawnSync(
		'git',
		['clone', '--depth=1', '--branch', ref, '--single-branch', repository, checkout],
		{ encoding: 'utf8', timeout: 30_000 },
	);

	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `git clone exited with status ${result.status}`);
	}

	await rm(join(checkout, '.git'), { recursive: true, force: true });
	await rm(destination, { recursive: true, force: true });
	await rename(checkout, destination);
	console.log(`Cloned zane-lang/docs@${ref} to src/content/docs`);
} finally {
	await rm(workDirectory, { recursive: true, force: true });
}
