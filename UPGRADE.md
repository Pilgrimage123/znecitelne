# Canonical implementation upgrade

This repository has two generations of the application.

The newer `znecitelne.html` is the source of truth for behavior. This upgrade makes that relationship explicit:

1. `znecitelne.html` remains canonical.
2. `index.html` is generated from it.
3. `npm run build` synchronizes the entry point.
4. `npm test` prevents accidental divergence.
5. GitHub Actions runs the build and quality gate.

## Apply

Run:

```bash
npm run build
npm test
```

Then commit the resulting `index.html` together with:

- `build.js`
- `test.js`
- `.github/workflows/quality.yml`
- `README.md`

Do not manually maintain different implementations in `index.html` and `znecitelne.html`.
