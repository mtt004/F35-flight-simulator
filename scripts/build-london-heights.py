#!/usr/bin/env python3
"""Derive building heights from pinned EA 2022 last-return DSM minus DTM.

Native 1 m EPSG:27700 WCS GeoTIFFs are cached and SHA256 pinned in sources.json.
No scenery data is modified: heights.json is an explicit measurement/fallback overlay.
Requires numpy, rasterio, requests and shapely (scripts/london-requirements.txt).
"""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import gzip
import hashlib
import json
import math
from pathlib import Path
import time

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds, Window
import requests
from shapely.geometry import Polygon, mapping, shape
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'ea-lidar-dsm-dtm-1m-2022'
DATASETS = {
    'dsm': ('9ba4d5ac-d596-445a-9056-dae3ddec0178', 'lidar-composite-digital-surface-model-last-return-dsm-1m', 'Lidar_Composite_Elevation_LZ_DSM_1m'),
    'dtm': ('13787b9a-26a4-4775-8523-806d13af58fc', 'lidar-composite-digital-terrain-model-dtm-1m', 'Lidar_Composite_Elevation_DTM_1m'),
}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def estimate_samples(dsm, dtm, inside, minimum=12):
    """Robust interior roof estimator. No maximum-height clamp is applied.

    A median/MAD fence removes isolated high returns (e.g. tree tips/antennae).
    The median of retained values favours the principal roof over high outliers.
    Inadequate coverage or mostly non-roof returns explicitly cause fallback.
    """
    mask = np.asarray(inside, dtype=bool)
    area = int(mask.sum())
    valid = mask & ~np.ma.getmaskarray(dsm) & ~np.ma.getmaskarray(dtm)
    d = np.asarray(np.ma.getdata(dsm), dtype=float)
    t = np.asarray(np.ma.getdata(dtm), dtype=float)
    valid &= np.isfinite(d) & np.isfinite(t)
    nvalid = int(valid.sum())
    coverage = nvalid / area if area else 0.0
    if nvalid < minimum or coverage < .7:
        return None, 'insufficient-valid-interior'
    delta = d[valid] - t[valid]
    positive = delta >= 2.0
    if positive.sum() < minimum or positive.mean() < .7:
        return None, 'insufficient-roof-support'
    values = delta[positive]
    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))
    fence = max(3.0, 4.0 * 1.4826 * mad)
    keep = np.abs(values - median) <= fence
    retained = values[keep]
    if retained.size < minimum:
        return None, 'insufficient-inliers'
    q10, q90 = np.quantile(retained, [.1, .9])
    height = float(np.median(retained))
    # The spread is roof variability, not claimed survey instrument accuracy.
    uncertainty = max(.3, float(q90 - q10) / 2)
    confidence = ('high' if retained.size >= 40 and coverage >= .9 and uncertainty <= 2
                  else 'medium' if uncertainty <= max(5, height * .35) else 'low')
    return {'height': round(height, 2), 'base': round(float(np.median(t[valid])), 2),
            'source': SOURCE, 'samples': int(retained.size), 'confidence': confidence,
            'validFraction': round(coverage, 3), 'uncertaintyM': round(uncertainty, 2),
            'rejectedSamples': int(nvalid - retained.size)}, None


def footprint(building):
    def world(ring):
        return [(507000 + x, 176000 - z) for x, z in ring]
    return Polygon(world(building['p']), [world(p) for p in building.get('holes', [])])


def measure(building, dsm, dtm):
    poly = footprint(building)
    inner = poly.buffer(-1.5)
    inset = 1.5
    if inner.is_empty or inner.area < 16:
        inner = poly.buffer(-.5)
        inset = .5
    if inner.is_empty:
        return None, 'footprint-too-narrow'
    if not (dsm.bounds.left <= inner.bounds[0] and dsm.bounds.bottom <= inner.bounds[1]
            and dsm.bounds.right >= inner.bounds[2] and dsm.bounds.top >= inner.bounds[3]):
        return None, 'footprint-crosses-source-coverage'
    window = from_bounds(*inner.bounds, transform=dsm.transform)
    # Integer outward rounding preserves pixel-centre inclusion at polygon edges.
    x0, y0 = math.floor(window.col_off), math.floor(window.row_off)
    x1, y1 = math.ceil(window.col_off + window.width), math.ceil(window.row_off + window.height)
    window = Window(x0, y0, x1-x0, y1-y0)
    a, b = dsm.read(1, window=window, masked=True), dtm.read(1, window=window, masked=True)
    inside = geometry_mask([mapping(inner)], out_shape=a.shape,
                           transform=dsm.window_transform(window), invert=True)
    result, reason = estimate_samples(a, b, inside)
    if result:
        result['insetM'] = inset
    return result, reason


def source_url(kind, bounds):
    uid, slug, name = DATASETS[kind]
    w, s, e, n = bounds
    params = [('service', 'WCS'), ('version', '2.0.1'), ('request', 'GetCoverage'),
              ('coverageId', uid + '__' + name), ('format', 'image/tiff'),
              ('subset', f'E({w},{e})'), ('subset', f'N({s},{n})')]
    return requests.Request('GET', f'https://environment.data.gov.uk/spatialdata/{slug}/wcs', params=params).prepare().url


def fetch(kind, bounds, cache, pins):
    key = f'{kind}-' + '-'.join(map(str, bounds)) + '.tif'
    path = cache / key
    pin = pins.get(key)
    if path.exists():
        actual = sha256(path)
        if pin and actual != pin['sha256']:
            raise RuntimeError(f'Cached source checksum mismatch: {key}')
    else:
        url = source_url(kind, bounds)
        partial = path.with_suffix('.part')
        for attempt in range(3):
            try:
                with requests.get(url, stream=True, timeout=(30, 240)) as response:
                    response.raise_for_status()
                    with open(partial, 'wb') as f:
                        for chunk in response.iter_content(1024 * 1024):
                            f.write(chunk)
                with rasterio.open(partial) as ds:
                    if ds.crs.to_epsg() != 27700 or ds.res != (1, 1) or tuple(ds.bounds) != tuple(bounds):
                        raise RuntimeError(f'Unexpected WCS grid: {key}, {ds.profile}')
                actual = sha256(partial)
                if pin and actual != pin['sha256']:
                    raise RuntimeError(f'Upstream data changed: {key}; refusing mutable source')
                partial.replace(path)
                break
            except (requests.RequestException, rasterio.errors.RasterioIOError):
                partial.unlink(missing_ok=True)
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    with rasterio.open(path) as ds:
        record = {'kind': kind, 'bounds': list(bounds), 'url': source_url(kind, bounds),
                  'bytes': path.stat().st_size, 'sha256': actual, 'crs': 'EPSG:27700',
                  'resolutionM': list(ds.res), 'nodata': ds.nodata}
    return key, record


def enrich_surveys(args, records, buildings, pins):
    """Attach the actual composite survey index at each footprint interior point."""
    surveys = {}
    trees = {}
    for kind in DATASETS:
        key = f'survey-index-{kind}.json'
        path = args.cache / key
        layer = 'LIDAR_Composite_1m_' + ('Last_Return_DSM' if kind == 'dsm' else 'DTM') + '_2022_extents'
        params = {'service':'WFS','version':'2.0.0','request':'GetFeature',
                  'typeNames':'dataset-9f0fa3fc-a860-4729-adc9-47fe53f658d0:'+layer,
                  'outputFormat':'application/json','srsName':'EPSG:27700',
                  'bbox':','.join(map(str,args.bounds))+',EPSG:27700','count':1000}
        url = requests.Request('GET','https://environment.data.gov.uk/spatialdata/survey-index-files/wfs',params=params).prepare().url
        if not path.exists():
            response = requests.get(url, timeout=(30,120))
            response.raise_for_status()
            path.write_bytes(response.content)
        actual = sha256(path)
        index = json.loads(path.read_text())
        # WFS timeStamp changes on every request; pin the scientific payload.
        features = sorted(index['features'], key=lambda f: f['properties']['filename'])
        content_hash = hashlib.sha256(json.dumps(features,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        if key in pins and pins[key].get('contentSha256') != content_hash:
            raise RuntimeError('Survey index content checksum mismatch: '+key)
        if index['numberMatched'] != len(index['features']):
            raise RuntimeError('Survey index was truncated; paginate the WFS request')
        pins[key] = {'kind':'survey-index-'+kind,'url':url,'bytes':path.stat().st_size,'sha256':actual,
                     'contentSha256':content_hash,'pinNote':'contentSha256 excludes volatile WFS response timeStamp; covers sorted full features including geometry.'}
        surveys[kind] = [dict(f['properties']) for f in index['features']]
        trees[kind] = [(f['properties']['filename'],prep(shape(f['geometry']))) for f in index['features']]
    unknown = {'dsm':0,'dtm':0}
    for building in buildings:
        record = records[building['id']]
        if record['source'] != SOURCE:
            continue
        point = footprint(building).representative_point()
        for kind in DATASETS:
            ids = sorted(name for name,poly in trees[kind] if poly.covers(point))
            record['survey'+kind.title()] = ids
            unknown[kind] += not bool(ids)
    output = args.output/'survey-index.json'
    output.write_text(json.dumps({'crs':'EPSG:27700','matchMethod':'Footprint representative interior point; survey boundaries may cross a footprint.',
                                  'surveys':surveys,'unmatchedMeasuredFootprints':unknown},indent=2,sort_keys=True)+'\n')
    dates = [p[k] for group in surveys.values() for p in group for k in ('sd_flown','ed_flown') if p.get(k)]
    return {'file':'survey-index.json','sha256':sha256(output),'surveyCounts':{k:len(v) for k,v in surveys.items()},
            'actualCoverageSurveyDateRange':[min(dates),max(dates)],'unmatchedMeasuredFootprints':unknown}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT/'scenery-packs/london/data.json.gz')
    parser.add_argument('--output', type=Path, default=ROOT/'scenery-packs/london-heights')
    parser.add_argument('--cache', type=Path, default=ROOT/'.tmp/london-lidar')
    parser.add_argument('--bounds', type=int, nargs=4, default=[502000,170000,541000,185000])
    parser.add_argument('--tile-size', type=int, default=5000)
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--download-only', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    args.cache.mkdir(parents=True, exist_ok=True)
    pins_path = args.output/'sources.json'
    pins = json.loads(pins_path.read_text()) if pins_path.exists() else {}
    w, s, e, n = args.bounds
    tiles = [(x, y, min(x+args.tile_size,e), min(y+args.tile_size,n))
             for x in range(w,e,args.tile_size) for y in range(s,n,args.tile_size)]
    # A 100 m margin covers the great majority of footprint crossings between tiles.
    padded = {b: (b[0]-100,b[1]-100,b[2]+100,b[3]+100) for b in tiles}
    jobs = [(kind, b) for b in padded.values() for kind in DATASETS]
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(fetch, kind, b, args.cache, pins) for kind,b in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            key, record = future.result()
            pins[key] = record
            pins_path.write_text(json.dumps(pins, indent=2, sort_keys=True)+'\n')
            print(f'Source {i}/{len(jobs)}: {key}', flush=True)
    if args.download_only:
        return
    data = json.loads(gzip.decompress(args.input.read_bytes()))
    buildings = data['buildings']
    groups = {b: [] for b in tiles}
    records = {}
    for building in buildings:
        centre = footprint(building).representative_point()
        key = (w + int((centre.x-w)//args.tile_size)*args.tile_size,
               s + int((centre.y-s)//args.tile_size)*args.tile_size)
        b = (key[0],key[1],min(key[0]+args.tile_size,e),min(key[1]+args.tile_size,n))
        if w <= centre.x < e and s <= centre.y < n and b in groups:
            groups[b].append(building)
        else:
            records[building['id']] = fallback(building, 'outside-downloaded-coverage')
    reasons = {}
    for index, (bounds, group) in enumerate(groups.items(), 1):
        paths = [args.cache/(kind+'-'+'-'.join(map(str,padded[bounds]))+'.tif') for kind in DATASETS]
        with rasterio.open(paths[0]) as dsm, rasterio.open(paths[1]) as dtm:
            if dsm.transform != dtm.transform or dsm.shape != dtm.shape:
                raise RuntimeError('DSM / DTM grids differ')
            for building in group:
                result, reason = measure(building,dsm,dtm)
                records[building['id']] = result or fallback(building,reason)
        print(f'Measured tile {index}/{len(groups)} ({len(group)} footprints)', flush=True)
    for r in records.values():
        if r['source'] != SOURCE:
            reasons[r['reason']] = reasons.get(r['reason'],0)+1
    measured = sum(r['source'] == SOURCE for r in records.values())
    survey_metadata = enrich_surveys(args, records, buildings, pins)
    pins_path.write_text(json.dumps(pins, indent=2, sort_keys=True)+'\n')
    raw = (json.dumps(records,separators=(',',':'),sort_keys=True)+'\n').encode()
    (args.output/'heights.json').write_bytes(raw)
    (args.output/'heights.json.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
    manifest = {'version': 1, 'source': SOURCE, 'inputSha256':sha256(args.input),
                'outputSha256':sha256(args.output/'heights.json'),
                'counts':{'total':len(records),'measured':measured,'fallback':len(records)-measured},
                'heightSourceCounts':{SOURCE:measured,'footprint-heuristic':len(records)-measured},
                'confidenceCounts':{c:sum(r['confidence']==c for r in records.values()) for c in ['high','medium','low','fallback']},
                'fallbackReasons':reasons,'coverageBoundsBNG':args.bounds,'tileMarginM':100,
                'horizontalCRS':'EPSG:27700','verticalDatum':'ODN (EPSG:5701), OSTN15',
                'units':'metres','nativeResolutionM':1,'compositeEdition':2022,
                'surveyDateRange':['2000-06-06','2022-04-02'],
                'surveyDatesNote':'surveyDsm/surveyDtm identify the official composite survey index at each footprint interior point. Exact date ranges and input survey names are in survey-index.json; survey boundaries may cross a footprint.',
                'surveyIndex':survey_metadata,
                'instrumentAccuracy':'EA states individual input surveys +/-0.15 m RMSE vertically; derived building heights have additional footprint, roof, vegetation and temporal mismatch errors.',
                'method':'Buffer footprint inward 1.5 m (0.5 m for narrow footprints); native pixel-centre inclusion; paired valid DSM/DTM >=70% and >=12 samples; >=70% support for returns >=2 m; median/MAD 4-sigma fence (minimum 3 m); median retained DSM-DTM. No maximum height cap.',
                'uncertainty':'uncertaintyM = max(0.3 m, half retained P90-P10); descriptive roof spread, not a calibrated confidence interval. Trees occupying most of a footprint can remain undetected.',
                'fallback':'Original footprint-based extrusion h retained, explicitly labelled footprint-heuristic; base=null and samples=0. No inferred height is labelled measured.',
                'datasetMetadata':{k:f'https://environment.data.gov.uk/dataset/{v[0]}' for k,v in DATASETS.items()},
                'licence':'OGL-UK-3.0','sourcePinFile':'sources.json','sourceCount':len(jobs),
                'heightSummaryM':{k:round(float(v),2) for k,v in zip(['min','median','p95','max'], np.quantile([r['height'] for r in records.values() if r['source']==SOURCE],[0,.5,.95,1]))} if measured else {}}
    (args.output/'NOTICE.txt').write_text('© Environment Agency copyright and/or database right 2022. All rights reserved.\nContains public sector information licensed under the Open Government Licence v3.0.\nhttps://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/\nBuilding footprints contain OS data © Crown copyright and database right 2026.\nDerived heights use EA LIDAR Composite last-return DSM and DTM, 1 metre, 2022 edition.\nHorizontal EPSG:27700; elevations metres Ordnance Datum Newlyn (ODN).\nRoof estimates are approximate and are not survey-certified building measurements.\nFallback heights are explicitly identified in heights.json; consult manifest.json for limitations.\n')
    manifest['outputs'] = {name:{'file':name,'sha256':sha256(args.output/name),'bytes':(args.output/name).stat().st_size}
                           for name in ['heights.json.gz','NOTICE.txt','sources.json','survey-index.json']}
    manifest['uncompressedHeights'] = {'file':'heights.json','sha256':sha256(args.output/'heights.json'),'bytes':(args.output/'heights.json').stat().st_size}
    (args.output/'manifest.json').write_text(json.dumps(manifest,indent=2,sort_keys=True)+'\n')
    print(json.dumps(manifest['counts']),flush=True)


def fallback(building, reason):
    return {'height':building['h'],'base':None,'source':'footprint-heuristic',
            'samples':0,'confidence':'fallback','reason':reason}


if __name__ == '__main__':
    main()
