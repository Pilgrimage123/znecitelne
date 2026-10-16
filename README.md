# Znečitelně

Lokální anonymizace dokumentů pro české státní firmy a přípravu textu pro veřejnou AI.

## Canonical application

`znecitelne.html` is the canonical product implementation.

There is intentionally no second application entry point. `znecitelne.html` is served directly by the Node server:

- `/` → `znecitelne.html`
- `/znecitelne.html` → `znecitelne.html`
- `/index.html` → permanent redirect to `/` for old bookmarks

Do not recreate `index.html`. The canonical implementation is the only application source.

The canonical implementation is intentionally kept as a standalone HTML application. Its newer product behavior — including Quick mode, Fast-Approve, process analysis, publication profiles, richer detection rules, the guided movie tutorial, audit/changelog UI and local browser-library loading — is the reference behavior for the repository.

## Development

```bash
npm install
npm run build
npm test
npm start
```

Primary development takes place in modular ES code in `src/` (`src/core/`, `src/formats/`, `src/crypto/`, `src/ui/`, `src/worker/` and `src/template.html`).

`npm run build` deterministically compiles `src/` into the standalone canonical distribution file `znecitelne.html` without external bundlers, preserving offline zero-network execution on `file:///`, and validates all runtime markers and assets.

The server is only a static delivery layer. Document processing is performed entirely in the browser.

## Updating the application

Make changes in the corresponding ES modules in `src/` (or `src/template.html` for markup/styles).

Then build and verify:

```bash
npm run build
npm test
```

The build compiles `znecitelne.html` and verifies that all required markers, modules, and local assets in `./lib/` are present. Do not recreate `index.html` or edit `znecitelne.html` manually.

## Current security/privacy direction

The application prefers local `./lib/*` browser dependencies. The canonical HTML still contains compatibility fallbacks for environments where those assets are unavailable; removing those fallbacks should be treated as a deliberate product/security change and verified against the offline distribution.

## Testing

The repository quality gate currently checks:

- canonical application structure
- presence of the current detector ruleset
- Quick mode
- Fast-Approve
- process analysis
- movie tutorial
- changelog
- local browser-library paths and runtime assets
- absence of the obsolete HTML entry point

The application's own browser self-tests remain part of the product and should be expanded with adversarial DOCX/PDF fixtures as the next testing step.

The repository does not currently commit `package-lock.json`; use `npm install` rather than `npm ci` until a lockfile is deliberately added.
