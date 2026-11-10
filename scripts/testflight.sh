#!/usr/bin/env bash
# Archive the iPhone app and upload it to TestFlight (App Store Connect).
#
# On a Mac where Xcode is signed in to the paid Apple Developer account:
#   npm ci && npm run build && npx cap sync ios
#   TEAM_ID=XXXXXXXXXX scripts/testflight.sh
#
# On GitHub Actions (.github/workflows/testflight.yml) the same script runs with an App Store Connect
# API key (Admin role): ASC_KEY_ID, ASC_ISSUER_ID and ASC_KEY_PATH (the .p8 file) are set, and Xcode's
# cloud signing makes the distribution certificate and profile, so no certificates live in the repo.
set -euo pipefail

: "${TEAM_ID:?Set TEAM_ID to the 10-character Apple Developer team ID}"
ROOT=$(cd "$(dirname "$0")/.." && pwd)
PROJECT=${PROJECT:-$ROOT/ios/App/App.xcodeproj}
OUT=${OUT:-$ROOT/build/testflight}
# Every upload needs a higher build number; the UTC date and time always goes up.
BUILD_NUMBER=${BUILD_NUMBER:-$(date -u +%Y%m%d.%H%M)}
ARCHIVE="$OUT/unidash.xcarchive"

auth=(-allowProvisioningUpdates)
if [ -n "${ASC_KEY_ID:-}" ]; then
  : "${ASC_ISSUER_ID:?Set ASC_ISSUER_ID}" "${ASC_KEY_PATH:?Set ASC_KEY_PATH to the .p8 key file}"
  auth+=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

rm -rf "$OUT"
mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>upload</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>$TEAM_ID</string>
	<key>uploadSymbols</key>
	<true/>
	<key>manageAppVersionAndBuildNumber</key>
	<false/>
</dict>
</plist>
PLIST

archive() {
  rm -rf "$ARCHIVE"
  xcodebuild \
    -project "$PROJECT" \
    -scheme App \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -archivePath "$ARCHIVE" \
    archive \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
    "$@"
}

upload() {
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportOptionsPlist "$OUT/ExportOptions.plist" \
    -exportPath "$OUT/export" \
    "${auth[@]}"
}

echo "unidash build $BUILD_NUMBER for team $TEAM_ID"
if [ -n "${ASC_KEY_ID:-}" ]; then
  # CI: an unsigned archive, signed in the cloud while exporting (no development certificate piles up per run).
  # If Xcode won't export it, fall back to a normal signed archive.
  if archive CODE_SIGNING_ALLOWED=NO && upload; then
    echo "Uploaded build $BUILD_NUMBER (cloud signed)."
    exit 0
  fi
  echo "::warning::Unsigned archive couldn't be exported; trying a signed archive."
fi
archive CODE_SIGN_STYLE=Automatic "${auth[@]}"
upload
echo "Uploaded build $BUILD_NUMBER."
