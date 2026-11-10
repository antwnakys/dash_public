# unidash for iPhone

The iPhone app is the website inside a Capacitor shell (`ios/`). Bundle id `com.antwnakys.unidash`, team
`H739SB5FKP`, iOS 15+. Web changes reach installed apps by live update (`src/lib/liveUpdate.ts`, files published by
`deploy.yml`), so a new upload is only needed when something native changes (plugins, `Info.plist`, icons, Swift).

## One-time setup (needs Antonis)

1. **App record**: App Store Connect → Apps → + → New App: iOS, name `unidash`, language English,
   bundle id `com.antwnakys.unidash` (if it isn't listed yet, Xcode registers it on the first build; refresh after),
   SKU `unidash`, Full access. Apple doesn't let anyone create the app record by API, so this is the one manual step.
2. **A Mac with Xcode** signed in to the developer account (Xcode → Settings → Accounts), or the GitHub route below.

## Upload from a Mac

```bash
git clone https://github.com/antwnakys/dash_public.git ~/unidash
cd ~/unidash
npm ci
npm run ios:sync
TEAM_ID=H739SB5FKP npm run testflight
```

With an App Store Connect API key instead of an Xcode sign-in, also set `ASC_KEY_ID`, `ASC_ISSUER_ID` and
`ASC_KEY_PATH` (the `.p8` file). Build numbers come from the UTC date and time, so every upload is higher.

## Upload from GitHub (optional)

`.github/workflows/testflight.yml` does the same on GitHub's Macs when these repository secrets exist:
`APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` (the whole `AuthKey_XXXX.p8` file, Admin or App
Manager role). Until then it says "not set up yet" and stays green. `ios.yml` compiles the project on every pull
request that touches native files.

## Not done yet

- Google sign-in in the app needs an **iOS OAuth client** in the Cloud project "unidash" (bundle id above); its ID
  goes in `GOOGLE_IOS_CLIENT_ID` (`src/config.ts`) and its reversed form as a URL scheme + `GIDClientID` in
  `ios/App/App/Info.plist`. Until then the Google buttons are hidden in the app.
- The app icon is the same as dash's.
