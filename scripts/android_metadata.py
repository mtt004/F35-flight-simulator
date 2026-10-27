"""Shared, SDK-independent validation of version badging and raw test evidence."""
import hashlib
import json
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
    ]
    for check in checks:
        check()
    print(f'Android metadata/evidence self-test: {len(checks)}/{len(checks)} passed')


if __name__ == '__main__' and '--self-test' in sys.argv:
    self_test()
