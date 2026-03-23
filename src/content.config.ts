import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

export const collections = {
	docs: defineCollection({
		loader: glob({
			base: './src/content/docs',
			pattern: [
				'**/*.{md,mdx}',
				'!**/README.md',
				'!**/LICENSE*',
			],
		}),
		schema: z.object({
			title: z.string(),
			description: z.string().optional(),
		}),
	}),
};
