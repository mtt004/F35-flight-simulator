#!/usr/bin/env python3
"""Summarize measured browser endurance; never infer physical-device metrics."""
import json
from pathlib import Path
import sys

root = Path(sys.argv[1])
report = json.loads((root / 'sustained-report.json').read_text())
progress = json.loads((root / 'progress.json').read_text())
assert report['status'] == 'MEASURED', report.get('blocker', report['status'])
assert progress['status'] == 'COMPLETE'
assert report['sourceSha256'] == progress['sourceSha256']
assert len(report['scenarios']) == 1 and not report['errors']
s = report['scenarios'][0]
p = progress['samples']
assert p and p[-1]['elapsedWallSeconds'] >= progress['secondsRequested']
assert len(s['samples']['intervals']) == s['frames'] - 1

def span(key):
    values = [v[key] for v in p if v.get(key) is not None]
    return {'min': min(values), 'max': max(values)} if values else None

first = next((v for v in p if v['elapsedWallSeconds'] >= 300), None)
last_start = next((v for v in p if v['elapsedWallSeconds'] >= p[-1]['elapsedWallSeconds'] - 300), None)
summary = {
    'status': 'MEASURED', 'sourceSha256': report['sourceSha256'],
    'environment': report['environment'], 'host': report['host'],
    'elapsedWallSeconds': p[-1]['elapsedWallSeconds'],
    'simulatedSeconds': s['after']['flightT'] - s['before']['flightT'],
    'frames': s['frames'], 'intervals': len(s['samples']['intervals']),
    'meanFps': s['meanFps'], 'medianFps': s['medianFps'], 'onePercentLowFps': s['onePercentLowFps'],
    'frameMs': s['frameMs'], 'renderSubmissionMs': s['renderSubmissionMs'],
    'stuttersOver100ms': s['stuttersOver100ms'],
    'firstApproximatelyFiveMinuteFps': first['frames'] / first['elapsedWallSeconds'] if first else None,
    'lastApproximatelyFiveMinuteFps': (p[-1]['frames'] - last_start['frames']) / (p[-1]['elapsedWallSeconds'] - last_start['elapsedWallSeconds']) if last_start and last_start is not p[-1] else None,
    'sampledHeapBytes': span('heapBytes'), 'sampledGeometries': span('geometry'), 'sampledTextures': span('textures'),
    'firstSampleResources': {k: p[0][k] for k in ['geometry', 'textures', 'heapBytes']},
    'lastSampleResources': {k: p[-1][k] for k in ['geometry', 'textures', 'heapBytes']},
    'resourceTrendLimit': 'Counters fluctuate and may end above the first sample during streaming; this run cannot distinguish retained scenery/cache growth from a leak.',
    'sampledQualityLevels': sorted({v['quality'] for v in p}),
    'adaptiveDetailVisibleSamples': sum(v['adaptiveModelVisible'] is True for v in p), 'minuteSamples': len(p),
    'crashObserved': s['after']['crashed'] or any(v['crashed'] for v in p),
    'javascriptOrShaderErrors': report['errors'],
    'target30FpsMetOnThisHost': s['meanFps'] >= 30,
    'galaxyA51': 'NOT TESTED',
    'physicalDeviceMetrics': {k: report.get(k) for k in ['androidPssMb', 'gpuTimeMs', 'battery', 'thermal', 'inputLatencyMs']},
    'limits': [
        'Cloud software renderer only; wall-time renderer operation is not equal simulated flight duration.',
        'Minute samples are not continuous high-water marks. Browser heap may be quantized; neither heap nor Three counters establish absence of leaks or whole-app/native/GPU/PSS memory.',
        'If detail is hidden at every minute sample, this is fallback/default-governor endurance, not sustained high-detail-model qualification.',
        'Submission timing is synchronous JavaScript/driver submission, not asynchronous GPU execution. No A51 thermal/battery/FPS inference.',
        'Summary is implementer-generated from retained raw data, not an additional independent device test.'
    ]
}
(root / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary, indent=2))
