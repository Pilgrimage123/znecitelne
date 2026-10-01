# Znečitelně

Lokální anonymizace dokumentů pro české státní firmy a přípravu textu pro veřejnou AI.

## Canonical application

`znecitelne.html` is the canonical product implementation.

`index.html` is the generated web entry point and **must be byte-for-byte identical** to `znecitelne.html`. Do not develop the two files independently.

The canonical implementation is intentionally kept as a standalone HTML application. Its newer product behavior — including Quick mode, Fast-Approve, process analysis, publication profiles, richer detection rules, the guided movie tutorial, audit/changelog UI and local browser-library loading — is the reference behavior for the repository.

## Development

```bash
npm ci
npm run build
npm test
npm start
```

The server is only a static delivery layer. Document processing is performed in the browser.

## Updating the application

Edit `znecitelne.html` first.

Then run:

```bash
npm run build
npm test
```

The build copies the canonical application to `index.html`. CI fails if the two diverge.

## Important product invariant

Do not replace the newer standalone implementation with the older `index.html` implementation during refactors. New functionality should be added to the canonical implementation first, then extracted into modules only when the behavior is covered by regression tests.

## Current security/privacy direction

The application prefers local `./lib/*` browser dependencies. The canonical HTML still contains compatibility fallbacks for environments where those assets are unavailable; removing those fallbacks should be treated as a deliberate product/security change and verified against the offline distribution.

## Testing

The repository quality gate currently checks:

- canonical/entry-point parity
- presence of the current detector ruleset
- Quick mode
- Fast-Approve
- process analysis
- movie tutorial
- changelog
- local browser-library paths

The application's own browser self-tests remain part of the product and should be expanded with adversarial DOCX/PDF fixtures as the next testing step.
