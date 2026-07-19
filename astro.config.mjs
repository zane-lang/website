import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// The docs live in the separate `zane-lang/docs` repo and are fetched and
// rendered on demand (see `src/lib/docs.ts`), so the docs routes run on the
// server via the Vercel adapter. Everything else is still statically built.
export default defineConfig({
	adapter: vercel(),
});
