import { defineConfig } from 'astro/config';
import zane from './src/syntax/zane.tmLanguage.json' with { type: 'json' };

export default defineConfig({
	markdown: {
		shikiConfig: {
			// Token colours come from the site's palette (see global.scss), so
			// code follows the light/dark theme switch.
			theme: 'css-variables',
			langs: [zane],
		},
	},
});
