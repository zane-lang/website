import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import zane from './src/syntax/zane.tmLanguage.json' with { type: 'json' };
import { zaneDocs } from './src/plugins/zane-docs.mjs';

export default defineConfig({
	site: 'https://zane-lang.org',
	integrations: [sitemap()],
	markdown: {
		// Pages come from the Zane repositories as GitHub-flavoured Markdown. The
		// plugin rewrites the pages' links to site routes and renders GitHub alerts.
		processor: satteri({ hastPlugins: [zaneDocs] }),
		shikiConfig: {
			// Token colours come from the site's palette (see global.scss), so
			// code colours change with the light/dark theme switch.
			theme: 'css-variables',
			langs: [zane],
			// These languages have no grammar and show as plain text: `coda`
			// (zane.coda files) and `output` (a program's printed output, under
			// a checked example).
			langAlias: { coda: 'text', output: 'text' },
		},
	},
});
