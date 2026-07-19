# The Zane Website

## Docs

The documentation content lives in a separate repository,
[`zane-lang/docs`](https://github.com/zane-lang/docs). It is **not** vendored
here (no git submodule). Instead the `/docs` routes are server-rendered on
demand: they fetch the Markdown from GitHub and render it at request time
(see `src/lib/docs.ts`).

This means editing a file in `zane-lang/docs` updates the live site within the
CDN cache window — no rebuild or redeploy of this site is required.

Because the docs routes run on the server, the site uses the Astro Vercel
adapter. Everything else is still statically built.

### `GITHUB_TOKEN` (optional)

The sidebar listing is built from the GitHub tree API, which is rate-limited to
60 requests/hour for unauthenticated callers. Set a `GITHUB_TOKEN` environment
variable in the Vercel project to lift that limit. It is optional: without it
the docs still render, and the sidebar simply falls back to empty if the tree
API is unavailable.
