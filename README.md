# FitTracker Pro PWA

Deploy-ready static PWA package.

## Structure
- `index.html`
- `styles/main.css`
- `scripts/app.js`
- `manifest.json`
- `service-worker.js`
- `offline.html`
- `icons/`

## Local preview
Use any static server. Example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Vercel deploy
1. Create a GitHub repo and upload these files.
2. Import the repo into Vercel.
3. Framework preset: **Other**
4. Build command: leave empty
5. Output directory: leave empty

## Notes
- `manifest.json` now uses `/?source=pwa` as `start_url`.
- `service-worker.js` includes runtime cache pruning.
- CSS and JS were separated from `index.html` for easier maintenance.
