import { spawnSync } from 'node:child_process';
import { access, mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'zane-lang/docs';
const ref = process.env.ZANE_DOCS_REF || 'main';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDirectory = join(root, 'src/content');
const destination = join(contentDirectory, 'docs');

if (process.argv.includes('--skip-if-exists')) {
	try {
		await access(join(destination, 'README.md'));
		console.log('Docs already exist, skipping download.');
		process.exit(0);
	} catch {}
}

await mkdir(contentDirectory, { recursive: true });
const workDirectory = await mkdtemp(join(contentDirectory, '.docs-'));
const archive = join(workDirectory, 'docs.tar.gz');
const extracted = join(workDirectory, 'extracted');

try {
	const response = await fetch(
		`https://github.com/${repository}/archive/${encodeURIComponent(ref)}.tar.gz`,
		{
			headers: {
				'User-Agent': 'zane-lang-website',
			},
			signal: AbortSignal.timeout(30_000),
		},
	);

	if (!response.ok) {
		throw new Error(`GitHub returned ${response.status} ${response.statusText}`);
	}

	await writeFile(archive, Buffer.from(await response.arrayBuffer()));
	await mkdir(extracted);

	const result = spawnSync(
		'tar',
		['-xzf', archive, '--strip-components=1', '-C', extracted],
		{ encoding: 'utf8' },
	);

	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(result.stderr.trim() || `tar exited with status ${result.status}`);
	}

	await access(join(extracted, 'README.md'));
	await rm(destination, { recursive: true, force: true });
	await rename(extracted, destination);
	console.log(`Downloaded ${repository}@${ref} to src/content/docs`);
} finally {
	await rm(workDirectory, { recursive: true, force: true });
}
