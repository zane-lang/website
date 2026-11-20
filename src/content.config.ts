import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';
import { join } from 'node:path';
import { sources, reposDir } from './lib/sources.mjs';

// One content collection per tab, over the folder that fetch-sources.mjs
// downloaded. Pages have no frontmatter: a page's title is its first heading
// (PUBLISHING.md), and the folder's index page sets which pages are published
// (src/lib/site-map.mjs). An entry's id is the page's path inside the folder,
// without `.md`.
export const collections = Object.fromEntries(
	sources.map((source) => [
		source.id,
		defineCollection({
			loader: glob({
				base: join(reposDir, source.repo, source.folder),
				pattern: '**/*.md',
				generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
			}),
			schema: z.looseObject({}),
		}),
	]),
);
