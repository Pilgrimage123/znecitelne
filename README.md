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

`npm run build` is a validation build: it checks the canonical application and required local browser assets. It does not generate a second HTML entry point.

The server is only a static delivery layer. Document processing is performed in the browser.

## Updating the application

Edit `znecitelne.html` first.

Then run:

```bash
npm run build
npm test
```

The build fails if an obsolete `index.html` appears or if required local runtime assets are missing. Populate the bundle with `bash scripts/download_libs.sh` before expecting the offline gate to pass.

## Important product invariant

Do not introduce a second HTML application during refactors. New functionality belongs in the canonical implementation first, then extracted into modules only when the behavior is covered by regression tests.

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
