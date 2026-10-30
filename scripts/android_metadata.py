"""Shared, SDK-independent validation of version badging and raw test evidence."""
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent


def read_project_metadata(directory=ROOT):
    package = json.loads((Path(directory) / 'package.json').read_text())
    version = package.get('version')
    code = package.get('lightning', {}).get('androidVersionCode')
    if not isinstance(version, str) or not re.fullmatch(r'\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?', version):
        raise ValueError('Invalid project version')
    if type(code) is not int or not 1 <= code <= 2100000000:
        raise ValueError('Invalid Android version code')
    return {'version': version, 'versionCode': code}


def parse_badging(text):
    package = next((line for line in text.splitlines() if line.startswith('package: ')), '')
    attributes = dict(re.findall(r"([A-Za-z][A-Za-z0-9]*)='([^']*)'", package))
    minimum = re.search(r"^sdkVersion:'(\d+)'$", text, re.M)
    target = re.search(r"^targetSdkVersion:'(\d+)'$", text, re.M)
    if not attributes.get('name') or not attributes.get('versionName') or not attributes.get('versionCode', '').isdigit() or not minimum or not target:
        raise ValueError('Incomplete actual APK package badging')
    return {'applicationId': attributes['name'], 'versionName': attributes['versionName'],
            'versionCode': int(attributes['versionCode']), 'minSdk': int(minimum[1]), 'targetSdk': int(target[1])}


def validate_badging(text, expected):
    actual = parse_badging(text)
    if actual['applicationId'] != 'com.mtt004.lightning':
        raise ValueError('Unexpected APK application ID')
    if actual['versionName'] != expected['version'] or actual['versionCode'] != expected['versionCode']:
        raise ValueError('Actual APK version differs from package.json')
    if actual['minSdk'] != 26 or actual['targetSdk'] != 35:
        raise ValueError('Unexpected APK SDK compatibility')
    return actual


def validate_instrumentation_xml(reports, installation):
    """Require raw all-passing XML for the named live-flight test, never JSON alone."""
    names = installation.get('reports')
    hashes = installation.get('reportChecksums')
    if not isinstance(names, list) or not names or len(set(names)) != len(names) or not isinstance(hashes, dict) or set(hashes) != set(names):
        raise ValueError('Raw Android report paths and checksums are required')
    cases = []
    for name in names:
        if not isinstance(name, str) or not name.startswith('android/app/build/outputs/androidTest-results/connected/') or '..' in Path(name).parts:
            raise ValueError('Unexpected instrumentation XML path')
        content = reports.get(name)
        if not isinstance(content, bytes) or hashlib.sha256(content).hexdigest() != hashes[name]:
            raise ValueError('Missing or mismatched raw Android instrumentation report')
        document = ET.fromstring(content)
        if document.tag not in {'testsuite', 'testsuites'} or not list(document.iter('testsuite')):
            raise ValueError('Unexpected instrumentation XML format')
        report_cases = list(document.iter('testcase'))
        if not report_cases:
            raise ValueError('No actual instrumentation test cases')
        for suite in document.iter():
            if suite.tag not in {'testsuite', 'testsuites'}:
                continue
            actual_count = len(list(suite.iter('testcase')))
            if (suite.tag == 'testsuite' or 'tests' in suite.attrib) and int(suite.get('tests', '-1')) != actual_count:
                raise ValueError('Instrumentation suite test count differs from XML cases')
            if any(int(suite.get(key, '0')) != 0 for key in ['failures', 'errors', 'skipped']):
                raise ValueError('Instrumentation suite records a failed, errored or skipped test')
        if any(any(case.find(kind) is not None for kind in ['failure', 'error', 'skipped']) for case in report_cases):
            raise ValueError('Raw Android instrumentation case did not pass')
        for error in document.iter('system-err'):
            if re.search(r'test run failed|expected \d+ tests, received 0|device .* not found', error.text or '', re.I):
                raise ValueError('Instrumentation XML records a lost or incomplete test run')
        cases.extend(report_cases)
    if not any(case.get('classname') == 'com.mtt004.lightning.OfflineLaunchTest' and
               case.get('name') == 'testBundledSimulatorLoadsAndStarts' for case in cases):
        raise ValueError('The actual live-flight instrumentation test is missing')
    if type(installation.get('tests')) is not int or installation['tests'] != len(cases):
        raise ValueError('Installation JSON count differs from raw XML')
    return {'tests': len(cases), 'rawReportChecksums': hashes, 'liveFlightTestPresent': True}


def validate_android_runtime_evidence(content, expected_version=None):
    """Validate the raw file written by the actual live-flight device test.

    This supplements the required passing instrumentation XML. A reported
    unsupported decoder is compatible only when dynamic London meshes rendered.
    Ratios describe the observed host; they are not physical-device acceptance.
    """
    if not isinstance(content, bytes) or not 1 <= len(content) <= 262144:
        raise ValueError('Missing or oversized actual Android runtime evidence')
    result = json.loads(content)
    if not isinstance(result, dict) or result.get('schemaVersion') != 1 or result.get('metric') != 'offline_london_runtime':
        raise ValueError('Unsupported Android runtime evidence schema')
    if expected_version is not None and result.get('version') != expected_version:
        raise ValueError('Android runtime version differs from the delivered APK')
    webview = result.get('webView', {})
    if not isinstance(webview, dict) or any(not isinstance(webview.get(k), str) or not webview[k].strip()
                                          for k in ['packageName', 'versionName', 'userAgent']):
        raise ValueError('Actual WebView package, version and user agent are required')
    if not isinstance(result.get('deviceModel'), str) or not result['deviceModel'].strip() or type(result.get('androidApi')) is not int or result['androidApi'] < 26:
        raise ValueError('Actual Android device/API metadata is required')
    world = result.get('world', {})
    if not isinstance(world, dict) or world.get('mode') != 'LONDON' or not isinstance(world.get('london'), dict) or type(world['london'].get('buildingTiles')) is not int or world['london']['buildingTiles'] < 1:
        raise ValueError('Actual offline London building meshes were not observed')
    prepared = result.get('prepared', {})
    if not isinstance(prepared, dict) or type(prepared.get('supported')) is not bool:
        raise ValueError('Prepared geometry support observation is required')
    for name in ['decoded', 'active', 'queued', 'failures']:
        if type(prepared.get(name)) is not int or prepared[name] < 0:
            raise ValueError('Invalid prepared geometry counter: ' + name)
    expected_path = 'prepared' if prepared['supported'] else 'dynamic-fallback'
    if result.get('geometryPath') != expected_path or (prepared['supported'] and prepared['decoded'] < 1):
        raise ValueError('Supported prepared geometry was not actually decoded')
    pending = result.get('geometryPending', {})
    if not isinstance(pending, dict) or any(type(pending.get(k)) is not int or pending[k] < 0 for k in ['prepared', 'buildings', 'queuedBuildings']):
        raise ValueError('Actual London geometry queue counts are required')

    def finite(value):
        return type(value) in {int, float} and math.isfinite(value)

    initial, later = result.get('initial', {}), result.get('later', {})
    for state in [initial, later]:
        if not isinstance(state, dict) or state.get('running') is not True or state.get('paused') is not False or state.get('crashed') is not False:
            raise ValueError('Runtime evidence lacks an active unpaused flight')
        if not finite(state.get('simT')) or not finite(state.get('simulationDebtSeconds')) or state['simulationDebtSeconds'] < 0 or type(state.get('stepCount')) is not int:
            raise ValueError('Runtime evidence lacks actual simulation clock/debt counters')
        renderer = state.get('renderer', {})
        if not isinstance(renderer, dict) or type(renderer.get('calls')) is not int or renderer['calls'] < 1:
            raise ValueError('Runtime evidence lacks actual WebGL scene draw calls')
        if not isinstance(state.get('position'), list) or len(state['position']) != 3 or not all(finite(v) for v in state['position']):
            raise ValueError('Runtime evidence has invalid aircraft position')
    if later['stepCount'] <= initial['stepCount'] or later['simT'] <= initial['simT']:
        raise ValueError('Runtime physics did not advance between actual observations')
    observation = result.get('observation', {})
    if not isinstance(observation, dict) or any(not finite(observation.get(k)) for k in ['wallSeconds', 'simulationSeconds', 'simulationToWallRatio', 'debtSeconds']) or observation['wallSeconds'] <= 0:
        raise ValueError('Actual simulation/wall-time observation is required')
    simulated = later['simT'] - initial['simT']
    for actual, expected in [(observation['simulationSeconds'], simulated),
                             (observation['simulationToWallRatio'], simulated / observation['wallSeconds']),
                             (observation['debtSeconds'], later['simulationDebtSeconds']),
                             ((later['stepCount'] - initial['stepCount']) / 120, simulated)]:
        if not math.isclose(actual, expected, rel_tol=1e-9, abs_tol=1e-8):
            raise ValueError('Android runtime timing metadata disagrees with its actual samples')
    return result


def collect_android_runtime_evidence(private_content, logcat_content, expected_version):
    """Prefer actual app-private bytes; otherwise recover exact logged JSON bytes.

    UTP can uninstall the target before the EXIT trap runs. The test also logs
    the same object with Log.i. Only the latest matching LightningQA record is
    eligible: a truncated or mismatched latest record cannot revive an old one.
    """
    try:
        validate_android_runtime_evidence(private_content, expected_version)
        return private_content, {'source': 'app-private', 'payloadSha256': hashlib.sha256(private_content).hexdigest()}
    except ValueError as error:
        private_error = str(error)
    if not isinstance(logcat_content, bytes) or len(logcat_content) > 32 * 1024 * 1024:
        raise ValueError('Missing or oversized actual Android logcat evidence')
    candidate = None
    for number, line in enumerate(logcat_content.splitlines(), 1):
        match = re.search(rb'\bI\s+LightningQA\s*:\s*(\{.*)$', line)
        if match and re.search(rb'"metric"\s*:\s*"offline_london_runtime"', match[1]):
            candidate = (match[1].rstrip(), number)
    if candidate is None:
        raise ValueError('No actual LightningQA runtime JSON record in logcat; app-private retrieval: ' + private_error)
    payload, number = candidate
    validate_android_runtime_evidence(payload, expected_version)
    return payload, {'source': 'logcat', 'payloadSha256': hashlib.sha256(payload).hexdigest(),
                     'rawLogcatSha256': hashlib.sha256(logcat_content).hexdigest(), 'rawLogcatLine': number,
                     'appPrivateValidationError': private_error}


def collect_android_runtime_files(directory, expected_version):
    """Retain raw retrievals and write validated exact runtime bytes plus provenance."""
    directory = Path(directory)
    private_path = directory / 'android-runtime-app-private.txt'
    output = directory / 'android-runtime.json'
    # Also supports already-downloaded evidence from the first collection format.
    if not private_path.is_file() and output.is_file():
        private_path.write_bytes(output.read_bytes())
    private = private_path.read_bytes() if private_path.is_file() else b''
    logcat = directory / 'android-logcat-final.txt'
    raw_log = logcat.read_bytes() if logcat.is_file() else b''
    output.unlink(missing_ok=True)
    payload, provenance = collect_android_runtime_evidence(private, raw_log, expected_version)
    output.write_bytes(payload)
    provenance.update({'appPrivateReport': private_path.name, 'rawLogcatReport': logcat.name,
                       'method': 'Exact validated app-private bytes or exact complete latest Log.i LightningQA JSON payload; no field synthesis'})
    (directory / 'android-runtime-provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')
    return provenance


def self_test():
    expected = {'version': '0.2.0-experimental', 'versionCode': 2}
    badging = "package: name='com.mtt004.lightning' versionCode='2' versionName='0.2.0-experimental'\nsdkVersion:'26'\ntargetSdkVersion:'35'\n"
    path = 'android/app/build/outputs/androidTest-results/connected/debug/TEST-device.xml'
    xml = b'<testsuite tests="1" failures="0" errors="0" skipped="0"><testcase classname="com.mtt004.lightning.OfflineLaunchTest" name="testBundledSimulatorLoadsAndStarts"/></testsuite>'
    def evidence(content=xml, count=1):
        return {'tests': count, 'reports': [path], 'reportChecksums': {path: hashlib.sha256(content).hexdigest()}}
    def must_fail(function):
        try:
            function()
        except (ValueError, ET.ParseError):
            return
        raise AssertionError('Invalid evidence unexpectedly passed')
    incomplete = b'<testsuites tests="2">' + xml + b'<testsuite name="incomplete" tests="1" failures="0" errors="0" skipped="0"/></testsuites>'
    aggregate_wrong = b'<testsuites tests="2">' + xml + b'</testsuites>'
    nested_valid = b'<testsuites tests="1"><testsuite tests="1">' + xml + b'</testsuite></testsuites>'
    runtime = {'schemaVersion': 1, 'metric': 'offline_london_runtime', 'version': expected['version'],
               'deviceModel': 'Emulator fixture', 'androidApi': 33,
               'webView': {'packageName': 'com.google.android.webview', 'versionName': '139.0.7258.0', 'userAgent': 'Android WebView fixture'},
               'world': {'mode': 'LONDON', 'london': {'buildingTiles': 1}},
               'prepared': {'supported': True, 'decoded': 1, 'active': 0, 'queued': 0, 'failures': 0},
               'geometryPath': 'prepared', 'geometryPending': {'prepared': 0, 'buildings': 0, 'queuedBuildings': 0},
               'initial': {'running': True, 'paused': False, 'crashed': False, 'stepCount': 120, 'simT': 1.0,
                           'simulationDebtSeconds': 0.0, 'renderer': {'calls': 1}, 'position': [0, 2, 0]},
               'later': {'running': True, 'paused': False, 'crashed': False, 'stepCount': 240, 'simT': 2.0,
                         'simulationDebtSeconds': 0.0, 'renderer': {'calls': 1}, 'position': [0, 2, 0]},
               'observation': {'wallSeconds': 1.0, 'simulationSeconds': 1.0, 'simulationToWallRatio': 1.0, 'debtSeconds': 0.0}}
    def validate_runtime(value=runtime, version=expected['version']):
        return validate_android_runtime_evidence(json.dumps(value).encode(), version)
    # Exact line retained from the genuine passing API 33 CI instrumentation:
    # WebView 101, three prepared tiles decoded. It is never regenerated here.
    actual_log = (ROOT / 'tests/fixtures/android-runtime-logcat.txt').read_bytes()
    actual_payload = actual_log.split(b'LightningQA: ', 1)[1].rstrip(b'\n')
    def actual_extraction():
        payload, provenance = collect_android_runtime_evidence(b'run-as: unknown package', actual_log, '0.5.0-experimental')
        assert payload == actual_payload
        assert provenance['source'] == 'logcat'
        assert provenance['rawLogcatSha256'] == hashlib.sha256(actual_log).hexdigest()
        assert validate_android_runtime_evidence(payload, '0.5.0-experimental')['prepared']['decoded'] == 3
    def prefer_private():
        original = json.dumps(runtime, indent=2).encode()
        payload, provenance = collect_android_runtime_evidence(original, actual_log, expected['version'])
        assert payload == original and provenance['source'] == 'app-private'
    checks = [
        lambda: must_fail(lambda: validate_instrumentation_xml({path: incomplete}, evidence(incomplete))),
        lambda: must_fail(lambda: validate_instrumentation_xml({path: aggregate_wrong}, evidence(aggregate_wrong))),
        lambda: validate_instrumentation_xml({path: nested_valid}, evidence(nested_valid)),
        lambda: validate_badging(badging, expected),
        lambda: must_fail(lambda: validate_badging(badging.replace("versionCode='2'", "versionCode='1'"), expected)),
        lambda: must_fail(lambda: validate_badging(badging.replace('0.2.0-experimental', '0.1.0-experimental'), expected)),
        lambda: must_fail(lambda: validate_badging('', expected)),
        lambda: validate_instrumentation_xml({path: xml}, evidence()),
        lambda: must_fail(lambda: validate_instrumentation_xml({}, {'status': 'PASS', 'tests': 1})),
        lambda: must_fail(lambda: validate_instrumentation_xml({path: xml}, evidence(count=2))),
        lambda: must_fail(lambda: validate_instrumentation_xml({path: b'corrupt'}, evidence())),
        lambda: must_fail(lambda: validate_instrumentation_xml({path: xml.replace(b'/>', b'><failure/></testcase>')}, evidence(xml.replace(b'/>', b'><failure/></testcase>')))),
        lambda: must_fail(lambda: validate_instrumentation_xml({path: xml.replace(b'tests="1"', b'tests="0"')}, evidence(xml.replace(b'tests="1"', b'tests="0"')))),
        lambda: validate_runtime(),
        lambda: validate_runtime({**runtime, 'prepared': {**runtime['prepared'], 'supported': False, 'decoded': 0}, 'geometryPath': 'dynamic-fallback'}),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'prepared': {**runtime['prepared'], 'decoded': 0}})),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'webView': {**runtime['webView'], 'versionName': ''}})),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'world': {'mode': 'LEGACY'}})),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'later': {**runtime['later'], 'paused': True}})),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'observation': {**runtime['observation'], 'simulationToWallRatio': 20}})),
        lambda: must_fail(lambda: validate_runtime({**runtime, 'geometryPath': 'dynamic-fallback'})),
        lambda: must_fail(lambda: validate_runtime(runtime, '0.5.0-experimental')),
        actual_extraction,
        prefer_private,
        lambda: must_fail(lambda: collect_android_runtime_evidence(b'', b'', '0.5.0-experimental')),
        lambda: must_fail(lambda: collect_android_runtime_evidence(b'', actual_log[:-100], '0.5.0-experimental')),
        lambda: must_fail(lambda: collect_android_runtime_evidence(b'', actual_log, '0.4.0-candidate.1')),
        lambda: must_fail(lambda: collect_android_runtime_evidence(b'', actual_log.replace(b'LightningQA:', b'OtherTag:'), '0.5.0-experimental')),
        lambda: must_fail(lambda: collect_android_runtime_evidence(b'', actual_log + actual_log[:-100], '0.5.0-experimental')),
    ]
    for check in checks:
        check()
    print(f'Android metadata/evidence self-test: {len(checks)}/{len(checks)} passed')


if __name__ == '__main__' and '--self-test' in sys.argv:
    self_test()
elif __name__ == '__main__' and len(sys.argv) == 3 and sys.argv[1] == '--collect-runtime':
    print(json.dumps(collect_android_runtime_files(Path(sys.argv[2]), read_project_metadata()['version']), indent=2))
