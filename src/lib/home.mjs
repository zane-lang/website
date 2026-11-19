// The home page's code sample: the first `zane` example under "A taste of Zane"
// in the zane-lang/zane README, fetched with the sources.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { reposDir } from './sources.mjs';

export function sampleFrom(readme) {
	const section = readme.split(/^## A taste of Zane[ \t]*$/m)[1];
	const m = section?.match(/^```zane[ \t]*\n([\s\S]*?)\n```[ \t]*$/m);
	if (!m) throw new Error('zane-lang/zane README.md: no ```zane example under "## A taste of Zane" for the home page');
	return m[1];
}

export function zaneSample() {
	return sampleFrom(readFileSync(join(reposDir, 'zane', 'README.md'), 'utf8'));
}
