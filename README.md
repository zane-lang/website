# Zane website

The source of <https://zane-lang.org>, built with [Astro](https://astro.build/).
The site publishes the documentation of the Zane repositories in one place,
with one tab per repository: the Learn pages from [`docs`](https://github.com/zane-lang/docs), the
specification and its design stories from
[`spec`](https://github.com/zane-lang/spec), and the documents of
[`zane`](https://github.com/zane-lang/zane),
[`std`](https://github.com/zane-lang/std) and
[`compiler`](https://github.com/zane-lang/compiler). The site's build
downloads those repositories, so to change a page you edit it in the
repository that holds it, not here.
[`PUBLISHING.md`](PUBLISHING.md) describes how a repository lays out its
pages for the site.

## Running it locally

You need Node.js 22.23.4 or newer, and Git.

```sh
git clone https://github.com/zane-lang/website
cd website
npm install
npm run dev
```

On its first run, `npm run dev` downloads the documentation folders into
`src/content/repos/`, with one shallow, sparse clone per repository, and later
runs reuse those folders. `npm run fetch` (or `just fetch`) downloads them
again. To preview a branch or a local checkout of one of the repositories, see
[`PUBLISHING.md`](PUBLISHING.md#previewing-a-change-to-another-repository).

`npm run build` always downloads a fresh copy, builds the site into `dist/`,
indexes it for search with [Pagefind](https://pagefind.app/), and checks every
link between pages. `npm run preview` serves the built site. Search works only
in `npm run preview`, not in `npm run dev`. `npm test` runs the unit tests of
the build scripts.

## Where the code lives

| Path | What it does |
|---|---|
| `src/lib/sources.mjs` | The tabs: which repository and folder each one shows |
| `scripts/fetch-sources.mjs` | Downloads those folders, and reports pages that no index page links to |
| `src/lib/site-map.mjs` | Reads each folder's index into the sidebar tree and the page routes |
| `src/plugins/zane-docs.mjs` | Rewrites links to point at site routes (`src/lib/links.mjs`) and renders GitHub alerts |
| `src/pages/[...slug].astro` | Renders every documentation page, using the layout `src/layouts/DocsLayout.astro` |
| `scripts/check-links.mjs` | Checks every internal link and anchor in `dist/` after a build |

The code sample on the home page is the first example in the `zane` README, so
the home page and the README always show the same example.

## Styling and code highlighting

Code blocks marked ` ```zane ` are highlighted with
[`src/syntax/zane.tmLanguage.json`](src/syntax/zane.tmLanguage.json), a
TextMate grammar whose keywords match the compiler's generated
`editors/typst/Zane.sublime-syntax`. Update the grammar when the language's
keywords change. The code colours, like the rest of the palette (maroon `#653f3f` and gold `#d5aa41`, from
the [logo](https://github.com/zane-lang/logos)), are tokens in
[`src/styles/global.scss`](src/styles/global.scss).

## Deploying

`just ship` deploys the site to production, using
[`just`](https://github.com/casey/just) and the
[Vercel CLI](https://vercel.com/docs/cli). The production build downloads the
newest documentation, because `vercel.json` sets the build command to
`npm run build`. A broken link in any of the source repositories fails the
production build, so [CI](.github/workflows/build.yml) also builds the site
every day and on every pull request, to find such links early.
