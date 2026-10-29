# Rendering and dataset review — 28 October 2026

This review supplements the earlier V0.3 work; research is not device evidence.

- Exa located the original [Terrender implementation](https://github.com/crocij/terrender)
  and [Wang et al. 2025 paper](https://www.mdpi.com/2075-5309/15/16/2916).
  Terrender uses adaptive terrain refinement (RASTeR); its published results do
  not qualify our regular three-resolution tiles, skirts or phone performance.
  Wang et al. separate data detail and camera-dependent geometry, with spatial
  culling. Their desktop urban seismic experiment is not an A51 flight-simulation
  benchmark. The paper's publisher gives publication date 18 August 2025; search
  metadata also surfaced a submission date, so it was not used as publication date.
- Consensus was attempted but returned its monthly quota error. No Consensus
  result or unavailable paper reading is claimed. Original publisher/author
  sources were used to verify the above technical direction.
- Context7 supplied current Three.js documentation on instance bounds and
  [resource disposal](https://github.com/mrdoob/three.js/blob/dev/manual/pages/cleanup.html).
  Its modern `InstancedMesh.computeBoundingSphere()` advice is not assumed to
  exist in r128. The London implementation instead uses merged regular meshes
  with geometry bounds and explicit disposal. The actual r128 ShapeUtils path
  was tested directly: it removes repeated ring closure points before indexing,
  which required normalizing both the indexed coordinates and the triangulation.
- Retaining r128 avoids an unmeasured shader/lighting/loader migration during a
  scenery release. This milestone does not implement KTX2/Basis, glTF streaming,
  worker geometry, SSE refinement, geomorphing or physically exact scattering.
  Those remain engineering options requiring new compatibility and device tests.
- SOFA search and full post/reply inspection covered
  [WebGL timing and queue backpressure](https://agents.stackoverflow.com/questions/86db1362-c9ed-44e2-83e8-e9e7a728045a).
  Its proposed protocols were explicitly unverified by the replying agent. We do
  not cite them as experimental proof; frame intervals, render submission time,
  allocation and GPU time remain distinct quantities in our reports.
- Official [OS OpenData](https://www.ordnancesurvey.co.uk/products/open-data),
  [OS Terrain 50](https://osdatahub.os.uk/Downloads/Open/Terrain50) and Environment
  Agency [National LIDAR Programme](https://www.data.gov.uk/dataset/f0db0249-f17b-4036-9e65-309148c97ce4/national-lidar-programme)
  were investigated. The shipped pack uses OS OpenMap Local and Terrain 50;
  it does not claim EA LIDAR, aerial photographs, Copernicus DEM or OSM inputs.
  Official download metadata, hashes, actual licences and projection files were
  inspected. See `os-download-metadata-2026-10-28.json` and `docs/london-data.md`.

Commercial simulators remain visual references. No commercial game data,
Google/Bing imagery, restricted flight data or proprietary model was extracted.
