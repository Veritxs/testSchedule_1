# WaktuKu

A private, installable timetable for iPhone. WaktuKu imports campus schedule screenshots, supports recurring LEC/LAB classes and one-time GSLC classes, and highlights free time.

## Schedule rules

- **LEC:** weekly, up to 13 academic sessions
- **LAB:** every two weeks, up to 6 academic sessions
- **GSLC:** one-time schedule

Imported screenshots are processed in the browser with local OCR and presented for review before saving. Schedule data stays in the browser's local storage; there is no account or backend.

## Use on iPhone

1. Open the deployed WaktuKu URL in Safari.
2. Tap **Share**.
3. Choose **Add to Home Screen**.
4. Open WaktuKu from the Home Screen.

Removing Safari website data or deleting browser storage will remove saved schedules, so keep the original campus screenshots as a backup.

## Development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The production site is written to `docs/` for GitHub Pages.
