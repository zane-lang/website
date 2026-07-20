import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = 'zane-lang/docs';
const ref = process.env.ZANE_DOCS_REF || 'main';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'src/content/docs');
const workDirectory = await mkdtemp(join(root, 'src/content/.docs-'));
const archive = join(workDirectory, 'docs.tar.gz');
const extracted = join(workDirectory, 'extracted');

try {
	const response = await fetch(
		`https://api.github.com/repos/${repository}/tarball/${encodeURIComponent(ref)}`,
		{
			headers: {
				Accept: 'application/vnd.github+json',
				'User-Agent': 'zane-lang-website',
			},
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

	await readFile(join(extracted, 'README.md'));
	await rm(destination, { recursive: true, force: true });
	await rename(extracted, destination);
	console.log(`Downloaded ${repository}@${ref} to src/content/docs`);
} finally {
	await rm(workDirectory, { recursive: true, force: true });
}
