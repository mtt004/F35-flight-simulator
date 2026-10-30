#!/usr/bin/env python3
"""Compare matched intrinsic WebGL framebuffer captures; no image resizing."""
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / 'benchmarks/london-v0.5'
SHOTS = ROOT / 'screenshots/london-v0.5'


def compare(before, after):
    if before.shape != after.shape or before.ndim != 3 or before.shape[2] != 3:
        raise ValueError('Matched RGB image dimensions are required; resizing is forbidden')
    delta = np.abs(before.astype(np.int16) - after.astype(np.int16))
    identical = not np.any(delta)
    score = 1.0 if identical else float(structural_similarity(before, after, data_range=255, channel_axis=2))
    regions = []
    # A high whole-frame SSIM may hide one missing building. Every fixed 3x3
    # region also has a strict threshold, and all difference images are retained.
    for row in range(3):
        for col in range(3):
            h, w = before.shape[:2]
            box = [col*w//3, row*h//3, (col+1)*w//3, (row+1)*h//3]
            x0, y0, x1, y1 = box
            a, b = before[y0:y1, x0:x1], after[y0:y1, x0:x1]
            local = 1.0 if np.array_equal(a, b) else float(structural_similarity(a, b, data_range=255, channel_axis=2))
            regions.append({'box': box, 'ssim': local})
    return {'pixelEquivalent': identical, 'ssim': score,
            'meanAbsoluteChannelError': float(delta.mean()),
            'maxAbsoluteChannelError': int(delta.max()),
            'changedPixels': int(np.any(delta, axis=2).sum()),
            'changedPixelPercent': float(np.any(delta, axis=2).mean()*100),
            'regions': regions,
            'status': 'PASS' if score >= .995 and all(r['ssim'] >= .99 for r in regions) else 'FAIL'}, delta


def main():
    if '--self-test' in sys.argv:
        a = np.full((99, 99, 3), 100, dtype=np.uint8)
        assert compare(a, a)[0]['pixelEquivalent']
        b = a.copy(); b[0:25, 0:25] = 255
        assert compare(a, b)[0]['status'] == 'FAIL'
        try:
            compare(a, b[:50])
        except ValueError:
            pass
        else:
            raise AssertionError('Mismatched dimensions accepted')
        print('Visual-comparison self-test: 3/3 passed')
        return 0
    report = {'schema': 1, 'status': 'FAIL', 'thresholds': {'wholeFrameSSIM': .995, 'eachFixedRegionSSIM': .99},
              'method': 'Exact intrinsic framebuffer PNGs, RGB, no resizing, SSIM plus every fixed3x3 region and amplified absolute difference images.',
              'limits': ['SSIM is an automated screen, not proof that every building, height or material is correct.',
                         'Inspect sensitive landmark/roof/shadow difference regions and geometry byte-equivalence reports before release.',
                         'These are controlled software-renderer captures, not physical Android GPU validation.'], 'images': []}
    verification = {'schema': 1, 'status': 'FAIL', 'checks': []}
    try:
        timing = json.loads((REPORT / 'paired-render.json').read_text())
        names = {r['name'] for r in timing['shots'] if r['label'] == 'before'}
        after_names = {r['name'] for r in timing['shots'] if r['label'] == 'after'}
        if names != after_names or len(names) < 12:
            raise ValueError('At least twelve complete matched scene pairs are required')
        (SHOTS / 'diff').mkdir(parents=True, exist_ok=True)
        for name in sorted(names):
            paths = {label: SHOTS / label / (name + '.png') for label in ['before', 'after']}
            arrays = {}
            for label, file in paths.items():
                pin = next(r['sha256'] for r in timing['shots'] if r['label'] == label and r['name'] == name)
                if hashlib.sha256(file.read_bytes()).hexdigest() != pin:
                    raise ValueError(f'{name}/{label}: capture bytes differ from render report')
                arrays[label] = np.asarray(Image.open(file).convert('RGB'))
            result, delta = compare(arrays['before'], arrays['after'])
            if list(arrays['before'].shape[:2]) != [648, 1152]:
                raise ValueError(name + ': unexpected intrinsic rendering resolution')
            difference = np.minimum(255, delta.astype(np.uint16)*8).astype(np.uint8)
            output = SHOTS / 'diff' / (name + '.png')
            Image.fromarray(difference).save(output)
            result.update({'name': name, 'dimensions': [1152, 648], 'differenceAmplification': 8,
                           'differenceFile': output.relative_to(ROOT).as_posix()})
            report['images'].append(result)
        report['status'] = 'PASS' if all(r['status'] == 'PASS' for r in report['images']) else 'FAIL'
        verification['checks'] = [
            {'name': 'paired-render-observations', 'status': 'PASS' if timing['status'] == 'MEASURED' else 'FAIL'},
            {'name': 'matched-visual-regression', 'status': report['status']},
            {'name': 'physical-galaxy-a51', 'status': 'NOT_TESTED'}]
        verification['status'] = 'PASS' if timing['status'] == 'MEASURED' and report['status'] == 'PASS' else 'FAIL'
        verification['scope'] = 'Controlled browser render/visual checks only. Other mandatory tests, Android emulator, source integrity and sustained-flight evidence are separate release gates.'
        verification['pixelEquivalentPairs'] = sum(r['pixelEquivalent'] for r in report['images'])
        verification['scenePairs'] = len(report['images'])
        verification['renderReport'] = 'paired-render.json'
        verification['visualReport'] = 'visual-comparison.json'
    except Exception as error:
        report['error'] = str(error)
        verification['error'] = str(error)
    REPORT.mkdir(parents=True, exist_ok=True)
    (REPORT / 'visual-comparison.json').write_text(json.dumps(report, indent=2) + '\n')
    (REPORT / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')
    print(json.dumps(verification, indent=2))
    return 0 if verification['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
