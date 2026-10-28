# London scenery data

The London pack is generated from OS OpenMap Local vector data and OS Terrain 50
elevation data. The ground texture is vector-derived artwork, **not aerial imagery**.
The pack covers British National Grid easting 502000–541000 and northing
170000–185000 (39 km × 15 km). Coordinates are EPSG:27700; heights are metres
above Ordnance Datum Newlyn (EPSG:5701). World coordinates are `x = E − 507000`,
`z = 176000 − N`; positive z points south.

## Rebuild

```sh
python -m pip install -r scripts/london-requirements.txt
python scripts/build-london.py
python scripts/build-london-ground.py
```

The default output is `scenery-packs/london`. Both commands accept `--output PATH`
and `--force`. CI runs both before browser and APK builds so all distributions
include the same scenery, provenance and licences. Generated files are omitted
from source control. An existing pack is reused only after version, source pins,
output SHA-256 and geometry/terrain validation succeed. Raw downloads are cached
in `.tmp/london`. Curl uses HTTPS-only redirects, bounded timeouts and three
retries. A raw file must match its pinned byte length, MD5 and SHA-256; an upstream
edition change fails explicitly and requires a reviewed pin update. Nothing is
silently refreshed against a mutable upstream endpoint.

## Pinned inputs

| Product | Bytes | SHA-256 | MD5 |
| --- | ---: | --- | --- |
| OS OpenMap Local TQ, ESRI Shapefile | 220434575 | `0271ac90feaf041d9af7b1f3bab0ec99765e6f843d6f9e24c50500e2a25bb418` | `94c08ba6f3d9ce4a3b36339fc01b9334` |
| OS Terrain 50 GB, ASCII Grid and GML | 161706566 | `d03e91d3adcf5927b2f2e2ef0d7b6ccf18a2e63728d6ebef83c6c9aa2a3c64a7` | `feba9008db55cdcb5c5e5b7896e3428b` |

The precise OS download API URLs, source hashes and byte counts are recorded in
`manifest.json` and the source script. The manifest also records every generated
data, texture, notice and licence hash, counts, grid metadata, texture dimensions
and estimated GPU memory. The manifest does not contain a self-referential hash.

The OpenMap pin was explicitly reviewed on 28 October 2026 after the previous
230809695-byte edition stopped being served. The official OS API metadata reports
`opmplc_essh_tq.zip`, 220434575 bytes and MD5 `94c08ba6f3d9ce4a3b36339fc01b9334`;
the downloaded archive matches both and its SHA-256 is pinned above. Archive
entries are timestamped 26 October 2026. This is an observed archive timestamp,
not a claimed survey date. Its included licence and EPSG:27700 projection were
inspected. Terrain 50 still matches the original pin. Pipeline version 4 invalidates
old generated packs. Size, MD5 and SHA-256 checks remain mandatory; future upstream
changes fail closed. See `research/os-download-metadata-2026-10-28.json`.

## Geometry and terrain

Shapefile DBF text is decoded as cp1252. Geometry is repaired when necessary,
clipped to the declared coverage, simplified with topology preservation (buildings
1.2 m; water and roads 3 m; other polygons 5 m), and snapped to 0.1 m. Polygon
interior rings are retained. Degenerate or invalid snapped polygons are rejected.
Closed road loops remain closed. Outputs have deterministic identifiers and order.
All coordinates and heights must be finite and within the declared bounds.

At most 40000 footprints are selected deterministically by footprint area with
weights of 3 in central London and 2.5 around Heathrow. Building heights are
**assumed**, not measured: 10, 18 or 26 m by footprint size and central location,
and 12 m around Heathrow. This is a flight-simulation visual approximation, not
survey or navigation data.

Terrain 50 nested ZIP ASCII grids are interpreted as cell-centred 50 m samples,
including samples across tile seams. Bilinear resampling creates a complete
391 × 151 grid at 100 m spacing: 59041 finite values, row-major from north to south
(increasing world z). Missing coverage or nodata causes a build failure.
Tidal water uses an assumed +0.5 m ODN level; inland water uses the median of
interior DEM samples, or a representative interior point for small polygons.

`data.json.gz` is deterministic gzip (`mtime=0`) containing:

```text
buildings: [{id, p: [[x,z],...], holes?: [...], h, kind}]
surfaces:  [{id, p, holes?, kind: water|woodland|foreshore|site, sourceLayer, level?}]
roads:     [{id, p, kind, width}]
terrain:   {x:-5000,z:-9000,step:100,nx:391,nz:151,values:[...]}
origin, bounds, attribution, schemaVersion
```

`ground.png` is 4096 × 1536 RGB over the exact pack extent. Its palette is base
(101,108,77), pavement (120,119,106), roads (91,94,88), woodland (61,80,47), water
(67,87,81), foreshore (128,119,93), and roofs (137,130,116). Pavement follows the
real footprints with a 2 px buffer and 1 px blur. Polygon holes remain present.
`water-mask.png` uses identical extent, orientation and dimensions: grayscale
255 for water and 0 for land, including islands. Each texture costs 24 MiB if
uploaded as RGBA8 (48 MiB together); an R8 water mask costs 6 MiB instead.

## Attribution and licensing

Contains OS data © Crown copyright and database right 2026.
Contains public sector information licensed under the Open Government Licence v3.0.

The pack bundles `NOTICE.txt` and the full `LICENSE-OGL-3.0.txt` (SPDX
`OGL-UK-3.0`). Retain those files and attribution when redistributing the pack,
browser build or APK. Sources: [OS OpenMap Local](https://www.ordnancesurvey.co.uk/products/os-openmap-local),
[OS Terrain 50](https://www.ordnancesurvey.co.uk/products/os-terrain-50), and
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
