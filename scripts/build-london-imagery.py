#!/usr/bin/env python3
"""Rebuild genuine, attributed London imagery from SHA-pinned Sentinel-2 COGs.

Install rasterio, numpy and Pillow. Originals remain in .tmp; the resulting
4.24 MB derivative pack is self-contained and requires no runtime network.
"""
import argparse
import hashlib
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT/'scenery-packs/london-imagery'
BOUNDS = (502000, 170000, 541000, 185000)
EXTENT = (-5000, -9000, 34000, 6000)
GRID = (8, 3)
TILE_SIZE = 512
LEGAL_URL = 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice'
ATTRIBUTION = 'Contains modified Copernicus Sentinel data [2025]'
SOURCES = [
    {'id': 'S2A_30UXC_20250817_0_L2A',
     'url': 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/U/XC/2025/8/S2A_30UXC_20250817_0_L2A/TCI.tif',
     'sha256': 'c71d7079ab784c13f9ddc02767c3052f498b4fb92f145917687a77bee7ee4321',
     'cache': 'london-sentinel-tci.tif', 'stac': 'source-stac.json'},
    {'id': 'S2C_30UXC_20250619_0_L2A',
     'url': 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/U/XC/2025/6/S2C_30UXC_20250619_0_L2A/TCI.tif',
     'sha256': 'd85deb7e0f0bf15050b25330441e8c8f2d61db4a56b3ffd501bb5843250e6cb7',
     'cache': 'london-sentinel-june-tci.tif', 'stac': 'source-stac-west.json'},
    {'id': 'S2C_30UYC_20250825_0_L2A',
     'url': 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/30/U/YC/2025/8/S2C_30UYC_20250825_0_L2A/TCI.tif',
     'sha256': '361f84586c69e6c8c4f53a242ba1b2ea15ad4b78de8515d49823247bf8af55f0',
     'cache': 'london-sentinel-east-tci.tif', 'stac': 'source-stac-east.json'},
]
SOURCE_SHA256 = SOURCES[0]['sha256']
NOTICE = f'''{ATTRIBUTION}

London true-colour ground imagery: Sentinel-2 MSI Level-2A summer 2025 mosaic.
Primary: 2025-08-17, scene S2A_30UXC_20250817_0_L2A. Only missing edge pixels
are filled from S2C_30UXC_20250619_0_L2A (west) and
S2C_30UYC_20250825_0_L2A (east). Dates therefore differ at the outer edges.
Source bands B04 (red), B03 (green), B02 (blue), 10 metre ground sampling.
Distributed COGs supplied by Element 84 Earth Search / AWS Sentinel COGs.

The Copernicus Sentinel legal notice permits reproduction, distribution,
communication to the public, adaptation, modification and combination with
other data. This derivative is cropped, reprojected from EPSG:32630 to
EPSG:27700, bilinearly resampled and JPEG encoded. The original imagery is
not sub-metre aerial photography. Increasing texture dimensions does not
increase the 10 metre source resolution.

Primary legal notice:
{LEGAL_URL}
Official readable legal notice:
https://cds.climate.copernicus.eu/licences/ec-sentinel
Official attribution guidance:
https://documentation.dataspace.copernicus.eu/FAQ.html

Copernicus Sentinel data are provided without any express or implied
warranty, including quality and suitability for any purpose. By using the
data, users acknowledge the applicable conditions and waive claims for
damages against the European Union and the data/information providers as
set out in the primary legal notice. No ESA/EU endorsement is implied.

Source URLs, product identifiers, SHA-256 hashes, coordinate transform,
output dimensions and processing versions are recorded in manifest.json
and source-stac*.json. Images are north-up: top = north = minimum game z.
Game coordinates: x = Easting - 507000; z = 176000 - Northing.
'''


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def tile_extent(column, row):
    x0, z0, x1, z1 = EXTENT
    dx, dz = (x1-x0)/GRID[0], (z1-z0)/GRID[1]
    return [x0+column*dx, z0+row*dz, x0+(column+1)*dx, z0+(row+1)*dz]


def asset(path, extent=None, size=None, ident=None):
    result = {'file': path.name, 'bytes': path.stat().st_size, 'sha256': sha(path)}
    if extent is not None:
        result.update(extent=list(extent), width=size[0], height=size[1])
    if ident is not None:
        result['id'] = ident
    return result


def validate_source(path, expected=SOURCE_SHA256):
    actual = sha(path)
    if actual != expected:
        raise ValueError(f'Sentinel source integrity mismatch: {actual}; expected {expected}')


def download_source(path, source):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        partial = path.with_suffix('.partial')
        with urllib.request.urlopen(source['url'], timeout=240) as response, partial.open('wb') as out:
            for block in iter(lambda: response.read(1024*1024), b''):
                out.write(block)
        validate_source(partial, source['sha256'])
        partial.replace(path)
    validate_source(path, source['sha256'])


def reproject_source(path):
    import numpy as np
    import rasterio
    from rasterio.transform import from_bounds
    from rasterio.warp import reproject, Resampling
    native = np.zeros((3, 1500, 3900), dtype=np.uint8)
    with rasterio.open(path) as source:
        if source.crs.to_epsg() != 32630 or source.res != (10.0, 10.0):
            raise ValueError('Unexpected source georeferencing or native resolution')
        if source.count != 3 or source.dtypes != ('uint8',)*3:
            raise ValueError('Expected three uint8 true-colour bands')
        for band in range(3):
            reproject(rasterio.band(source, band+1), native[band],
                      src_crs=source.crs, src_transform=source.transform, src_nodata=0,
                      dst_crs='EPSG:27700', dst_transform=from_bounds(*BOUNDS, 3900, 1500),
                      dst_nodata=0, resampling=Resampling.bilinear, num_threads=1)
    return native.transpose(1, 2, 0)


def self_test():
    assert tile_extent(0, 0) == [-5000, -9000, -125, -4000]
    assert tile_extent(7, 2) == [29125, 1000, 34000, 6000]
    assert sum((tile_extent(c, r)[2]-tile_extent(c, r)[0]) *
               (tile_extent(c, r)[3]-tile_extent(c, r)[1])
               for r in range(3) for c in range(8)) == 39000*15000
    assert (BOUNDS[0]-507000, 176000-BOUNDS[3], BOUNDS[2]-507000, 176000-BOUNDS[1]) == EXTENT
    print('Sentinel coverage, north-up orientation and game transform validated')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT/'.tmp')
    parser.add_argument('--output', type=Path, default=PACK)
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    for source in SOURCES:
        stac_path = output/source['stac']
        if not stac_path.exists():
            if output != PACK and (PACK/source['stac']).exists():
                stac_path.write_bytes((PACK/source['stac']).read_bytes())
            else:
                url = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/'+source['id']
                with urllib.request.urlopen(url, timeout=60) as response:
                    stac_path.write_text(json.dumps(json.load(response), indent=2, sort_keys=True)+'\n')
        stac = json.loads(stac_path.read_text())
        if stac['id'] != source['id'] or stac['assets']['visual']['href'] != source['url']:
            raise ValueError('STAC snapshot does not describe pinned source')
        download_source(args.cache/source['cache'], source)
        print('Verified '+source['id'], flush=True)
    if args.download_only:
        return
    import numpy as np
    import PIL
    import rasterio
    from PIL import Image
    native = np.zeros((1500, 3900, 3), dtype=np.uint8)
    provenance = []
    for source in SOURCES:
        stac = json.loads((output/source['stac']).read_text())
        path = args.cache/source['cache']
        warped = reproject_source(path)
        fill = np.all(native == 0, axis=2) & np.any(warped != 0, axis=2)
        native[fill] = warped[fill]
        provenance.append({k: source[k] for k in ['id', 'url', 'sha256']})
        provenance[-1].update(bytes=path.stat().st_size, contributedPixels=int(fill.sum()),
                              datetime=stac['properties']['datetime'],
                              cloudCoverPercent=stac['properties']['eo:cloud_cover'],
                              nativeResolutionMetres=10, stac=source['stac'])
    nodata = int(np.count_nonzero(np.all(native == 0, axis=2)))
    if nodata:
        raise ValueError(f'Incomplete Sentinel mosaic: {nodata} missing crop pixels')
    image = Image.fromarray(native, 'RGB')
    overview = image.resize((2048, 1024), Image.Resampling.LANCZOS)
    overview.save(output/'overview.jpg', quality=90, subsampling=0, optimize=True)
    tiled = image.resize((4096, 1536), Image.Resampling.BILINEAR)
    tiles = []
    for row in range(3):
        for column in range(8):
            ident = f'{column}-{row}'
            tile = tiled.crop((column*512, row*512, (column+1)*512, (row+1)*512))
            path = output/f'tile-{ident}.jpg'
            tile.save(path, quality=92, subsampling=0, optimize=True)
            entry = asset(path, tile_extent(column, row), tile.size, ident)
            entry.update(column=column, row=row)
            tiles.append(entry)
    (output/'NOTICE.txt').write_text(NOTICE)
    manifest = {
        'schemaVersion': 1, 'id': 'london-sentinel-2025', 'pipelineVersion': 1,
        'attribution': ATTRIBUTION, 'license': 'Copernicus Sentinel Data Legal Notice', 'licenseUrl': LEGAL_URL,
        'crs': 'EPSG:27700', 'bounds': list(BOUNDS), 'extent': list(EXTENT),
        'orientation': 'north-up; image top is minimum game z',
        'gameTransform': {'x': 'Easting - 507000', 'z': '176000 - Northing'},
        'source': dict(provenance[0], crs='EPSG:32630', bands=['B04', 'B03', 'B02']), 'sources': provenance,
        'processing': {'reprojectedNativeDimensions': [3900, 1500], 'nativeGridResolutionMetres': [10, 10],
                       'tiledDimensions': list(tiled.size), 'tileGrid': list(GRID),
                       'displayTilePixelMetres': [39000/4096, 15000/1536], 'missingPixels': 0,
                       'resampling': 'bilinear; overview Lanczos', 'gdal': rasterio.__gdal_version__,
                       'rasterio': rasterio.__version__, 'numpy': np.__version__, 'pillow': PIL.__version__},
        'overview': asset(output/'overview.jpg', EXTENT, overview.size, 'overview'), 'tiles': tiles,
        'outputs': {p.name: asset(p) for p in [output/'NOTICE.txt', *(output/s['stac'] for s in SOURCES)]},
    }
    for entry in [manifest['overview'], *tiles]:
        manifest['outputs'][entry['file']] = entry
    (output/'manifest.json').write_text(json.dumps(manifest, indent=2, sort_keys=True)+'\n')
    print(f'Built attributed Sentinel imagery: 0 missing pixels, {len(tiles)} tiles, '
          f'{sum(v["bytes"] for v in manifest["outputs"].values()):,} bytes')


if __name__ == '__main__':
    main()
