#!/usr/bin/env python3
"""Combine independently validated browser and Android jobs without inventing gates."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET
import zipfile

from android_metadata import read_project_metadata, validate_badging, validate_instrumentation_xml, validate_android_runtime_evidence


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


ANDROID_RUNTIME = 'dist/android-host-diagnostics/android-runtime.json'


def load_android_runtime(android, installation, expected_version):
    if installation.get('runtimeReport') != ANDROID_RUNTIME:
        raise ValueError('Actual Android runtime report path is missing')
    path = android / ANDROID_RUNTIME
    if sha(path) != installation.get('runtimeSha256'):
        raise ValueError('Actual Android runtime report differs from installation evidence')
    runtime = validate_android_runtime_evidence(path.read_bytes(), expected_version)
    if runtime != installation.get('runtime'):
        raise ValueError('Actual Android runtime fields differ from installation evidence')
    return runtime


def validate_browser_gates(browser, manifest, expected_source):
    """Fail closed on individual evidence, even when an enclosing CI job passed."""
    directory = browser / 'benchmarks/london-v0.5'
    read = lambda name: json.loads((directory / name).read_text())
    verification, timing, visual, endurance, geometry = [read(name) for name in
        ['verification.json', 'paired-render.json', 'visual-comparison.json', 'endurance.json', 'prepared-equivalence.json']]
    if verification.get('status') != 'PASS':
        raise ValueError('Controlled browser verification gate did not pass')
    required_checks = {'paired-render-observations', 'matched-visual-regression'}
    if not required_checks <= {c.get('name') for c in verification.get('checks', []) if c.get('status') == 'PASS'}:
        raise ValueError('Browser verification wrapper lacks individual passing checks')
    if (timing.get('status') != 'MEASURED' or timing.get('sourceCommit') != expected_source
            or timing.get('baselineSourceCommit') != 'ca330131115ee983a6457efa33ff513ac34803ad'
            or timing.get('sources', {}).get('before', {}).get('sha256') != 'f1f6a9e9b19c0bc8210b5bab4ef91e9b03c854f0b895cda0c965ae6779a45aad'
            or timing.get('sources', {}).get('after', {}).get('sha256') != manifest['sha256']):
        raise ValueError('Paired measurements are missing or describe different baseline/final source bytes')
    repeats = timing.get('repeats', 0)
    if type(repeats) is not int or repeats < 3 or not timing.get('secondsPerRun', 0) >= 10 or timing.get('errors') != []:
        raise ValueError('Paired measurements lack complete repeated controlled runs')
    timed = [s for s in timing.get('scenarios', []) if not s.get('settings', {}).get('captureOnly', False)]
    # Capture-only scene entries have no timing samples; twelve actual scenes
    # must each retain every before/after repeat and its raw frame intervals.
    timed = [s for s in timed if s.get('runs', {}).get('before')]
    if len(timed) < 12 or any(len(s.get('runs', {}).get(label, [])) != repeats or
            any(len(r.get('raw', {}).get('intervals', [])) < 2 or r.get('raw', {}).get('gpuBoundary', {}).get('signalled') is not True for r in s['runs'][label])
            for s in timed for label in ['before', 'after']):
        raise ValueError('Paired measurements lack twelve complete scenarios')
    for scene in timing.get('scenarios', []):
        for label in ['before', 'after']:
            warm = scene.get('warm', {}).get(label, {})
            expected = warm.get('expectedGroundTiles')
            if type(expected) is not int or expected < 0 or warm.get('stats', {}).get('groundTiles') != expected:
                raise ValueError('Matched scene has incomplete local road geometry')
        states = scene.get('states', {})
        def signature(label):
            state = states[label]
            return ([state['scenery'][key] for key in ['buildings', 'buildingTiles', 'groundTiles', 'lods']],
                    [state['memory'][key] for key in ['sceneGeometryObjects', 'geometryAttributeBytes', 'indexBytes']],
                    [state['renderer'][key] for key in ['calls', 'triangles', 'points', 'lines']])
        if signature('before') != signature('after'):
            raise ValueError('Matched scenes contain different geometry or submissions')
    shots = timing.get('shots', [])
    names = {label: [s.get('name') for s in shots if s.get('label') == label] for label in ['before', 'after']}
    if len(names['before']) < 12 or set(names['before']) != set(names['after']) or any(len(v) != len(set(v)) for v in names.values()):
        raise ValueError('At least twelve complete unique visual pairs are required')
    for shot in shots:
        name = shot.get('file', '')
        if not name.startswith('screenshots/london-v0.5/') or '..' in Path(name).parts or sha(browser / name) != shot.get('sha256'):
            raise ValueError('Visual capture is missing or differs from the paired report')
    images = visual.get('images', [])
    if (visual.get('status') != 'PASS' or len(images) < 12 or {i.get('name') for i in images} != set(names['before'])
            or verification.get('scenePairs') != len(images)
            or any(i.get('status') != 'PASS' or not i.get('ssim', 0) >= .995 or i.get('dimensions') != [1152, 648]
                or len(i.get('regions', [])) != 9 or any(not r.get('ssim', 0) >= .99 for r in i['regions']) for i in images)):
        raise ValueError('Visual-comparison gate is incomplete or below its stated tolerances')
    statuses = {'COMPLETED_WITHOUT_OBSERVED_FLIGHT_FAILURE', 'COMPLETED_WITH_RECOVERED_CONTEXT_LOSS'}
    samples = endurance.get('samples', [])
    if (endurance.get('completed') is not True or endurance.get('status') not in statuses
            or endurance.get('requestedWallSeconds') != 1200 or not endurance.get('elapsedWallSeconds', 0) >= 1200
            or endurance.get('sourceSha256') != manifest['sha256'] or endurance.get('errors') != []
            or endurance.get('assessment', {}).get('issues') != [] or len(samples) < 2
            or samples[-1].get('wall', 0) - samples[0].get('wall', 0) < 1199000):
        raise ValueError('Full twenty-minute flight evidence is incomplete, failed or describes another build')
    geometry_path = browser / 'scenery-packs/london-geometry/manifest.json'
    prepared = json.loads(geometry_path.read_text())
    if (geometry.get('status') != 'PASS' or geometry.get('errors') != []
            or geometry.get('manifestSha256') != sha(geometry_path)
            or geometry.get('baselineSourceCommit') != 'ca330131115ee983a6457efa33ff513ac34803ad'
            or geometry.get('sourceHashes') != prepared.get('sourceHashes')
            or geometry.get('inputHashes') != prepared.get('inputPins')
            or prepared.get('inputPins') != {'vectorData': '82088ac9a9e4e7c8cc106175cd62607b77c10f9cf7cf5c7fbcb79c238b36092c',
                                            'heightData': '16705679a6df69a7065acea68ec27d62fdd5c8caf90ba5b19f0f640f239959fc'}
            or len(prepared.get('sourceHashes', {})) < 6
            or len(prepared.get('tiles', {})) < 866 or geometry.get('checked') != len(prepared['tiles'])):
        raise ValueError('Prepared geometry byte-equivalence gate is incomplete or describes other inputs')
    return {'visualPairs': len(images), 'timedScenarios': len(timed), 'preparedTiles': geometry['checked'],
            'enduranceWallSeconds': endurance['elapsedWallSeconds'], 'enduranceStatus': endurance['status']}


def record_android():
    verification = json.loads(Path('dist/android-verification.json').read_text())
    runtime_path = Path(ANDROID_RUNTIME)
    runtime = validate_android_runtime_evidence(runtime_path.read_bytes(), verification['versionName'])
    reports = {str(p): p.read_bytes() for p in sorted(Path('android/app/build/outputs/androidTest-results/connected').rglob('TEST-*.xml'))}
    installed = Path('android/app/build/outputs/apk/debug/app-debug.apk')
    if sha(installed) != verification['sha256'] or sha(Path('dist/Lightning-F35B-Android.apk')) != verification['sha256']:
        raise ValueError('Installed APK and distributable differ')
    result = {'status': 'PASS', 'environment': 'GitHub Actions Android API 33 x86_64 emulator; software GPU',
              'actualInstallationAndLaunch': True,
              'tests': sum(len(list(ET.fromstring(data).iter('testcase'))) for data in reports.values()),
              'reports': list(reports), 'reportChecksums': {name: hashlib.sha256(data).hexdigest() for name, data in reports.items()},
              'apkSha256': verification['sha256'], 'sourceCommit': os.environ['GITHUB_SHA'],
              'versionName': verification['versionName'], 'versionCode': verification['versionCode'], 'galaxyA51': 'NOT TESTED',
              'runtimeReport': ANDROID_RUNTIME, 'runtimeSha256': sha(runtime_path), 'runtime': runtime}
    validate_instrumentation_xml(reports, result)
    Path('dist/android-installation.json').write_text(json.dumps(result, indent=2) + '\n')


def package(browser, android, destination, expected_source):
    project = read_project_metadata()
    manifest = json.loads((browser / 'dist/build-manifest.json').read_text())
    browser_gates = validate_browser_gates(browser, manifest, expected_source)
    native_manifest = json.loads((android / 'dist/build-manifest.json').read_text())
    verification = json.loads((android / 'dist/android-verification.json').read_text())
    installation = json.loads((android / 'dist/android-installation.json').read_text())
    if installation.get('status') != 'PASS' or installation.get('actualInstallationAndLaunch') is not True:
        raise ValueError('No passing actual Android installation and launch evidence')
    runtime = load_android_runtime(android, installation, verification['versionName'])
    metadata = validate_badging(verification['badging'], project)
    if manifest['sha256'] != native_manifest['sha256']:
        raise ValueError('Browser and Android jobs built different simulator bytes')
    for key in ['version', 'versionCode']:
        if manifest[key] != native_manifest[key]:
            raise ValueError('Browser/native version differs: ' + key)
    for name, pin in manifest['sourceHashes'].items():
        if sha(Path(name)) != pin:
            raise ValueError('Delivered source differs from built source: ' + name)
    if metadata['versionName'] != manifest['version'] or metadata['versionCode'] != manifest['versionCode']:
        raise ValueError('APK package metadata differs from browser identity')
    if installation['sourceCommit'] != expected_source:
        raise ValueError('Installed APK source is not this workflow commit')
    apk = android / 'dist/Lightning-F35B-Android.apk'
    if sha(apk) != verification['sha256'] or sha(apk) != installation['apkSha256']:
        raise ValueError('APK digest differs from verification/installation evidence')
    reports = {name: (android / name).read_bytes() for name in installation['reports']}
    validate_instrumentation_xml(reports, installation)
    with zipfile.ZipFile(browser / 'dist/Lightning-F35B-Web.zip') as web, zipfile.ZipFile(apk) as native:
        if web.namelist() != ['Lightning-F35B.html'] or web.testzip() is not None or native.testzip() is not None:
            raise ValueError('Corrupt/unexpected APK or browser archive')
        html = web.read('Lightning-F35B.html')
        if html != native.read('assets/www/index.html') or hashlib.sha256(html).hexdigest() != manifest['sha256']:
            raise ValueError('APK, browser and build manifest simulator bytes differ')
    destination.mkdir(parents=True, exist_ok=True)
    for source, name in [(browser / 'dist/Lightning-F35B-Web.zip', 'Lightning-F35B-Web.zip'),
                         (apk, 'Lightning-F35B-Android.apk'),
                         (android / 'dist/android-installation.json', 'android-installation.json'),
                         (android / 'dist/android-verification.json', 'android-verification.json')]:
        shutil.copy2(source, destination / name)
    with zipfile.ZipFile(destination / 'Lightning-London-Scenery.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for pack in ['london', 'london-imagery', 'london-heights', 'london-geometry']:
            directory = browser / 'scenery-packs' / pack
            pack_manifest = json.loads((directory / 'manifest.json').read_text())
            archive.write(directory / 'manifest.json', pack + '/manifest.json')
            for name, pin in pack_manifest['outputs'].items():
                if Path(name).name != name:
                    raise ValueError('Unsafe scenery output path: ' + name)
                path = directory / name
                if path.stat().st_size != pin['bytes'] or sha(path) != pin['sha256']:
                    raise ValueError('Delivery scenery output differs from build pin: ' + pack + '/' + name)
                archive.write(path, pack + '/' + name)
    manifest.update({'sourceCommit': expected_source, 'workflowRun': os.environ.get('GITHUB_RUN_ID'),
                     'androidVersion': metadata['versionName'], 'galaxyA51': 'NOT TESTED',
                     'signing': 'debug; ephemeral CI key',
                     'installation': 'PASS: actual API 33 emulator installed the exact APK and launched its offline simulator'})
    (destination / 'build-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    with zipfile.ZipFile(destination / 'Lightning-F35B-Evidence.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for prefix, root in [('browser', browser), ('android', android)]:
            for folder in ['benchmarks', 'screenshots', 'android/app/build/outputs/androidTest-results', 'android/app/build/reports', 'dist/android-host-diagnostics']:
                for path in sorted((root / folder).rglob('*')):
                    if path.is_file():
                        archive.write(path, prefix + '/' + path.relative_to(root).as_posix())
        for folder in ['docs', 'research']:
            for path in sorted(Path(folder).rglob('*')):
                if path.is_file():
                    archive.write(path, path.as_posix())
        for path in sorted((browser / 'scenery-packs/london-geometry').rglob('*')):
            if path.is_file():
                archive.write(path, 'scenery-packs/london-geometry/' + path.relative_to(browser / 'scenery-packs/london-geometry').as_posix())
        for name in ['build-manifest.json', 'android-installation.json', 'android-verification.json']:
            archive.write(destination / name, name)
    result = {'status': 'PASS', 'sourceCommit': expected_source, 'browserHtmlSha256': manifest['sha256'],
              'apkSha256': sha(apk), 'rawInstrumentationReports': len(reports),
              'sourceFilesMatched': len(manifest['sourceHashes']), 'browserGates': browser_gates, 'galaxyA51': 'NOT TESTED',
              'androidRuntime': {'webView': runtime['webView'], 'geometryPath': runtime['geometryPath'],
                                 'prepared': runtime['prepared'], 'observation': runtime['observation']},
              'method': 'Paired browser job and independent API 33 installation evidence combined only after both jobs succeeded; source hashes and APK/browser bytes verified.'}
    (destination / 'delivery-verification.json').write_text(json.dumps(result, indent=2) + '\n')
    names = ['Lightning-F35B-Web.zip', 'Lightning-F35B-Android.apk', 'Lightning-F35B-Evidence.zip', 'Lightning-London-Scenery.zip',
             'build-manifest.json', 'android-installation.json', 'android-verification.json', 'delivery-verification.json']
    (destination / 'SHA256SUMS.txt').write_text(''.join(sha(destination / name) + '  ' + name + '\n' for name in names))
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--record-android', action='store_true')
    parser.add_argument('--browser', type=Path)
    parser.add_argument('--android', type=Path)
    parser.add_argument('--output', type=Path, default=Path('delivery'))
    parser.add_argument('--expected-source', default=os.environ.get('GITHUB_SHA'))
    args = parser.parse_args()
    if args.record_android:
        record_android()
    else:
        if not args.browser or not args.android or not args.expected_source:
            parser.error('--browser, --android and --expected-source are required for packaging')
        package(args.browser, args.android, args.output, args.expected_source)
