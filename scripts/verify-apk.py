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

parser = argparse.ArgumentParser()
parser.add_argument("apk", type=Path)
args = parser.parse_args()
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
    required = {"AndroidManifest.xml", "classes.dex", "assets/www/index.html"}
    if not required.issubset(archive.namelist()):
        raise SystemExit(f"APK lacks {sorted(required-set(archive.namelist()))}")
    bundled = archive.read("assets/www/index.html")
    browser = Path("dist/index.html")
    if not browser.is_file() or bundled != browser.read_bytes():
        raise SystemExit("Bundled simulator differs from the browser build")
    if b"__F35B_SIM__" not in bundled or b"WebGLRenderer" not in bundled:
        raise SystemExit("APK does not contain the simulator")
badging = subprocess.run([locate("aapt"), "dump", "badging", str(args.apk)], check=True, capture_output=True, text=True).stdout
if "package: name='com.mtt004.lightning'" not in badging:
    raise SystemExit("Unexpected APK application ID")
if "sdkVersion:'26'" not in badging or "targetSdkVersion:'35'" not in badging:
    raise SystemExit("Unexpected APK SDK compatibility")
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
    "applicationId": "com.mtt004.lightning",
    "versionName": "0.1.0-experimental",
    "versionCode": 1,
    "minSdk": 26,
    "targetSdk": 35,
    "signing": "debug (ephemeral CI key; verify certificate output below)",
    "archiveIntegrity": "PASS",
    "bundledBrowserMatches": True,
    "permissions": permissions,
    "badging": badging,
    "signatureVerification": signature,
    "installationTest": "NOT TESTED by this archive verifier",
    "galaxyA51Performance": "NOT TESTED"
}, indent=2))
