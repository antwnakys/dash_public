# unidash

A calm dashboard for college: classes, timetable, deadlines and grades, tasks, exams with study plans, your calendar and the weather.
It runs as a website: https://antwnakys.github.io/dash_public/

The first time you open it, a short setup asks your name, where you study, where you live and how you get there.
Every question can be skipped and changed later in Settings.

## Your data

Everything you add stays on your device (browser storage). When Google sign-in is switched on, signing in also keeps a
copy in a private app folder in **your own** Google Drive, so your devices stay in sync. There is no unidash server.

Weather comes from [Open-Meteo](https://open-meteo.com), addresses are looked up with
[OpenStreetMap Nominatim](https://nominatim.org) when you save them. Both are free and need no account.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # must pass before pushing
npm run lint
```

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
