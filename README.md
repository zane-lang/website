# Zane website

The source of the Zane website, built with [Astro](https://astro.build/). Its
documentation pages come from the [`docs`](https://github.com/zane-lang/docs)
repository, included as a Git submodule.

> **Status:** not maintained at the moment (last changed in March 2026) and
> behind the current language. **Newcomers can skip this repository.** To
> learn and try Zane, start at [`zane-lang/zane`](https://github.com/zane-lang/zane).

## Running it locally

```sh
git clone --recurse-submodules https://github.com/zane-lang/website
cd website
npm install
npm run dev
```

`just ship` deploys it to production with the Vercel CLI.
