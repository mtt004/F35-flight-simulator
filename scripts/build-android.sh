#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
node scripts/build-web.mjs
cd android
bash ./gradlew --no-daemon --stacktrace assembleDebug lintDebug
cd "$project_root"
mkdir -p dist
cp android/app/build/outputs/apk/debug/app-debug.apk dist/Lightning-F35B-Android.apk
python3 scripts/verify-apk.py dist/Lightning-F35B-Android.apk > dist/android-verification.json
