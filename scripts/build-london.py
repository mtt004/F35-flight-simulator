#!/usr/bin/env python3
"""Build a pinned, reproducible British National Grid scenery pack.

Requires Python 3.10+, pyshp, shapely, Pillow and pyproj. See docs/london-data.md.
Downloads are deliberately immutable: a changed upstream edition is an error.
"""
from __future__ import annotations
import argparse
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
import statistics
import subprocess
import sys
import zipfile
import warnings

import shapefile
from shapely.geometry import Point, Polygon, box, shape
from shapely.validation import make_valid

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.tmp/london'
DEFAULT_OUTPUT = ROOT / 'scenery-packs/london'
B = (502000, 170000, 541000, 185000)
CLIP = box(*B)
VERSION = 3
SOURCES = {
    'openmap-tq.zip': {
        'product': 'OS OpenMap Local, TQ, ESRI Shapefile',
        'url': 'https://api.os.uk/downloads/v1/products/OpenMapLocal/downloads?area=TQ&format=ESRI%C2%AE+Shapefile&redirect',
        'bytes': 230809695,
        'md5': 'bf58528c496370c0ddd0f13048fe549a',
        'sha256': '1a89682919a6e1d96255d4dd8bb273a08a667fe3a5ab3d4c4bed3ef408565ea1',
    },
    'terrain50-gb.zip': {
        'product': 'OS Terrain 50, GB, ASCII Grid and GML',
        'url': 'https://api.os.uk/downloads/v1/products/Terrain50/downloads?area=GB&format=ASCII+Grid+and+GML+%28Grid%29&redirect',
        'bytes': 161706566,
        'md5': 'feba9008db55cdcb5c5e5b7896e3428b',
        'sha256': 'd03e91d3adcf5927b2f2e2ef0d7b6ccf18a2e63728d6ebef83c6c9aa2a3c64a7',
    },
}
NOTICE = '''Contains OS data © Crown copyright and database right 2026.
Contains public sector information licensed under the Open Government Licence v3.0.
OS OpenMap Local and OS Terrain 50 are Ordnance Survey OpenData products.
https://www.ordnancesurvey.co.uk/products/os-openmap-local
https://www.ordnancesurvey.co.uk/products/os-terrain-50
https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
British National Grid EPSG:27700; heights metres ODN (EPSG:5701).
Ground artwork is derived from map vectors; it is not aerial imagery.
Building extrusion heights and water levels are assumptions, not surveyed data.
'''
# SPDX identifier: OGL-UK-3.0. Complete licence text, with plain-text formatting.
OGL = '''Open Government Licence for public sector information
You are encouraged to use and re-use the Information that is available under this
licence freely and flexibly, with only a few conditions.

Using Information under this licence
Use of copyright and database right material expressly made available under this
licence (the 'Information') indicates your acceptance of the terms and conditions
below.
The Licensor grants you a worldwide, royalty-free, perpetual, non-exclusive licence
to use the Information subject to the conditions below.
This licence does not affect your freedom under fair dealing or fair use or any
other copyright or database right exceptions and limitations.

You are free to:
- copy, publish, distribute and transmit the Information;
- adapt the Information;
- exploit the Information commercially and non-commercially for example, by
  combining it with other Information, or by including it in your own product or
  application.

You must (where you do any of the above):
- acknowledge the source of the Information in your product or application by
  including or linking to any attribution statement specified by the Information
  Provider(s) and, where possible, provide a link to this licence;
If the Information Provider does not provide a specific attribution statement, you
must use the following:
Contains public sector information licensed under the Open Government Licence v3.0.
If you are using Information from several Information Providers and listing
multiple attributions is not practical in your product or application, you may
include a URI or hyperlink to a resource that contains the required attribution
statements.
These are important conditions of this licence and if you fail to comply with
them the rights granted to you under this licence, or any similar licence granted
by the Licensor, will end automatically.

Exemptions
This licence does not cover:
- personal data in the Information;
- information that has not been accessed by way of publication or disclosure under
  information access legislation (including the Freedom of Information Acts for the
  UK and Scotland) by or with the consent of the Information Provider;
- departmental or public sector organisation logos, crests and the Royal Arms
  except where they form an integral part of a document or dataset;
- military insignia;
- third party rights the Information Provider is not authorised to license;
- other intellectual property rights, including patents, trade marks, and design
  rights; and
- identity documents such as the British Passport.

Non-endorsement
This licence does not grant you any right to use the Information in a way that
suggests any official status or that the Information Provider and/or Licensor
endorse you or your use of the Information.

No warranty
The Information is licensed 'as is' and the Information Provider and/or Licensor
excludes all representations, warranties, obligations and liabilities in relation
to the Information to the maximum extent permitted by law.
The Information Provider and/or Licensor are not liable for any errors or
omissions in the Information and shall not be liable for any loss, injury or
damage of any kind caused by its use. The Information Provider does not guarantee
the continued supply of the Information.

Governing Law
This licence is governed by the laws of the jurisdiction in which the Information
Provider has its principal place of business, unless otherwise specified by the
Information Provider.

Definitions
In this licence, the terms below have the following meanings:
'Information' means information protected by copyright or by database right (for
example, literary and artistic works, content, data and source code) offered for
use under the terms of this licence.
'Information Provider' means the person or organisation providing the Information
under this licence.
'Licensor' means any Information Provider which has the authority to offer
Information under the terms of this licence or the Keeper of Public Records, who
has the authority to offer Information subject to Crown copyright and Crown
database rights and Information subject to copyright and database right that has
been assigned to or vested in the Crown.
'Use' means doing any act which is restricted by copyright or database right,
whether in the original medium or in any other medium, and includes without
limitation distributing, copying, adapting, modifying as may be technically
necessary to use it in a different mode or format.
'You' means the natural or legal person, or body of persons corporate or
incorporate, acquiring rights under this licence.

About the Open Government Licence
The National Archives has developed this licence as a tool to enable Information
Providers in the public sector to license the use and re-use of their Information
under a common open licence. The National Archives invites public sector bodies
owning their own copyright and database rights to permit the use of their
Information under this licence.
The Keeper of the Public Records has authority to license Information subject to
Crown copyright and Crown database right and the rights in Crown copyright and
Crown database right may be licensed under this licence.
This is version 3.0 of the Open Government Licence. The National Archives may, from
time to time, issue new versions of the Open Government Licence. However, you may
continue to use Information licensed under this version should you wish to do so.
These terms are compatible with the Creative Commons Attribution License 4.0 and
the Open Data Commons Attribution License, both of which license copyright and
database rights. This means that when the Information is adapted and licensed
under either of those licences, you automatically satisfy the conditions of the
OGL when you comply with the other licence. The OGLv3.0 terms are compatible with
the Open Government Licence - Canada 2.0 and other OGL-compliant licences.
Further context, best practice and guidance can be found in the UK Government
Licensing Framework section on The National Archives website.
https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/
'''

def digest(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def download(name, pin):
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / name
    def verified(p):
        return (p.exists() and p.stat().st_size == pin['bytes']
                and digest(p) == pin['sha256'] and digest(p, 'md5') == pin['md5'])
    if verified(target):
        return target
    partial = target.with_suffix('.part')
    partial.unlink(missing_ok=True)
    print(f"Downloading pinned {pin['product']}", flush=True)
    subprocess.run(['curl', '--fail', '--location', '--proto', '=https',
                    '--tlsv1.2', '--retry', '3', '--retry-delay', '2',
                    '--retry-max-time', '240', '--connect-timeout', '30',
                    '--max-time', '600', '--output', str(partial), pin['url']], check=True)
    if not verified(partial):
        actual = digest(partial) if partial.exists() else 'missing'
        partial.unlink(missing_ok=True)
        raise RuntimeError(f'{name}: upstream edition differs from pin ({actual}); refusing mutable data')
    partial.replace(target)
    return target

def polygons(g):
    if g.geom_type == 'Polygon':
        yield g
    elif hasattr(g, 'geoms'):
        for part in g.geoms:
            yield from polygons(part)

def lines(g):
    if g.geom_type in ('LineString', 'LinearRing'):
        yield g
    elif hasattr(g, 'geoms'):
        for part in g.geoms:
            yield from lines(part)

def rounded_coords(coords):
    result = []
    for e, n, *_ in coords:
        p = [round(e - 507000, 1), round(176000 - n, 1)]
        if not result or p != result[-1]:
            result.append(p)
    return result

def polygon_record(poly):
    # Rounding occasionally collapses narrow rings. Revalidate the snapped result.
    p = rounded_coords(poly.exterior.coords)
    holes = [h for ring in poly.interiors if len(h := rounded_coords(ring.coords)) >= 4]
    if len(p) < 4:
        return None
    snapped = Polygon(p, holes)
    if snapped.is_empty or not snapped.is_valid or snapped.area < 1:
        return None
    result = {'p': p}
    if holes:
        result['holes'] = holes
    return result

class Terrain:
    """OS ASCII grid values are cell-centred and rows run from north to south."""
    def __init__(self, archive):
        self.tiles = []
        def consume(z):
            for name in sorted(z.namelist()):
                low = name.lower()
                if low.endswith('.zip') and ('/tq/' in low or Path(low).name.startswith('tq')):
                    with zipfile.ZipFile(io.BytesIO(z.read(name))) as inner:
                        consume(inner)
                elif low.endswith('.asc') and ('tq' in low or '/' not in low):
                    raw = z.read(name).decode('ascii').splitlines()
                    header = {}
                    count = 0
                    for line in raw:
                        parts = line.split()
                        if not parts:
                            count += 1
                            continue
                        if parts[0].lower() not in ('ncols', 'nrows', 'xllcorner', 'yllcorner', 'xllcenter', 'yllcenter', 'cellsize', 'nodata_value'):
                            break
                        header[parts[0].lower()] = float(parts[1]); count += 1
                    nx, ny = int(header['ncols']), int(header['nrows'])
                    step = header['cellsize']
                    x = header.get('xllcenter', header.get('xllcorner', 0) + step / 2)
                    y = header.get('yllcenter', header.get('yllcorner', 0) + step / 2)
                    if x > B[2]+step or x+nx*step < B[0]-step or y > B[3]+step or y+ny*step < B[1]-step:
                        continue
                    vals = [float(v) for line in raw[count:] for v in line.split()]
                    if len(vals) != nx * ny:
                        raise ValueError(f'Incomplete terrain tile {name}')
                    self.tiles.append((x, y, nx, ny, step, vals, header.get('nodata_value', -9999)))
        with zipfile.ZipFile(archive) as z:
            consume(z)
        if not self.tiles:
            raise ValueError('No overlapping TQ Terrain 50 ASCII grids found')
        print(f'Loaded {len(self.tiles)} terrain tiles', flush=True)

    def nearest_cell(self, e, n):
        for x, y, nx, ny, step, vals, nodata in self.tiles:
            col, row = round((e-x)/step), round((n-y)/step)
            if 0 <= col < nx and 0 <= row < ny:
                value = vals[(ny-1-row)*nx+col]
                if math.isfinite(value) and value != nodata:
                    return value
        raise ValueError(f'Terrain coverage gap / nodata at {e}, {n}')

    def sample(self, e, n):
        # Grid centre lattice is E/N = 25 modulo 50, including tile seams.
        e0 = math.floor((e-25)/50)*50+25
        n0 = math.floor((n-25)/50)*50+25
        u, v = (e-e0)/50, (n-n0)/50
        a, b = self.nearest_cell(e0, n0), self.nearest_cell(e0+50, n0)
        c, d = self.nearest_cell(e0, n0+50), self.nearest_cell(e0+50, n0+50)
        return round(a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v, 2)

    def water_level(self, poly):
        # Interior 100 m samples avoid borrowing bank heights. Small ponds use
        # representative_point, which is guaranteed inside the polygon.
        e0, n0, e1, n1 = poly.bounds
        stride = max(100, math.ceil(math.sqrt(poly.area/400)/50)*50)
        samples = []
        for e in range(math.ceil(e0/stride)*stride, math.floor(e1)+1, stride):
            for n in range(math.ceil(n0/stride)*stride, math.floor(n1)+1, stride):
                if poly.contains(Point(e, n)):
                    samples.append(self.sample(e, n))
        if not samples:
            p = poly.representative_point(); samples = [self.sample(p.x, p.y)]
        return round(statistics.median(samples), 2)

def features(archive):
    with zipfile.ZipFile(archive) as z:
        names = {n.lower(): n for n in z.namelist()}
        for filename in sorted(n for n in z.namelist() if n.lower().endswith('.shp')):
            layer = Path(filename).stem.split('_')[-1]
            if layer.lower() not in ('building', 'surfacewater_area', 'surfacewater', 'tidalwater', 'woodland', 'foreshore', 'importantbuilding', 'site', 'road'):
                # Some editions have names such as TQ_SurfaceWater_Area.
                low = Path(filename).stem.lower()
                layer = next((v for v in ('SurfaceWater_Area', 'TidalWater', 'Woodland', 'Foreshore', 'Building', 'Site', 'Road') if low.endswith(v.lower())), '')
            if not layer:
                continue
            stem = filename[:-4]
            reader = shapefile.Reader(shp=io.BytesIO(z.read(filename)),
                shx=io.BytesIO(z.read(names[(stem+'.shx').lower()])),
                dbf=io.BytesIO(z.read(names[(stem+'.dbf').lower()])), encoding='cp1252')
            for sr in reader.iterShapeRecords(bbox=B):
                record = sr.record.as_dict()
                with warnings.catch_warnings():
                    warnings.simplefilter('ignore')
                    g = shape(sr.shape.__geo_interface__)
                if not g.is_valid:
                    g = make_valid(g)
                if not g.is_empty and g.intersects(CLIP):
                    yield filename, layer, record, g.intersection(CLIP), sr.shape.oid

def stable_id(filename, record, oid, part):
    # OS identifiers may be truncated in DBF; retain layer/tile to avoid collisions.
    value = next((record[k] for k in ('ID', 'id', 'TOID', 'OSID') if record.get(k)), oid)
    return f'{Path(filename).stem}:{value}:{part}'

def validate(data):
    t = data['terrain']
    assert t['nx'] == 391 and t['nz'] == 151 and len(t['values']) == 59041
    assert all(isinstance(v, (int, float)) and math.isfinite(v) and -50 <= v <= 500 for v in t['values'])
    for layer in ('buildings', 'surfaces', 'roads'):
        ids = set()
        for obj in data[layer]:
            assert obj['id'] not in ids, obj['id']
            ids.add(obj['id'])
            for ring in [obj['p'], *obj.get('holes', [])]:
                assert len(ring) >= (2 if layer == 'roads' else 4)
                assert all(math.isfinite(v) for point in ring for v in point)
                assert all(-5000.1 <= x <= 34000.1 and -9000.1 <= z <= 6000.1 for x,z in ring)
            if layer != 'roads':
                assert Polygon(obj['p'], obj.get('holes', [])).is_valid
            for key in ('h', 'level', 'width'):
                if key in obj:
                    assert math.isfinite(obj[key])
    assert data['buildings'] and data['surfaces'] and data['roads']
    assert len(data['buildings']) <= 40000

def cached(output):
    try:
        manifest = json.loads((output/'manifest.json').read_text())
        if manifest.get('pipelineVersion') != VERSION or manifest.get('sources') != SOURCES:
            return False
        for name in ('data.json.gz', 'NOTICE.txt', 'LICENSE-OGL-3.0.txt'):
            if digest(output/name) != manifest['outputs'][name]['sha256']:
                return False
        with gzip.open(output/'data.json.gz', 'rt') as f:
            validate(json.load(f))
        return True
    except (OSError, ValueError, KeyError, AssertionError):
        return False

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    if not args.force and cached(output):
        print(f'Validated existing London vector/terrain pack: {output}')
        return
    paths = {name: download(name, pin) for name, pin in SOURCES.items()}
    terrain = Terrain(paths['terrain50-gb.zip'])
    buildings, surfaces, roads = [], [], []
    counts = {}
    for filename, layer, attrs, g, oid in features(paths['openmap-tq.zip']):
        low = layer.lower()
        counts[layer] = counts.get(layer, 0)+1
        if low == 'road':
            classification = str(attrs.get('CLASSIFICA', attrs.get('CLASSIFICATION', attrs.get('FEATCODE', 'road'))))
            category = classification.lower()
            width = 16 if 'motorway' in category else 11 if 'a road' in category else 8 if 'b road' in category else 5
            for j, line in enumerate(lines(g.simplify(3, preserve_topology=True))):
                p = rounded_coords(line.coords)
                # Closure is intentional for roundabouts and other road loops.
                if len(p) >= 2:
                    roads.append({'id': stable_id(filename, attrs, oid, j), 'p': p, 'kind': classification, 'width': width})
            continue
        is_building = 'building' in low
        tolerance = 1.2 if is_building else 3 if 'water' in low else 5
        for j, poly in enumerate(polygons(g.simplify(tolerance, preserve_topology=True))):
            obj = polygon_record(poly)
            if obj is None:
                continue
            obj['id'] = stable_id(filename, attrs, oid, j)
            if is_building:
                c = poly.centroid
                heathrow = c.x < 512500 and 172000 < c.y < 179500
                central = 525000 < c.x < 534000 and 177000 < c.y < 184000
                # Assumed heights are explicitly not building-height observations.
                obj.update(h=12 if heathrow else 26 if central and poly.area > 1800 else 18 if poly.area > 600 else 10, kind='building')
                priority = poly.area * (3 if central else 2.5 if heathrow else 1)
                buildings.append((priority, obj))
            else:
                kind = 'water' if 'water' in low else 'woodland' if 'woodland' in low else 'foreshore' if 'foreshore' in low else 'site'
                obj.update(kind=kind, sourceLayer=layer)
                if kind == 'water':
                    obj['level'] = 0.5 if 'tidal' in low else terrain.water_level(poly)
                surfaces.append(obj)
    selected = sorted(buildings, key=lambda row: (-row[0], row[1]['id']))[:40000]
    data = {
        'schemaVersion': 1,
        'attribution': NOTICE,
        'origin': {'easting': 507000, 'northing': 176000, 'crs': 'EPSG:27700', 'heightCrs': 'EPSG:5701', 'x': 'E-507000', 'z': '176000-N'},
        'bounds': {'eastingMin': B[0], 'northingMin': B[1], 'eastingMax': B[2], 'northingMax': B[3], 'xMin': -5000, 'xMax': 34000, 'zMin': -9000, 'zMax': 6000},
        'buildings': sorted((row[1] for row in selected), key=lambda row: row['id']),
        'surfaces': sorted(surfaces, key=lambda row: row['id']),
        'roads': sorted(roads, key=lambda row: row['id']),
        'terrain': {'x': -5000, 'z': -9000, 'step': 100, 'nx': 391, 'nz': 151,
                    'values': [terrain.sample(e, n) for n in range(185000, 169999, -100) for e in range(502000, 541001, 100)]},
    }
    validate(data)
    output.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
    (output/'data.json.gz').write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    (output/'NOTICE.txt').write_text(NOTICE)
    (output/'LICENSE-OGL-3.0.txt').write_text(OGL)
    manifest = {'pipelineVersion': VERSION, 'sources': SOURCES, 'bounds': data['bounds'], 'origin': data['origin'],
                'heightAssumptions': {'buildingMetres': [10,18,26], 'heathrowBuildingMetres': 12, 'tidalWaterMetresODN': 0.5, 'otherWater': 'median interior Terrain 50 samples'},
                'counts': {key: len(data[key]) for key in ('buildings', 'surfaces', 'roads')}, 'sourceFeatureCounts': counts,
                'terrain': {'nx': 391, 'nz': 151, 'samples': 59041, 'stepMetres': 100, 'method': 'bilinear cell-centred OS Terrain 50; complete finite grid'},
                'artwork': 'vector-derived; not aerial imagery', 'outputs': {}}
    for name in ('data.json.gz', 'NOTICE.txt', 'LICENSE-OGL-3.0.txt'):
        manifest['outputs'][name] = {'sha256': digest(output/name), 'bytes': (output/name).stat().st_size}
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    print(json.dumps(manifest['counts']), flush=True)

if __name__ == '__main__':
    main()
