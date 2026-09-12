# Grammalecte for Obsidian

## What this is

An Obsidian community plugin that checks French grammar and spelling with
[Grammalecte](https://grammalecte.net). Source in `src/`, bundled to `main.js`
by esbuild.

## Tooling

- Package manager: **pnpm** (`pnpm install`, `pnpm run build`, `pnpm run lint`, `pnpm run test`).
- `pnpm run build` type-checks with `tsc -noEmit` then bundles with esbuild.
- Lint uses `eslint-plugin-obsidianmd`; the `engine/` folder is ignored.
- Tests use vitest. `tests/stubs/obsidian.ts` stands in for the Obsidian API
  (aliased in `vitest.config.ts`).

## Layout

```
src/
  main.ts              plugin lifecycle, commands, status bar
  checker.ts           owns the provider, turns editor text into issues
  settings.ts          settings shape and defaults
  markdown.ts          blanks Markdown syntax while preserving offsets
  types.ts             Issue shape and Grammalecte raw error conversion
  providers/
    server.ts          local or remote grammalecte-server.py over requestUrl
    js.ts              the bundled JavaScript engine
  engine/
    files.ts           engine file list and install location
    glue.ts            the code appended to the engine sources, plus the worker bootstrap
    runner.ts          worker lifecycle and request/response plumbing
    installer.ts       downloads the official add-on and extracts the engine
  editor/
    extension.ts       CodeMirror 6 state field, decorations and click handling
    menu.ts            the correction menu
  ui/settingsTab.ts    settings UI
```

## Things worth knowing

- Grammalecte splits text into paragraphs on `\n` and reports offsets relative
  to each paragraph; `paragraphOffsets`/`toIssue` in `src/types.ts` map them back
  onto the document. Any change there needs the offset tests to stay green.
- Markdown masking replaces syntax with spaces so offsets never shift.
- The engine is a set of classic scripts. They are concatenated with
  `ENGINE_GLUE` and evaluated in one function scope where `process` and
  `require` are shadowed, which forces the engine's browser code path inside
  Electron. `helpers.loadFile` is replaced so data files come from strings the
  main thread reads out of the vault.
- The engine is never committed: it is downloaded into `engine/` at runtime and
  git-ignored.
- Results are dropped if the document changed while a check was in flight,
  because the offsets would be stale.
