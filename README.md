# The Zane Website

The documentation is shallow-cloned from [`zane-lang/docs`](https://github.com/zane-lang/docs)
before starting the development server or building the site. To refresh it manually, run:

```sh
npm run sync:docs
```

Set `ZANE_DOCS_REF` to clone a branch or tag other than `main`. The clone's `.git`
directory is removed after fetching, and the downloaded documentation is ignored by Git.
