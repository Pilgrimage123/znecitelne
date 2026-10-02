# Canonical implementation upgrade

This repository has one canonical browser application:

- `znecitelne.html` is the source of truth.
- `index.html` is obsolete and must not exist.
- `npm run build` validates the canonical application and its runtime assets.
- `npm test` validates repository invariants.
- GitHub Actions runs the same quality gates.

## Apply

Run:

```bash
npm run build
npm test
```

Then review:

```bash
git diff -- znecitelne.html build.js test.js package.json README.md .github/workflows/quality.yml
```

Do not create or commit `index.html`.

Do not maintain a second browser implementation.

## Canonical rule

All application behavior changes belong in:

`znecitelne.html`

Supporting runtime libraries belong under:

`lib/`

Server behavior belongs in:

`server.js`

Build validation belongs in:

`build.js`

Repository quality checks belong in:

`test.js`

This removes the stale “generated entry point” model documented by the prior upgrade guide.
