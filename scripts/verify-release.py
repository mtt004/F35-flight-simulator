#!/usr/bin/env python3
"""Verify downloaded release files; signature verification remains a separate SDK check."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('directory', type=Path)
parser.add_argument('--github-assets', type=Path, help='Saved GitHub REST release asset metadata')
parser.add_argument('--expected-source')
args = parser.parse_args()
root = args.directory.resolve()
checks = {}
for line in (root / 'SHA256SUMS.txt').read_text().splitlines():
    match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.-]+)', line)
    if not match:
        raise SystemExit('Invalid checksum entry')
    digest, name = match.groups()
    data = (root / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != digest:
        raise SystemExit('Checksum mismatch: ' + name)
    checks[name] = {'bytes': len(data), 'sha256': digest}
required = {'Lightning-F35B-Android.apk', 'Lightning-F35B-Web.zip', 'Lightning-F35B-Evidence.zip',
            'android-verification.json', 'android-installation.json', 'build-manifest.json'}
if set(checks) != required:
    raise SystemExit('Release checksum manifest is incomplete or unexpected')
for name in ['Lightning-F35B-Web.zip', 'Lightning-F35B-Android.apk', 'Lightning-F35B-Evidence.zip']:
    with zipfile.ZipFile(root / name) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Corrupt archive: ' + name)
with zipfile.ZipFile(root / 'Lightning-F35B-Web.zip') as web:
    if web.namelist() != ['Lightning-F35B.html']:
        raise SystemExit('Unexpected browser package contents')
    html = web.read('Lightning-F35B.html')
with zipfile.ZipFile(root / 'Lightning-F35B-Android.apk') as apk:
    if apk.read('assets/www/index.html') != html:
        raise SystemExit('APK and browser simulator differ')
    for name, source in [('THIRD_PARTY_NOTICES.txt', 'android/THIRD_PARTY_NOTICES.txt'),
                         ('LICENSE-2.0.txt', 'android/LICENSE-2.0.txt'), ('LICENSES.md', 'LICENSES.md')]:
        if apk.read('assets/www/' + name) != Path(source).read_bytes():
            raise SystemExit('Bundled licence differs from source: ' + name)
verification = json.loads((root / 'android-verification.json').read_text())
if verification['sha256'] != checks['Lightning-F35B-Android.apk']['sha256']:
    raise SystemExit('APK verification record describes another binary')
installation = json.loads((root / 'android-installation.json').read_text())
if installation.get('status') != 'PASS' or not installation.get('actualInstallationAndLaunch') or installation.get('tests', 0) < 1:
    raise SystemExit('No passing recorded Android installation/live-flight gate')
manifest = json.loads((root / 'build-manifest.json').read_text())
if args.expected_source and manifest.get('sourceCommit') != args.expected_source:
    raise SystemExit('Unexpected release source commit')
metadata_matches = None
if args.github_assets:
    assets = json.loads(args.github_assets.read_text())
    if {a['name'] for a in assets} != required | {'SHA256SUMS.txt'}:
        raise SystemExit('GitHub release asset list differs')
    for asset in assets:
        data = (root / asset['name']).read_bytes()
        if len(data) != asset['bytes'] or 'sha256:' + hashlib.sha256(data).hexdigest() != asset['digest']:
            raise SystemExit('Published GitHub asset digest mismatch: ' + asset['name'])
    metadata_matches = True
print(json.dumps({'status':'PASS', 'files':checks, 'sourceCommit':manifest.get('sourceCommit'),
                  'browserHtmlSha256':hashlib.sha256(html).hexdigest(), 'githubAssetDigestsMatch':metadata_matches,
                  'signatureVerification':'CI apksigner record; not independently rerun without Android SDK',
                  'installation':installation, 'galaxyA51':'NOT TESTED'}, indent=2))
