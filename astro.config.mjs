import { defineConfig } from 'astro/config';

// import fs from 'node:fs/promises';
// import path from 'node:path';

// async function fetchDocs() {
// 	const repo = 'zane-lang/docs';
// 	const branch = 'main';
//
// 	// Get list of files from GitHub API
// 	const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`);
// 	const { tree } = await res.json();
//
// 	const mdFiles = tree.filter(f => f.path.endsWith('.md') || f.path.endsWith('.mdx'));
//
// 	for (const file of mdFiles) {
// 		// Fetch raw file content
// 		const raw = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${file.path}`);
// 		const content = await raw.text();
//
// 		// Write to src/content/docs/
// 		const dest = path.join('src/content/docs', file.path);
// 		await fs.mkdir(path.dirname(dest), { recursive: true });
// 		await fs.writeFile(dest, content);
// 	}
//
// 	console.log(`Fetched ${mdFiles.length} docs files from ${repo}`);
// }

export default defineConfig({
	// hooks: {
	// 	'astro:config:setup': async () => {
	// 		await fetchDocs();
	// 	}
	// }
});
