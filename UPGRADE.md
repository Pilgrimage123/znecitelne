# Canonical implementation upgrade

This repository has one application implementation.

1. `znecitelne.html` remains canonical.
2. `index.html` must not be created or committed.
3. `npm run build` validates the canonical application and required local browser assets.
4. `npm test` prevents accidental divergence and catches duplicate resolver definitions.
5. GitHub Actions should run the build and quality gate once the offline `lib/` bundle is present.

## Apply

Run:

```bash
npm run build
npm test
```

The canonical application is served directly by `server.js`:

- `/` → `znecitelne.html`
- `/znecitelne.html` → `znecitelne.html`
- `/index.html` → HTTP 308 redirect to `/`

Do not manually create an `index.html` copy. There must never be two application implementations.

## Offline bundle

The canonical HTML references browser libraries under `./lib/`. A clean checkout must contain every asset required by the build gate before it can be called a complete offline distribution.

The CDN fallbacks in the browser are compatibility fallbacks, not part of the offline guarantee. If an offline distribution is being prepared, verify the complete `lib/` bundle before release.
