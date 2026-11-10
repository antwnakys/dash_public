# dash_public: project memory

Notes for Claude sessions on this repo. Read this first, and update it at the end of any session that changes how
the app works or what's planned.

## What this is

A public version of **dash**, a college dashboard (courses, deadlines, tasks, exams, calendar and weather) that any
student can set up for themselves.

It starts from Antonis's personal app, **antwnakys/dash**, which is private to him and full of his own details (his
campus, his commute, his trains). That repo stays his and is **not** changed for this one. This repo is a separate,
general version: same look and ideas, nothing hard-coded about one person.

- Owner: Antonis (GitHub `antwnakys`), a student in Athens, Greece.
- Source to copy from: `antwnakys/dash` at commit `1c497a7` (Nov 4, 2026: website, iPhone app, Mac app with menu bar).
  Its `CLAUDE.md` is a detailed code map of every feature; read it before porting a feature. If this session can't see
  that repo, attach it with `add_repo` (read access).

## How the owner likes to work

- Explain things simply, with no jargon; he is not a professional developer.
- Ask **one question at a time** and give options to pick from. Don't stack questions.
- Don't send him digging through Settings screens (his or Apple's/Google's); if a manual step is unavoidable, give the
  shortest exact path and say plainly that it's needed and why.
- Tell him "build OK" when a GitHub build has finished (and say plainly if it failed or was cancelled).
- Work on a branch, open a PR, and merge to `main` when it's ready (he likes this flow).
- Tell him plainly when something needs **him** to do it (Google Cloud, Apple, payments, domain).

## Product direction (agreed Nov 5, 2026)

1. **Website first, free.** Ship as a website on GitHub Pages (https://antwnakys.github.io/dash_public/) for a few
   classmates. No Apple account or app stores yet.
2. **Setup on first open (onboarding)** replaces everything personal in the original: "What's your name? Where's your
   school (address)? Where do you live? How do you get there? Do you have a monthly transport pass?" Everything can be
   skipped and changed later in Settings.
3. **Google sign-in for calendar + sync**, in a **new Google Cloud project** (not the personal one). Until Google verifies
   the app, only test users (max 100, added by Antonis) can sign in, and their sign-in expires every 7 days. That's fine
   for the classmates phase.
4. Then, only if people use it: Google verification → iPhone app (App Store, paid Apple developer account ~€99/yr) →
   Mac app (Developer ID + notarization, same account; no Terminal step for users).

Data stays **local-first**: on the device plus the user's **own** Google Drive app-data folder (scope `drive.appdata`).
There is no dash server and no database of users. Keep it that way; it keeps privacy simple and costs at zero.

## What to copy as-is (generic already)

Look and feel (Apple-style light/dark, tokens in `src/index.css`, SF Pro/Inter), app shell (sidebar, tab bar, bottom-sheet
editors), courses with weekly times, timetable, deadlines with grades and averages, tasks with due dates, calendar view and
agenda ("Up next"), exams tab and study plans, weather (Open-Meteo), iCal parser (`lib/ics.ts`), Google Calendar reading,
Drive app-data sync (`src/sync/`), online-lesson links (Teams/Zoom/Meet detection in `lib/meeting.ts`), the intro, toasts.

## What must become settings or be removed

Everything below is hard-coded for Antonis in `antwnakys/dash`. Each needs a setting (filled in during setup) or removal.

| Original (antwnakys/dash) | Hard-coded | In dash_public |
| --- | --- | --- |
| `src/lib/campus.ts` | `CAMPUS = 'Sorou 74, Marousi'` and Sorou/Σωρού regexes; events there count as classes | `profile.school` = { name, address, lat/lon }. "At school" = an event location that fuzzy-matches the saved address (normalise accents/case, street + number), not a fixed regex |
| `src/lib/commute.ts`, `LeaveCard.tsx` | Home Argyroupoli + campus Marousi coordinates, his metro/suburban route text, `TO_TRAIN`/`TRAIN_RIDE`/`FROM_STATION` minutes, default suburban train times | `profile.home` (place), `profile.commute` = { minutes, mode: transit/car/walk/bike, optional fixed departures list }. Start with a simple "door to door: N minutes" and optional departure times; no Athens-specific route text |
| `src/lib/tripWeather.ts`, `src/data/weather.ts` | `Europe/Athens` time zone; place names Argyroupoli/Marousi | Device time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and the saved place names |
| `src/lib/metroCard.ts`, `MetroCardCard.tsx` | Pass expires on the 3rd; Athens wording | Optional "transport pass renews on day N" in setup; off by default |
| `src/lib/appExpiry.ts`, `AppExpiryCard.tsx`, `DashAppPlugin` | Free-Apple-ID 7-day signing reminder, a message about his Mac | **Remove** (public apps are signed properly) |
| `src/lib/liveUpdate.ts`, Mac `launcher/index.html`, `capabilities/default.json` | `https://antwnakys.github.io/dash/` | The new site URL, from one constant in `src/config.ts` |
| `src/config.ts` | His Google OAuth client IDs (project "dash") | New Google Cloud project's client IDs |
| `capacitor.config.ts`, `src-tauri/tauri.conf.json` | Bundle id `com.antwnakys.dash`, his Apple team `WDTXV8PP35` | New id (e.g. `com.antwnakys.dashpublic`; final name TBD); no team until there's a paid account |
| `src/lib/exams.ts`, `ExamForm.tsx` | Examples "ΣΗΜΑΤΑ", Greek exam words | Keep the accent/case-insensitive exam detection with English + Greek words ("exam", "final", "midterm", "εξέταση"), and generic placeholders |
| `SettingsForm.tsx`, `CampusClasses.tsx`, `Timetable.tsx` text | Mentions of Doukissis Plakentias, Pentelis, Sorou 74 | Use the saved school/home names |
| `src/types/index.ts` `Profile` | `suburbanTrains`, `commuteMinutes`, `reminders.metroCard/appExpiry` | New `Profile` fields: `school`, `home`, `commute`, `pass`, `onboarded`. All optional (sync safety) |
| `CLAUDE.md` history | His Teams link, his calendar events | Not copied |

Also: start with **empty data** (no sample courses with his subjects), English UI first with Greek as the second language
later (the original is English-only with Greek data).

## Suggested first steps (1–3 done Nov 5)

1. **Bootstrap**: copy the source tree from `antwnakys/dash@1c497a7` (without `.git`, `ios/`, `src-tauri/` and personal
   assets for now), rename the app in `package.json`, `index.html`, `public/manifest.webmanifest`, and set Vite `base`
   for `/dash_public/`. Add `.github/workflows/deploy.yml` (Pages). Make `npm run build` pass.
2. **Remove the personal parts** listed above, behind the new `Profile` fields, with sensible empty states
   ("Add your school to get a Leave-by time").
3. **Onboarding**: a short full-screen setup on first open (name → school → home → how you get there → pass), each step
   skippable, all editable later in Settings. Keep it calm and one question per screen.
4. **Google**: Antonis creates a new Google Cloud project, consent screen in Testing, Calendar + Drive APIs on, a Web
   client with the Pages origin, and adds classmates as test users. Claude writes him exact, short steps when it's time.
5. **Share with classmates** and collect feedback before any app-store work.

Later, when going wider: privacy policy page (what's read, that data stays on the device and in the user's own Drive,
how to delete it), Google verification (sensitive scope `calendar.readonly`: privacy policy URL, demo video, a few weeks),
then App Store and Mac signing.

## Stack and commands (same as the original)

React 19, TypeScript 7, Vite 8, Tailwind 4, framer-motion, lucide-react; later Capacitor 8 (iPhone) and Tauri 2 (Mac).

```bash
npm ci
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build; must pass before pushing
npm run lint       # oxlint
```

No test suite. Verify with `tsc -b`, `oxlint`, `npm run build`, and by driving the built site in Playwright with an
iPhone viewport (`vite preview`).

## Lessons carried over from antwnakys/dash

- Google blocks sign-in inside app web views ("disallowed_useragent"). On iPhone use native Google Sign-In; on Mac, sign in
  through the default browser with PKCE on the **iOS client ID** and the reversed-client-ID URL scheme (Google's loopback
  redirect is blocked for iOS clients). Details in the original's `src/data/googleMac.ts`.
- Google Drive's app-data folder is shared by every client in the same Cloud project, so web, iPhone and Mac sync together.
- New fields on synced records must be optional so older app versions keep working.
- GitHub sometimes cancels macOS builds for lack of runners; re-run them.
- Open-Meteo and some sites are blocked from Claude's cloud sandbox; mock them in tests.

## What's built (code map of the public changes)

The public app is called **unidash** (picked by Antonis on Nov 5). Copied from `antwnakys/dash@1c497a7`; everything
not listed here works as described in the original's `CLAUDE.md`.

- **Storage keys** are `unidash.*` (not `dash.*`): both apps live on `antwnakys.github.io`, so browsers would otherwise
  share their saved data. Drive sync file: `unidash-data.json`.
- `src/types/index.ts` `Profile`: `school` {name, address, place}, `home` (Place), `commute` {minutes, mode, departures,
  toStop}, `pass` {renewDay}, `onboarded`, `reminders` {leave, deadlines, pass}. All optional. `autoLocation` now means
  off when missing (no location prompt on first open); weather uses device location → `place` → `home`.
- `src/lib/school.ts` (was campus.ts): `atSchool(location, school)` matches the saved address: Greek is written in
  Latin letters (`placeKey`), then the street words + house number must appear (or street + area when there's no
  number), or the school's name. `isClass(e, school)`, `schoolLabel`, `isExamTitle` (English + Greek), `matchCourse`.
- `src/lib/commute.ts`: `planTrip` = door-to-door minutes, or the latest saved departure (bus/train time) that arrives
  5 min early (`toStop` = home → stop). `nextDeparture` returns a class even with no travel time, so `LeaveCard` can say
  "Add how long it takes to get to …".
- `src/lib/pass.ts` + `components/commute/PassCard.tsx`: optional monthly pass; Today card on the day before and the
  day itself, reminder at 10:00 the day before (apps only).
- `src/lib/tripWeather.ts`, `data/weather.ts`: device time zone (`TIME_ZONE`), saved home/school place names.
  `searchAddress` uses OpenStreetMap Nominatim (falls back to Open-Meteo city search) when an address is saved.
- `src/components/onboarding/Onboarding.tsx`: full-screen setup shown by `AppShell` while `!profile.onboarded`:
  welcome (optional "sign in with Google" when configured) → name → school → home → how (transit/car/walk/bike) →
  minutes → pass (transit only) → done. Every step skippable. Settings → About → "Run setup again".
- Settings: "You" (name, school, school address, where you live, location toggle, weather city) and "Getting to
  school" (mode, door to door, bus/train times, time to the stop, travel pass). Reminders section hidden on the web;
  iCal-link section only in a native app.
- `src/config.ts`: `SITE_URL` and the Google client IDs. Web client ID set (Cloud project "unidash", Testing mode,
  origin `https://antwnakys.github.io`, redirect `https://antwnakys.github.io/dash_public/`, Calendar + Drive APIs on).
  iOS client ID empty until there's an iPhone app (Google buttons hide when the ID for the platform is empty).
- Removed: app-expiry (free Apple ID), metro card, suburban trains, Athens route text, Mac/iPhone build files.
  The JS for the iPhone/Mac apps (`liveUpdate`, `macApp`, `googleMac`, reminders) is kept for later; it does nothing on the web.
- `.github/workflows/check.yml` builds and lints every pull request; `deploy.yml` deploys `main` to Pages.
- **Languages** (`src/i18n/`): 16 languages: en (source, `en.ts`), el, es, fr, de, it, pt, ru, tr, zh, ja, ko, hi, id,
  ar and ur (right-to-left). `t('key', {vars})` / `tn('key', n)` (plurals via `Intl.PluralRules`: `key_one`, `key_few`,
  `key_many`, `key_other`; a missing form falls back to `_other`, a missing key to English). The language is picked once per
  page load (saved choice `unidash.lang.v1` → device languages → English); Settings → Appearance → Language saves and
  **reloads**. `main.tsx` awaits `loadLanguage()` before importing the app (`boot.tsx`), so top-level `t()` calls are
  safe. Dates, times and numbers use `locale` (the device's full tag when the language matches); "in 3 days" etc. come
  from `Intl.RelativeTimeFormat` (`lib/date.ts`: `countdown`, `since`, `inDays`), durations from `minutesLabel`.
  **To add or change text**: add the key to `src/i18n/en.ts` and to every `src/i18n/locales/xx.ts`, then
  `npm run i18n:check` (also runs on every pull request; it flags missing keys and broken `{placeholders}`).
  Don't match on error *message text* (it's translated); use error classes or flags (`GoogleTimeoutError`, `denied`).
  RTL: use logical classes (`ps-`/`pe-`/`ms-`/`me-`/`start-`/`end-`/`text-start`/`border-s`), never `pl-`/`left-`;
  sideways animations multiply by `ltr` from `lib/motion.ts`; chevrons flip via CSS in `index.css`.
  Translations were written by Claude (Nov 9); native speakers should review the ones no classmate speaks.
- **Privacy policy**: `privacy.html` (second Vite entry, `src/privacy/`), public at `/dash_public/privacy.html`, in every
  language, with Google's Limited Use statement. Linked from Settings → About and the setup's welcome screen. Contact is
  GitHub issues for now (no email published). Bump `UPDATED` in `PrivacyPage.tsx` whenever the text changes.
- **Offline + Home Screen** (Nov 9): `build/serviceWorker.ts` (Vite plugin) writes `dist/sw.js` with the build's files
  (language chunks excluded; saved on first use). Pages: network first with a 3 s limit, then the saved copy; hashed
  files: saved copy first. One cache per build (`unidash-<sha>`), old ones deleted. Matches use `ignoreVary` (otherwise
  module-script requests never match). `src/lib/install.ts` registers it in browsers only (not native/Mac), even if the
  page already loaded (the app starts after the language file). `components/commute/InstallCard.tsx` on Today (phones in
  a browser tab, not installed, until dismissed): iPhone gets the Share → Add to Home Screen steps, Chrome/Edge on
  Android a one-tap Install (`beforeinstallprompt`), others the browser-menu hint.
- **Feedback** (Settings → Feedback): opens a mail to `FEEDBACK_EMAIL` (`src/config.ts`, empty on purpose: Antonis chose GitHub issues on Nov 9, no email published) or, while empty,
  a new GitHub issue on `FEEDBACK_REPO`, with version, language and device appended (`lib/wipe.ts` `feedbackDetails`).
- **Delete all data** (Settings → Data, `lib/wipe.ts` `deleteEverything`): signed in → disconnect Google (stops sync),
  delete the Drive app-data file, revoke the token; if Drive can't be reached nothing is deleted. Then every
  `unidash.*` key is removed and the app reloads into first-open setup.
- **Exam results** (Nov 9): synced collection `unidash.examResults.v1` (`ExamResult`: subject + date copied in, so the
  history survives the calendar event going away; optional score/outOf/passed). `lib/exams.ts`: an exam is over once
  its day has passed (all-day) or 2 h after the start; `upcomingExams` hides exams that are over or have a result,
  `examsAwaitingResult` = over in the last 30 days with no result. Exams tab: "How did it go?" list (Add result / Skip)
  → upcoming (empty state only when both are empty) → History (passed · failed). Today shows `ExamResultPrompt` for
  3 days after an exam. `ExamResultForm` (editor `examResult`) guesses passed at ≥ half marks until picked by hand;
  for a deadline-based exam it also writes the grade to the deadline. Calendar/iCal now read 31 days back so recent
  exams can still be graded.
- **School on a map** (Nov 10, `components/place/SchoolPicker.tsx`, used in setup's "Where do you study?" and Settings →
  You): search as you type with **Photon** (photon.komoot.io, OpenStreetMap data, free, no key; `data/places.ts`
  `searchPlaces`, 350 ms debounce, biased to home/city rounded to 0.1°), pick a result → name + address fields fill in
  (still editable) and a small **Leaflet** map (`PinMap.tsx`, lazy chunk, OSM tiles, dark mode inverts the tiles) shows a
  draggable pin; dragging or tapping the map moves it and fills the address there (Nominatim reverse, `addressAt`).
  The exact position is `profile.school.place`, so it syncs with the profile like everything else. Typing an address by
  hand still works (looked up on save as before). Privacy page lists Photon (`pp.svcPhoton`). Chosen over Google Maps
  (needs billing + a public key) on Nov 10.
  Fixes after the first try (Nov 10): suggestions sit in the page flow under the box (a floating list was painted over by
  the setup's animated fields); with nothing saved, results are biased to the main city of the device's time zone
  (`zoneCentre`, read on the device); a **"Search addresses for …"** row (and Enter with no suggestion) runs one Nominatim
  search on request (`searchAddresses`, viewbox ~100 km) for schools OSM doesn't know by name: find the street and
  number, then drag the pin. Nominatim forbids search-as-you-type, so it never runs on each keystroke.
- **Motion** (`src/lib/motion.ts`): shared springs `snappy` (taps, toggles, highlights), `smooth` (pages, sheets, lists,
  no overshoot), `gentle` (entrances), `bouncy` (delight: checkbox, + button, setup finish); `blur()` only on pointer
  devices; `press` for tap feedback. CSS twins `--spring-snappy/--spring-smooth` (`linear()`) in `index.css`, used by
  the switch knob and `.pressable` cards. Use these instead of one-off durations.
  - Tabs slide in the direction of the tab picked (AppShell, `popLayout`, no blank gap). **Don't put
    `initial={false}` on that AnimatePresence**: it blocks every entrance inside the first page (it did in the original).
  - `lib/intro.ts`: the launch logo plays once per session; `Reveal` waits for it (`introDelay`) so the page rises in
    as the logo lifts away. During first-open setup the intro is skipped and the page isn't mounted, so Today's
    entrance plays when setup closes.
  - Sheet: rises on phones, grows from the centre on wider screens; contents settle in a beat later.
  - Setup: each screen's parts stagger in, choice tiles press and ring, progress bar springs, the finish has a
    check-and-burst `Celebration`. Checkbox fill springs out and the tick draws; tasks slide in/out; toasts bounce in
    and can be swiped away.

## History

- **Nov 5, 2026**: repo planned; this file written from `antwnakys/dash` at `1c497a7`.
- **Nov 5, 2026**: bootstrap done: source copied, renamed to unidash, personal parts replaced by settings, first-open
  setup added. Tested in an iPhone-sized browser (setup flow, Leave card with Greek/English address match, pass card,
  Settings). Pages switched on and live. Antonis created the Google Cloud project "unidash" (consent screen External,
  Testing; Calendar + Drive APIs; web client) and the web client ID went into `src/config.ts`.
- **Nov 5, 2026**: motion pass (Antonis: "do the animations way better"): one spring system, directional tabs, intro
  hand-off, setup choreography, fixed the first page's entrance never playing.
- **Nov 9, 2026**: languages (16, auto from the device, picker in Settings, RTL for Arabic/Urdu) and the privacy policy page.
  Also renamed the leftover personal task category "Gaming & projects" to "Projects".
- **Nov 9, 2026 (evening)**: animations + first-screen fix copied into Antonis's own dash (antwnakys/dash#29). unidash got
  offline support, the Home Screen card, Settings → Feedback and a full Delete all data (device + Drive + revoke).
  Also exam results: score + passed/failed, a history, and finished exams leave the upcoming list.
- **Nov 10, 2026**: school search with suggestions and a map pin (OpenStreetMap/Photon, free); then fixed the see-through
  list, local results first, and "Search addresses" for schools not listed by name.

## Next up

- Antonis adds himself and classmates as test users (Google Auth Platform → Audience → Test users, max 100), then
  tries sign-in on the live site. Test users' sign-in expires every 7 days while the app is in Testing.
- Share with classmates, collect feedback. Later: Google verification (needs privacy URL = done, a demo video, likely a
  custom domain), apps.
- **Apple (Nov 6)**: Antonis has a **paid Apple developer account** now. Claude recommended TestFlight first (real app
  for classmates: reminders, home-screen icon, native Google sign-in), then the App Store after feedback + Google
  verification (needed so non-test users and Apple's reviewer can sign in) + a privacy policy page. Risks noted:
  guideline 4.2 (web wrapper; native features help), Sign in with Apple (Google is used only for Calendar/Drive).
  Options offered: 1 TestFlight first, 2 straight to App Store, 3 wait. **He'll decide later**; don't start until he does.
  Needs from him: App Store Connect app record, and either an App Store Connect API key in GitHub secrets (CI build)
  or a build from his Mac with Xcode. Bundle id planned: `com.antwnakys.unidash` (already in `capacitor.config.ts`).
