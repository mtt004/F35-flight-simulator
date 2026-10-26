# Regional scenery data investigation

27 October 2026. These are candidate inputs and legal/engineering requirements. No dataset download, reprojection, scenery compilation or geographic validation is implied by this investigation. A procedural biome preset is not a finished real-world pack.

## Hampshire / Farnborough

[Environment Agency National LIDAR Programme](https://www.data.gov.uk/dataset/f0db0249-f17b-4036-9e65-309148c97ce4/national-lidar-programme): official metadata describes England-wide 1m elevation products, GeoTIFF/LAZ, 5km British National Grid tiles (EPSG27700), and Open Government Licence terms. The [2m composite DTM](https://www.data.gov.uk/dataset/e529ca2f-b4ce-403e-8cef-ab821061c4f3/lidar-composite-digital-terrain-model-dtm-2m) removes above-ground objects, making it more suitable for ground collision than a DSM.

A full-resolution regional dataset is inappropriate as an unbounded phone mesh. Required pipeline: select bounding box → record source tiles/version → reproject into a local metre-based grid → preserve vertical datum → downsample/error-bound terrain → generate tiled LODs → verify airport heights/collision against the same samples. Roads/buildings need separate data and licences.

The [OGLv3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) permits reuse subject to attribution and exclusions. Preserve provider-specific attribution. The cited 2022 composite specifies Environment Agency copyright/database-right attribution. Logos, military insignia and other third-party rights are excluded from the general licence.

## Cappadocia / Göreme / Nevşehir

[Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) offers global30m/90m products; these are digital **surface** models and include surface objects. The global30m product can establish regional terrain, but individual fairy chimneys and cave architecture need additional authored geometry or legally sourced finer data. It is not sufficient to infer high-detail geological accuracy from30m sampling.

The [COP-DEM-GLO-30-F licence](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf) grants reuse/distribution/adaptation subject to its full conditions and notices. Before a pack ships, retain the downloaded product's exact licence and prescribed source/processing attribution. Some access paths require registration; access was not assumed or provisioned here.

## Roads, buildings and airports

[OpenStreetMap copyright/licensing](https://www.openstreetmap.org/copyright): database data is ODbL, with contributor attribution and database share-alike obligations where applicable. Do not equate access to open data with unrestricted use of public tile servers. Keep original/extracted/derived databases identifiable, attribution visible and licences bundled. No proprietary map or satellite tile should be copied into a pack.

Airport layout data still needs source/version/rights, geographic alignment and runway elevation verification. The existing generated airports are procedural and must not be labelled accurate Farnborough or Nevşehir solely because of a renamed menu option.

## Pack release acceptance

Each real pack needs a manifest with ID, version, geographic bounding box, horizontal CRS, vertical datum, source URLs/product IDs, checksums, licences, processing script/version, resolution/LOD specification and tested engine compatibility. Validate import size limits, finite coordinates/heights, bounded memory and path safety before loading. The base game must remain playable with no pack installed.
