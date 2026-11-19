# Publishing documentation on zane-lang.org

The website shows the documentation of several Zane repositories, one tab each.
Every one of them lays its pages out the same way, so a page reads the same on
GitHub and on the site, and adding a page is a change to its own repository
only.

| Tab | Route | Repository | Folder |
|---|---|---|---|
| Learn | `/docs` | [`docs`](https://github.com/zane-lang/docs) | `docs/` |
| Spec | `/spec` | [`spec`](https://github.com/zane-lang/spec) | `spec/` |
| Stories | `/stories` | [`spec`](https://github.com/zane-lang/spec) | `stories/` |
| Tools | `/tools` | [`zane`](https://github.com/zane-lang/zane) | `docs/` |
| Library | `/std` | [`std`](https://github.com/zane-lang/std) | `docs/` |
| Compiler | `/compiler` | [`compiler`](https://github.com/zane-lang/compiler) | `docs/` |

The list lives in [`src/lib/sources.mjs`](src/lib/sources.mjs).

## The layout

1. **Every folder has a `README.md`, its index.** GitHub shows it as the
   folder's page, and the site shows it at the folder's route (`docs/README.md`
   at `/docs`, `docs/tour/README.md` at `/docs/tour`).
2. **The index decides what is published, and in what order.** The sidebar
   lists the pages the index links, in the order it links them. A `##` heading
   in the index starts a sidebar group. A link to a subfolder's `README.md` (or
   to the subfolder itself) nests that folder, with its own index. A page that
   no index links is not published: a maintainer's notes can sit next to the
   reader pages without appearing on the site. A page linked twice is listed
   where it is first linked.
3. **A page's title is its first `#` heading.** There is no frontmatter. The
   sidebar drops words that every title in a tab starts with, so a tab whose
   pages are all called "Zane …" lists them without it.
4. **The first paragraph after the title describes the page.** Search results,
   link previews and the page's meta description show it, so keep it to one
   plain sentence about what the page holds.
5. **Links are ordinary relative Markdown links**, with GitHub's heading anchors
   (`memory.md#2-ownership-and-storage`). A link into another Zane repository
   uses its `main`-branch GitHub address,
   `https://github.com/zane-lang/<repo>/blob/main/<path>`. On the site, a link
   to a published page becomes that page's route, and a link to anything else
   (a source file, an unpublished page) goes to GitHub, so every link works in
   both places. A link pinned to a commit (`blob/<sha>/…`) always stays on
   GitHub, because it points at history.
6. **GitHub Markdown renders as on GitHub:** tables, alerts (`> [!NOTE]`,
   `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), `<details>` and other
   inline HTML. ` ```zane ` code blocks are highlighted with the site's Zane
   grammar.

A repository whose examples are compiled and run in CI marks each `zane` code
block as a whole program, a fragment or an expected error. That convention, and
the tool that checks it, are described in
[`zane-lang/docs`'s `CONTRIBUTING.md`](https://github.com/zane-lang/docs/blob/main/CONTRIBUTING.md).

## What the build checks

`npm run build` fetches every source folder first and stops when a folder has
no index or an index links a page that does not exist. Pages no index links
are listed as warnings. After building, it checks every link between pages,
including `#anchors`, and fails on any that is broken, naming the source file
it came from. Fix such a link in the repository that holds the page.

## Previewing a change to another repository

Point the site at a branch, or at your own checkout, before starting it:

```sh
ZANE_SPEC_REF=my-branch npm run dev
ZANE_SPEC_PATH=../spec npm run dev
```

`ZANE_<REPO>_REF` reads that branch or tag of the repository instead of `main`;
`ZANE_<REPO>_PATH` links a local checkout, so edits show up as you save them.
`<REPO>` is the repository's name in capitals: `DOCS`, `SPEC`, `ZANE`, `STD`,
`COMPILER`.

## Adding a tab

Add the repository and folder to [`src/lib/sources.mjs`](src/lib/sources.mjs),
give the folder an index, and add the repository to the table above.
