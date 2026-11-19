# Zane website

The source of <https://zane-lang.org>, built with [Astro](https://astro.build/).
It publishes the documentation of the Zane repositories in one place, one tab
each: the Learn pages from [`docs`](https://github.com/zane-lang/docs), the
specification and its design stories from
[`spec`](https://github.com/zane-lang/spec), and the documents of
[`zane`](https://github.com/zane-lang/zane),
[`std`](https://github.com/zane-lang/std) and
[`compiler`](https://github.com/zane-lang/compiler). Those repositories are
downloaded when the site builds, so a page is changed in the repository that
holds it. How a repository lays its pages out for the site is in
[`PUBLISHING.md`](PUBLISHING.md).

## Running it locally

You need Node.js 22.23.4 or newer, and Git.

```sh
git clone https://github.com/zane-lang/website
cd website
npm install
npm run dev
```

`npm run dev` downloads the documentation folders into `src/content/repos/` (one
shallow, sparse clone per repository) on its first run and reuses them
afterwards; `npm run fetch` (or `just fetch`) refreshes them. To preview a
branch or a local checkout of one of them, see
[`PUBLISHING.md`](PUBLISHING.md#previewing-a-change-to-another-repository).

`npm run build` always downloads a fresh copy, builds the site into `dist/`,
indexes it for search with [Pagefind](https://pagefind.app/), and checks every
link between pages. `npm run preview` serves the result; search works there,
not in `npm run dev`. `npm test` runs the unit tests of the build scripts.

## How it is put together

| Path | What it does |
|---|---|
| `src/lib/sources.mjs` | The tabs: which repository and folder each one shows |
| `scripts/fetch-sources.mjs` | Downloads those folders, and reports pages no index lists |
| `src/lib/site-map.mjs` | Reads each folder's index into the sidebar tree and the page routes |
| `src/plugins/zane-docs.mjs` | Points links at site routes (`src/lib/links.mjs`) and renders GitHub alerts |
| `src/pages/[...slug].astro` | Every documentation page, in `src/layouts/DocsLayout.astro` |
| `scripts/check-links.mjs` | Checks every internal link and anchor in `dist/` after a build |

The home page's code sample is the first example in the `zane` README, so it
always shows what the README shows.

## Styling and code highlighting

Code blocks marked ` ```zane ` are highlighted with
[`src/syntax/zane.tmLanguage.json`](src/syntax/zane.tmLanguage.json), a
TextMate grammar whose keywords follow the compiler's generated
`editors/typst/Zane.sublime-syntax`; update it when the lexicon changes. Code
colours, like the rest of the palette (maroon `#653f3f` and gold `#d5aa41`, from
the [logo](https://github.com/zane-lang/logos)), are tokens in
[`src/styles/global.scss`](src/styles/global.scss).

## Deploying

`just ship` deploys it to production, using [`just`](https://github.com/casey/just)
and the [Vercel CLI](https://vercel.com/docs/cli). The production build fetches
the newest documentation itself: `vercel.json` sets its build command to
`npm run build`. A broken link in any of the source repositories fails that
build, so [CI](.github/workflows/build.yml) also builds the site every day and
on every pull request.
