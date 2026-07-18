// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: "https://zane-lang.org",
	integrations: [
		starlight({
			title: 'Zane Docs',
			description: 'The Zane programming language',
			favicon: '/favicons/favicon.ico',
			logo: {
				src: './src/assets/zane-black.svg',
				alt: 'Black version of Zane logo',
			},
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/TheLazyCat00' }],
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Example Guide', slug: 'guides/example' },
					],
				},
				{
					label: 'Reference',
					items: [{ autogenerate: { directory: 'reference' } }],
				},
			],
		}),
	],
});
