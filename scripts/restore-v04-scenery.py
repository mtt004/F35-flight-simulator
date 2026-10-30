#!/usr/bin/env python3
"""Restore immutable v0.4 processed inputs; never fetch mutable GIS providers."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile

PINS = {
    'Lightning-London-Scenery.zip': 'fee4f9f6ca37baa2dc56d28ed26b3533f0cd929f3aed30f75c69bcf46171d32c',
    'Lightning-F35B-Web.zip': '536c8958b7b01753d67ab557df681a7cfaf68ca6127875f297bfd8ef9fe49b73',
}
BASELINE_SOURCE = 'ca330131115ee983a6457efa33ff513ac34803ad'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def pinned(path):
    data = path.read_bytes()
    if digest(data) != PINS[path.name]:
        raise ValueError('Published v0.4 archive differs from immutable pin: ' + path.name)
    return data


def restore(directory, include_browser=False):
    scenery = directory / 'Lightning-London-Scenery.zip'
    pinned(scenery)
    records = {}
    with zipfile.ZipFile(scenery) as archive:
        if archive.testzip() is not None:
            raise ValueError('Corrupt v0.4 scenery ZIP')
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate archive entries')
        for name in names:
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name:
                raise ValueError('Unsafe archive path: ' + name)
        manifests = {}
        for pack in ['london', 'london-imagery', 'london-heights']:
            manifest = json.loads(archive.read(pack + '/manifest.json'))
            manifests[pack] = manifest
            for name, pin in manifest['outputs'].items():
                if Path(name).name != name:
                    raise ValueError('Unsafe manifest output: ' + name)
                data = archive.read(pack + '/' + name)
                if len(data) != pin['bytes'] or digest(data) != pin['sha256']:
                    raise ValueError('Scenery output differs from source manifest: ' + pack + '/' + name)
                records[pack + '/' + name] = pin
        if manifests['london-heights']['inputSha256'] != manifests['london']['outputs']['data.json.gz']['sha256']:
            raise ValueError('LiDAR heights were produced for different building footprints')
        dest = Path('scenery-packs')
        for name in names:
            if name.endswith('/'):
                continue
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(name))
    if include_browser:
        browser = directory / 'Lightning-F35B-Web.zip'
        pinned(browser)
        with zipfile.ZipFile(browser) as archive:
            if archive.namelist() != ['Lightning-F35B.html'] or archive.testzip() is not None:
                raise ValueError('Unexpected baseline browser archive')
            data = archive.read('Lightning-F35B.html')
        Path('dist').mkdir(exist_ok=True)
        Path('dist/v04-baseline.html').write_bytes(data)
        records['baselineHtml'] = {'bytes': len(data), 'sha256': digest(data)}
    result = {'status': 'PASS', 'baselineSourceCommit': BASELINE_SOURCE,
              'archivePins': PINS, 'verifiedOutputs': records,
              'method': 'Immutable published v0.4 archive hashes, every processed output hash, and footprint/height linkage verified before restoration.'}
    Path('benchmarks/london-v0.5').mkdir(parents=True, exist_ok=True)
    Path('benchmarks/london-v0.5/input-restoration.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': 'PASS', 'outputs': len(records), 'baselineSourceCommit': BASELINE_SOURCE}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--browser', action='store_true')
    args = parser.parse_args()
    restore(args.directory, args.browser)
