# Zane website

The source of the Zane website, built with [Astro](https://astro.build/). Its
documentation pages come from the [`docs`](https://github.com/zane-lang/docs)
repository, included as a Git submodule.

> **Status:** not maintained at the moment (the site was last changed in March 2026) and
> behind the current language. **Newcomers can skip this repository.** To
> learn and try Zane, start at [`zane-lang/zane`](https://github.com/zane-lang/zane).

## Running it locally

You need Node.js 22.12 or newer.

```sh
git clone --recurse-submodules https://github.com/zane-lang/website
cd website
npm install
npm run dev
```

In a clone made without `--recurse-submodules`, fetch the docs with
`git submodule update --init --recursive` first.

`just ship` deploys it to production, using [`just`](https://github.com/casey/just)
and the [Vercel CLI](https://vercel.com/docs/cli). It first moves the docs
submodule to the newest commit of its branch, discarding uncommitted changes
there, so commit or stash those before deploying.
