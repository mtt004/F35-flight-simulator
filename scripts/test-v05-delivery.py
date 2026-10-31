#!/usr/bin/env python3
"""Synthetic negative controls for immutable baseline restoration."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('restore-v04-scenery.py'))
restore = importlib.util.module_from_spec(spec)
spec.loader.exec_module(restore)
spec = importlib.util.spec_from_file_location('delivery', Path(__file__).with_name('package-v05.py'))
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)


class DeliveryGateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.browser = Path(self.temp.name) / 'browser'
        self.directory = self.browser / 'benchmarks/london-v0.5'
        self.directory.mkdir(parents=True)
        self.manifest = {'sha256': 'final-html-sha'}
        self.source = 'delivered-source-sha'
        self.reports = {
            'verification.json': {'status': 'PASS', 'scenePairs': 12, 'checks': [
                {'name': 'paired-render-observations', 'status': 'PASS'}, {'name': 'matched-visual-regression', 'status': 'PASS'}]},
            'paired-render.json': {'status': 'MEASURED', 'sourceCommit': self.source,
                'baselineSourceCommit': restore.BASELINE_SOURCE, 'sources': {
                    'before': {'sha256': 'f1f6a9e9b19c0bc8210b5bab4ef91e9b03c854f0b895cda0c965ae6779a45aad'},
                    'after': self.manifest}, 'repeats': 3, 'secondsPerRun': 10, 'errors': [], 'scenarios': [], 'shots': []},
            'visual-comparison.json': {'status': 'PASS', 'images': []},
            'endurance.json': {'status': 'COMPLETED_WITHOUT_OBSERVED_FLIGHT_FAILURE', 'completed': True,
                'requestedWallSeconds': 1200, 'elapsedWallSeconds': 1200.1, 'sourceSha256': self.manifest['sha256'],
                'errors': [], 'assessment': {'issues': []}, 'samples': [{'wall': 1}, {'wall': 1200001}]},
        }
        for i in range(12):
            name = 'synthetic-' + str(i)
            state = {'scenery': {'buildings': 1, 'buildingTiles': 1, 'groundTiles': 2, 'lods': [1, 0, 0]},
                     'memory': {'sceneGeometryObjects': 3, 'geometryAttributeBytes': 48, 'indexBytes': 0},
                     'renderer': {'calls': 3, 'triangles': 1, 'points': 0, 'lines': 0}}
            self.reports['paired-render.json']['scenarios'].append({'name': name,
                'states': {label: json.loads(json.dumps(state)) for label in ['before', 'after']},
                'warm': {label: {'expectedGroundTiles': 2, 'stats': {'groundTiles': 2}} for label in ['before', 'after']}, 'runs': {
                label: [{'raw': {'intervals': [30, 31]}} for _ in range(3)] for label in ['before', 'after']}})
            for label in ['before', 'after']:
                relative = 'screenshots/london-v0.5/' + label + '/' + name + '.png'
                path = self.browser / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'synthetic image bytes; comparator tested independently')
                self.reports['paired-render.json']['shots'].append({'name': name, 'label': label,
                    'file': relative, 'sha256': delivery.sha(path)})
            self.reports['visual-comparison.json']['images'].append({'name': name, 'status': 'PASS',
                'ssim': 1, 'dimensions': [1152, 648], 'regions': [{'ssim': 1}] * 9})
        geometry_path = self.browser / 'scenery-packs/london-geometry/manifest.json'
        geometry_path.parent.mkdir(parents=True)
        prepared = {'inputPins': {'vectorData': '82088ac9a9e4e7c8cc106175cd62607b77c10f9cf7cf5c7fbcb79c238b36092c',
                                 'heightData': '16705679a6df69a7065acea68ec27d62fdd5c8caf90ba5b19f0f640f239959fc'},
                    'sourceHashes': {str(i): 'synthetic-source-hash' for i in range(6)},
                    'tiles': {str(i): {} for i in range(866)}}
        geometry_path.write_text(json.dumps(prepared))
        self.reports['prepared-equivalence.json'] = {'status': 'PASS', 'errors': [], 'checked': 866,
            'manifestSha256': delivery.sha(geometry_path), 'baselineSourceCommit': restore.BASELINE_SOURCE,
            'inputHashes': prepared['inputPins'], 'sourceHashes': prepared['sourceHashes']}
        self.write_reports()

    def tearDown(self):
        self.temp.cleanup()

    def write_reports(self):
        for name, report in self.reports.items():
            (self.directory / name).write_text(json.dumps(report))

    def validate(self):
        return delivery.validate_browser_gates(self.browser, self.manifest, self.source)

    def test_complete_individual_gates_validate(self):
        self.assertEqual(self.validate()['preparedTiles'], 866)

    def test_passing_json_wrappers_cannot_replace_individual_evidence(self):
        for name in self.reports:
            with self.subTest(report=name):
                previous = self.reports[name]
                self.reports[name] = {'status': previous['status']}
                self.write_reports()
                with self.assertRaises((ValueError, KeyError)):
                    self.validate()
                self.reports[name] = previous
        self.write_reports()

    def test_failed_gate_rejected_before_any_delivery_is_copied(self):
        self.reports['verification.json'] = {'status': 'PASS'}
        self.write_reports()
        (self.browser / 'dist').mkdir()
        (self.browser / 'dist/build-manifest.json').write_text(json.dumps(self.manifest))
        destination = Path(self.temp.name) / 'delivery'
        with self.assertRaisesRegex(ValueError, 'wrapper lacks'):
            delivery.package(self.browser, Path(self.temp.name) / 'absent-android', destination, self.source)
        self.assertFalse(destination.exists())

    def test_other_html_or_incomplete_endurance_is_rejected(self):
        self.reports['endurance.json']['sourceSha256'] = 'another-html'
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'twenty-minute'):
            self.validate()
        self.reports['endurance.json']['sourceSha256'] = self.manifest['sha256']
        self.reports['endurance.json']['samples'] = [{'wall': 1}, {'wall': 1001}]
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'twenty-minute'):
            self.validate()

    def test_capture_artifact_tampering_is_rejected(self):
        shot = self.reports['paired-render.json']['shots'][0]
        (self.browser / shot['file']).write_bytes(b'tampered')
        with self.assertRaisesRegex(ValueError, 'capture is missing or differs'):
            self.validate()

    def test_short_benchmark_and_partial_geometry_are_rejected(self):
        self.reports['paired-render.json']['repeats'] = 1
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'repeated controlled'):
            self.validate()
        self.reports['paired-render.json']['repeats'] = 3
        self.reports['prepared-equivalence.json']['checked'] = 1
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'byte-equivalence'):
            self.validate()

    def test_stable_buildings_cannot_hide_unfinished_road_queue(self):
        scene = self.reports['paired-render.json']['scenarios'][0]
        scene['warm']['after']['stats']['groundTiles'] = 1
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'incomplete local road'):
            self.validate()
        scene['warm']['after']['stats']['groundTiles'] = 2
        scene['states']['after']['renderer']['triangles'] = 0
        self.write_reports()
        with self.assertRaisesRegex(ValueError, 'different geometry'):
            self.validate()

    def test_android_runtime_requires_matching_raw_webview_and_clock_observations(self):
        initial = {'running': True, 'paused': False, 'crashed': False, 'simT': 1, 'stepCount': 120,
                   'simulationDebtSeconds': 0, 'renderer': {'calls': 1}, 'position': [0, 10, 0]}
        runtime = {'schemaVersion': 1, 'metric': 'offline_london_runtime', 'version': 'synthetic-version',
            'deviceModel': 'synthetic-device', 'androidApi': 33,
            'webView': {'packageName': 'synthetic-webview', 'versionName': '1', 'userAgent': 'synthetic-UA'},
            'world': {'mode': 'LONDON', 'london': {'buildingTiles': 1}},
            'prepared': {'supported': True, 'decoded': 1, 'active': 0, 'queued': 0, 'failures': 0},
            'geometryPath': 'prepared', 'geometryPending': {'prepared': 0, 'buildings': 0, 'queuedBuildings': 0},
            'initial': initial, 'later': {**initial, 'simT': 2, 'stepCount': 240},
            'observation': {'wallSeconds': 1, 'simulationSeconds': 1, 'simulationToWallRatio': 1, 'debtSeconds': 0}}
        path = self.browser / delivery.ANDROID_RUNTIME
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(runtime))
        record = {'runtimeReport': delivery.ANDROID_RUNTIME, 'runtimeSha256': delivery.sha(path), 'runtime': runtime}
        self.assertEqual(delivery.load_android_runtime(self.browser, record, 'synthetic-version'), runtime)
        path.write_text(json.dumps({'status': 'PASS'}))
        with self.assertRaisesRegex(ValueError, 'differs from installation'):
            delivery.load_android_runtime(self.browser, record, 'synthetic-version')
        record['runtimeSha256'] = delivery.sha(path)
        with self.assertRaisesRegex(ValueError, 'schema'):
            delivery.load_android_runtime(self.browser, record, 'synthetic-version')


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.previous = Path.cwd()
        os.chdir(self.temp.name)
        self.assets = Path('assets')
        self.assets.mkdir()
        self.old_pins = dict(restore.PINS)

    def tearDown(self):
        restore.PINS.clear()
        restore.PINS.update(self.old_pins)
        os.chdir(self.previous)
        self.temp.cleanup()

    def fixture(self, corrupt_output=False, mismatch_heights=False, unsafe=False):
        digest = lambda data: hashlib.sha256(data).hexdigest()
        data = b'synthetic immutable source data'
        pin = {'bytes': len(data), 'sha256': digest(data)}
        path = self.assets / 'Lightning-London-Scenery.zip'
        with zipfile.ZipFile(path, 'w') as archive:
            for pack in ['london', 'london-imagery', 'london-heights']:
                name = 'data.json.gz' if pack == 'london' else 'synthetic.txt'
                manifest = {'outputs': {name: pin}}
                if pack == 'london-heights':
                    manifest['inputSha256'] = 'wrong' if mismatch_heights else digest(data)
                archive.writestr(pack + '/manifest.json', json.dumps(manifest))
                archive.writestr(pack + '/' + name, b'corrupt' if corrupt_output else data)
            if unsafe:
                archive.writestr('../escaped.txt', b'escape')
        restore.PINS[path.name] = digest(path.read_bytes())
        browser = self.assets / 'Lightning-F35B-Web.zip'
        with zipfile.ZipFile(browser, 'w') as archive:
            archive.writestr('Lightning-F35B.html', '<!doctype html><title>synthetic baseline</title>')
        restore.PINS[browser.name] = digest(browser.read_bytes())

    def run_restore(self, **kwargs):
        with contextlib.redirect_stdout(io.StringIO()):
            restore.restore(self.assets, **kwargs)

    def test_verified_outputs_and_baseline_recover_identical_bytes(self):
        self.fixture()
        self.run_restore(include_browser=True)
        self.assertEqual(Path('scenery-packs/london/data.json.gz').read_bytes(), b'synthetic immutable source data')
        report = json.loads(Path('benchmarks/london-v0.5/input-restoration.json').read_text())
        self.assertEqual(report['verifiedOutputs']['baselineHtml']['sha256'], hashlib.sha256(Path('dist/v04-baseline.html').read_bytes()).hexdigest())

    def test_published_archive_digest_cannot_be_bypassed(self):
        self.fixture()
        path = self.assets / 'Lightning-London-Scenery.zip'
        path.write_bytes(path.read_bytes() + b'tampered')
        with self.assertRaisesRegex(ValueError, 'immutable pin'):
            self.run_restore()
        self.assertFalse(Path('scenery-packs').exists())

    def test_each_manifest_output_is_checked_before_restoration(self):
        self.fixture(corrupt_output=True)
        with self.assertRaisesRegex(ValueError, 'source manifest'):
            self.run_restore()
        self.assertFalse(Path('scenery-packs').exists())

    def test_heights_for_other_footprints_are_rejected(self):
        self.fixture(mismatch_heights=True)
        with self.assertRaisesRegex(ValueError, 'different building footprints'):
            self.run_restore()
        self.assertFalse(Path('scenery-packs').exists())

    def test_archive_path_escape_is_rejected(self):
        self.fixture(unsafe=True)
        with self.assertRaisesRegex(ValueError, 'Unsafe archive path'):
            self.run_restore()
        self.assertFalse(Path('escaped.txt').exists())


if __name__ == '__main__':
    unittest.main()
