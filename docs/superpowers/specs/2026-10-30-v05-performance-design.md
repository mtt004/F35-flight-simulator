# V0.5 quality-preserving performance design

The execution specification is the user's Project Lightning V0.5 Performance Reconstruction brief. Preserve v0.4 scene coverage, source footprints/heights, all nine landmarks, imagery, materials, shadows, aircraft, controls, collision and offline functionality. No graphics profile, resolution or density reduction is a performance fix.

Baseline: published v0.4.0-candidate.1 source ca330131115ee983a6457efa33ff513ac34803ad; exact published browser HTML SHA256 f1f6a9e9b19c0bc8210b5bab4ef91e9b03c854f0b895cda0c965ae6779a45aad. Development incorporates later QA/delivery files from feature/v04-london-reconstruction at08449d129e4f006aed7867767f26e769d7730bf2. Main was7f64839a62b6894678e941a0d5dd9edf14d9cd64 and PR9 remained open at inspection. No history rewrite or replacement of existing releases.

## Decisions and alternatives

Retain Three.js r128. First remove duplicate streaming, equivalent detailed-LOD rebuilding, repeated tile-key parsing and repeated landmark material updates. Preserve the original tile partition, distance selection, materials and GPU workload. Do not claim these eliminate GPU rasterization cost.

Prepare exact final Float32 geometry attributes offline using the bundled generator, heights and exclusions. Two geometry variants suffice: LOD0/1 are byte-identical; LOD2 differs. Store independently gzipped tiles, verify all source/input/output hashes at build time, lazily decompress one tile at a time and expose immutable attributes without copying. Preserve old complete meshes until replacements complete. Existing incremental generation remains the fallback on unsupported decompression or corrupt payloads. No decoded global cache. Eager preparation was rejected:233,337,888 attribute bytes before GPU copies is unsuitable for the target phone. Runtime-only triangulation remains functional but preserves the observed stalls. A worker/engine rewrite is unnecessary before testing the simpler exact prepared path.

Keep 120Hz physics. Retain elapsed active-flight debt, bound catch-up to120 steps/frame, clear clocks at pause/background/context lifecycle boundaries, and expose remaining debt. Simulation state follows executed physics time; camera/effect interpolation retains its stability clamp.

Remove global material invalidation on shadow toggles because r128 keys lit shader variants on shadow/light state. Preserve map size, coverage and cadence. Preserve imagery residency ceiling and ordering; add churn counters and remove repeated distance/id searches before considering additional memory caches.

## Evidence and acceptance

Opt-in bounded diagnostics distinguish CPU submission from GPU execution. Run real-data CPU construction tests, complete unit/config/height tests, controlled before/after browser captures, pixel differences, paired renderer samples, lifecycle/offline checks and20-minute observation. Test APK archive plus genuine Android API33 emulator installation/live game. Cloud SwiftShader timings are neither Mali timings nor evidence of the A51 FPS goal. Physical device, battery and thermal acceptance remain untested without access. Publishing requires available gates to pass and an independent source/evidence review. Claims must retain raw observations, source/build hashes and limitations.
