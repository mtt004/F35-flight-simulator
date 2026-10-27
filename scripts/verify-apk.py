#!/usr/bin/env python3
"""Inspect a real built APK, its package metadata, bundled game and signature."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile
from android_metadata import read_project_metadata, validate_badging

parser = argparse.ArgumentParser()
parser.add_argument("apk", type=Path)
args = parser.parse_args()
project_metadata = read_project_metadata()
if not args.apk.is_file():
    parser.error("APK does not exist")
sdk = Path(os.environ.get("ANDROID_HOME", os.environ.get("ANDROID_SDK_ROOT", "")))
tool_dirs = list((sdk / "build-tools").glob("*"))

def locate(name):
    for folder in sorted(tool_dirs, key=lambda p: tuple(int(x) for x in re.findall(r"\d+", p.name)), reverse=True):
        p = folder / name
        if p.is_file():
            return str(p)
    raise SystemExit(f"Required Android build tool {name} was not found; set ANDROID_HOME")

with zipfile.ZipFile(args.apk) as archive:
    bad = archive.testzip()
    if bad:
        raise SystemExit(f"APK archive corruption: {bad}")
    licence_sources = {
        "assets/www/THIRD_PARTY_NOTICES.txt": Path("android/THIRD_PARTY_NOTICES.txt"),
        "assets/www/LICENSE-2.0.txt": Path("android/LICENSE-2.0.txt"),
        "assets/www/LICENSES.md": Path("LICENSES.md"),
    }
    required = {"AndroidManifest.xml", "classes.dex", "assets/www/index.html", *licence_sources}
    if not required.issubset(archive.namelist()):
        raise SystemExit(f"APK lacks {sorted(required-set(archive.namelist()))}")
    licence_checksums = {}
    for bundled_path, source_path in licence_sources.items():
        if not source_path.is_file() or archive.read(bundled_path) != source_path.read_bytes():
            raise SystemExit(f"Bundled licence differs from checked-in source: {bundled_path}")
        licence_checksums[bundled_path] = hashlib.sha256(archive.read(bundled_path)).hexdigest()
    apache = archive.read("assets/www/LICENSE-2.0.txt")
    if hashlib.sha256(apache).hexdigest() != "cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30":
        raise SystemExit("APK lacks the exact full Apache 2.0 licence (including appendix)")
    notices = archive.read("assets/www/THIRD_PARTY_NOTICES.txt")
    if apache not in notices or b"JetBrains" not in notices or b"Android Open Source Project" not in notices:
        raise SystemExit("APK lacks Kotlin/AndroidX notices and their full licence copy")
    bundled = archive.read("assets/www/index.html")
    browser = Path("dist/index.html")
    if not browser.is_file() or bundled != browser.read_bytes():
        raise SystemExit("Bundled simulator differs from the browser build")
    if b"__F35B_SIM__" not in bundled or b"WebGLRenderer" not in bundled:
        raise SystemExit("APK does not contain the simulator")
badging = subprocess.run([locate("aapt"), "dump", "badging", str(args.apk)], check=True, capture_output=True, text=True).stdout
try:
    actual_metadata = validate_badging(badging, project_metadata)
except ValueError as error:
    raise SystemExit(str(error)) from error
if "launchable-activity: name='com.mtt004.lightning.MainActivity'" not in badging:
    raise SystemExit("APK has no expected launchable activity")
permissions = [line for line in badging.splitlines() if line.startswith("uses-permission")]
if permissions:
    raise SystemExit("Unexpected Android permission: " + repr(permissions))
signature = subprocess.run([locate("apksigner"), "verify", "--verbose", "--print-certs", str(args.apk)], check=True, capture_output=True, text=True).stdout
print(json.dumps({
    "filename": args.apk.name,
    "bytes": args.apk.stat().st_size,
    "sha256": hashlib.sha256(args.apk.read_bytes()).hexdigest(),
    **actual_metadata,
    "signing": "debug (ephemeral CI key; verify certificate output below)",
    "archiveIntegrity": "PASS",
    "bundledBrowserMatches": True,
    "thirdPartyLicenceChecksums": licence_checksums,
    "permissions": permissions,
    "badging": badging,
    "signatureVerification": signature,
    "installationTest": "NOT TESTED by this archive verifier",
    "galaxyA51Performance": "NOT TESTED"
}, indent=2))
