# Contributing a reader

A reader is a ~30-line module in `src/readers/`:

- `parse(content, from = 0)` (pure): returns `{ turns: [{role, text}], lines, cwd }`.
- `read(file, from)` (after the `// --- node-only ---` marker): reads the file and calls `parse`.
- Register it and its `locate(id, {home})` in `src/readers/index.js`.

Add a fixture under `test/fixtures/home/` and a case in `test/readers.test.js`. Keep `parse` free of `node:` imports: the playground bundles it.
