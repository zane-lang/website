# Zane website

The source of the Zane website, built with [Astro](https://astro.build/). Its
documentation pages come from the [`docs`](https://github.com/zane-lang/docs)
repository, which is shallow-cloned into `src/content/docs` (ignored by Git) when
the site starts or builds.

> **Status:** not maintained at the moment (the site was last changed in March 2026) and
> behind the current language. **Newcomers can skip this repository.** To
> learn and try Zane, start at [`zane-lang/zane`](https://github.com/zane-lang/zane).

## Running it locally

You need Node.js 22.23.4 or newer, and Git.

```sh
git clone https://github.com/zane-lang/website
cd website
npm install
npm run dev
```

`npm run dev` downloads the docs on its first run and reuses them afterwards.
`npm run build` always downloads a fresh copy. To refresh them by hand, run
`npm run sync:docs` (or `just docs`). Set `ZANE_DOCS_REF` to use a branch or tag
of `docs` other than `main`.

A clone from before the docs were fetched this way still has the old submodule
checkout in `src/content/docs`. Save any changes made there, delete the folder,
and the next `npm run dev` downloads the docs.

`just ship` deploys it to production, using [`just`](https://github.com/casey/just)
and the [Vercel CLI](https://vercel.com/docs/cli). The production build fetches
the newest docs itself: `vercel.json` sets its build command to `npm run build`, so
the `prebuild` step runs.
