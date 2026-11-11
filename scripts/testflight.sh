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
# ExportOptions-upload.plist sends the build to App Store Connect; ExportOptions-export.plist only writes the .ipa.
for dest in upload export; do
  cat > "$OUT/ExportOptions-$dest.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>app-store-connect</string>
	<key>destination</key>
	<string>$dest</string>
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
done

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

export_to() {
  xcodebuild -exportArchive \
    -archivePath "$ARCHIVE" \
    -exportOptionsPlist "$OUT/ExportOptions-$1.plist" \
    -exportPath "$OUT/$1" \
    "${auth[@]}"
}

upload() { export_to upload; }

# The widget reads what the app writes through an App Group; both must carry it in their signature, or the widget
# stays empty. Exports the signed .ipa and looks inside before anything is uploaded.
check_app_groups() {
  export_to export || return 1
  local dir="$OUT/ipa-check"
  rm -rf "$dir" && mkdir -p "$dir"
  unzip -q "$OUT"/export/*.ipa -d "$dir" || return 1
  local ok=1 found=0
  while IFS= read -r bundle; do
    if codesign -d --entitlements :- "$bundle" 2>/dev/null | grep -q application-groups; then
      found=$((found + 1))
      echo "App Group signed into $(basename "$bundle")"
    else
      echo "::error::$(basename "$bundle") was signed without its App Group. Entitlements:"
      codesign -d --entitlements :- "$bundle" 2>/dev/null || true
      ok=0
    fi
  done < <(find "$dir/Payload" -maxdepth 4 \( -name '*.app' -o -name '*.appex' \))
  [ "$ok" = 1 ] && [ "$found" -ge 2 ]
}

echo "unidash build $BUILD_NUMBER for team $TEAM_ID"
# A project with a widget uses an App Group (in its .entitlements files).
needs_app_groups=$(grep -l application-groups "$ROOT"/ios/App/*/*.entitlements 2>/dev/null || true)
if [ -n "${ASC_KEY_ID:-}" ]; then
  # CI: an unsigned archive, signed in the cloud while exporting (no development certificate piles up per run).
  # If Xcode won't export it, fall back to a normal signed archive.
  # With an App Group the archive is signed "to run locally" (no certificate needed) so the entitlements file is
  # written into the binary; the cloud-signed export then asks Apple for a profile with those entitlements. An
  # unsigned archive has none, and the export quietly signs without the App Group.
  if [ -n "$needs_app_groups" ]; then
    unsigned=(CODE_SIGN_IDENTITY=- AD_HOC_CODE_SIGNING_ALLOWED=YES CODE_SIGN_STYLE=Manual PROVISIONING_PROFILE_SPECIFIER= PROVISIONING_PROFILE=)
  else
    unsigned=(CODE_SIGNING_ALLOWED=NO)
  fi
  if archive "${unsigned[@]}"; then
    if [ -n "$needs_app_groups" ] && ! check_app_groups; then
      echo "::error::Not uploaded: the App Group is missing from the signature (see above)."
      exit 1
    fi
    if upload; then
      echo "Uploaded build $BUILD_NUMBER (cloud signed)."
      exit 0
    fi
  fi
  echo "::warning::Unsigned archive couldn't be exported; trying a signed archive."
fi
archive CODE_SIGN_STYLE=Automatic "${auth[@]}"
upload
echo "Uploaded build $BUILD_NUMBER."
