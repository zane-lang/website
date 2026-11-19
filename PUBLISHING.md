# Publishing documentation on zane-lang.org

The website shows the documentation of several Zane repositories, with one tab
per repository. Every one of these repositories lays out its pages the same
way, so a page reads the same on GitHub and on the site, and adding a page
changes only the repository that holds the page.

| Tab | Route | Repository | Folder |
|---|---|---|---|
| Learn | `/docs` | [`docs`](https://github.com/zane-lang/docs) | `docs/` |
| Spec | `/spec` | [`spec`](https://github.com/zane-lang/spec) | `spec/` |
| Stories | `/stories` | [`spec`](https://github.com/zane-lang/spec) | `stories/` |
| Tools | `/tools` | [`zane`](https://github.com/zane-lang/zane) | `docs/` |
| Library | `/std` | [`std`](https://github.com/zane-lang/std) | `docs/` |
| Compiler | `/compiler` | [`compiler`](https://github.com/zane-lang/compiler) | `docs/` |

[`src/lib/sources.mjs`](src/lib/sources.mjs) holds this list of tabs.

## The layout

1. **Every folder has a `README.md`, the folder's index page.** GitHub shows
   the index page as the folder's page, and the site shows the index page at
   the folder's route (`docs/README.md`
   at `/docs`, `docs/tour/README.md` at `/docs/tour`).
2. **The index pages set which pages are published, and in what order.** The
   sidebar lists the pages that an index page links to, in the order of the
   links. A `##` heading in an index page starts a sidebar group. A link to a
   subfolder's `README.md` (or to the subfolder itself) nests that subfolder in
   the sidebar, with the subfolder's own index page. A page that no index page
   links to is not published, so a maintainer's notes can sit next to the
   reader pages without appearing on the site. A page linked twice is listed
   at its first link.
3. **A page's title is its first `#` heading.** Pages have no frontmatter. The
   sidebar drops the leading words that every title in a tab shares, so a tab
   whose page titles all start with "Zane" lists the titles without "Zane".
4. **The first paragraph after the title describes the page.** Search results,
   link previews and the page's meta description show that paragraph, so keep
   it to one plain sentence about the page's content.
5. **Links are ordinary relative Markdown links**, with GitHub's heading anchors
   (`memory.md#2-ownership-and-storage`). A link into another Zane repository
   uses the file's GitHub address on the `main` branch,
   `https://github.com/zane-lang/<repo>/blob/main/<path>`. On the site, a link
   to a published page is rewritten to that page's route, and a link to any
   other file (a source file, an unpublished page) goes to GitHub, so every
   link works on both GitHub and the site. A link pinned to a commit
   (`blob/<sha>/…`) always goes to GitHub, because it points at an old version
   of the file.
6. **GitHub Markdown renders the same as on GitHub:** tables, alerts (`> [!NOTE]`,
   `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), `<details>` and other
   inline HTML. ` ```zane ` code blocks are highlighted with the site's Zane
   grammar.

A repository whose examples are compiled and run in CI marks each `zane` code
block as a whole program, a fragment or an expected error. The fence
convention and the tool that checks the examples are described in
[`zane-lang/docs`'s `CONTRIBUTING.md`](https://github.com/zane-lang/docs/blob/main/CONTRIBUTING.md).

## What the build checks

`npm run build` first fetches every source folder, and stops when a folder has
no index page or an index page links to a page that does not exist. Pages that
no index page links to are listed as warnings. After building, `npm run build`
checks every link between pages, including `#anchors`, and fails on any broken
link, naming the source file that contains the link. Fix a broken link in the
repository that holds the page.

## Previewing a change to another repository

Before starting the site, point it at a branch or at your own checkout:

```sh
ZANE_SPEC_REF=my-branch npm run dev
ZANE_SPEC_PATH=../spec npm run dev
```

`ZANE_<REPO>_REF` makes the site read the named branch or tag of the repository
instead of `main`. `ZANE_<REPO>_PATH` links a local checkout, so your edits
show up when you save them. `<REPO>` is the repository's name in capitals:
`DOCS`, `SPEC`, `ZANE`, `STD`, `COMPILER`. The site resolves a page's links
when it renders the page, so after adding or removing a page, restart
`npm run dev` to update the links that point at that page.

## Adding a tab

Add the repository and folder to [`src/lib/sources.mjs`](src/lib/sources.mjs),
give the folder an index page, and add the repository to the table above.
