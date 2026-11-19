import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';
import { join } from 'node:path';
import { sources, reposDir } from './lib/sources.mjs';

// One collection per tab, over the folder fetch-sources.mjs downloaded. Pages
// have no frontmatter: the title is the first heading (PUBLISHING.md), and
// which pages are published comes from the folder's index (src/lib/site-map.mjs).
// An entry's id is its path inside the folder, without `.md`.
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
