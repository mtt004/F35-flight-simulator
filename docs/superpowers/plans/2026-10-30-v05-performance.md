# V0.5 Performance Reconstruction Implementation Plan

**Goal:** Deliver quality-preserving performance improvements with reproducible source, browser and Android evidence.
**Architecture:** Keep r128 and existing scene selection; remove redundant work, add exact lazy prepared geometry and truthful clocks. Instrument only on request.
**Spec:** docs/superpowers/specs/2026-10-30-v05-performance-design.md and supplied execution brief.

## Global constraints

- Retain original resolution, assets, shadow settings and simulation integrator.
- Source baseline ca330131115ee983a6457efa33ff513ac34803ad; deliver0.5.0-experimental, Android code5 on a new feature branch.
- No physical A51 measurements may be inferred from software rendering.

## Review focus

- Cancelled decompression, reload and reset cannot attach stale geometry.
- Fallback and prepared paths must agree in every Float32 attribute and bounds.
- Pause/replay/background intervals cannot become physics debt.
- A stale generated pack cannot silently ship with different source heights or materials.
- Sustained resource counts and geometry/texture allocations must remain bounded.

## Tasks

- [x] Inspect published source, PR, branches, engine and build procedures; restore exact baseline inputs and run122 original unit tests.
- [x] Test and remove duplicate London dispatch, equivalent detailed LOD rebuilds, repeated tile-key parsing and material traversal.
- [x] Test and implement bounded opt-in stage diagnostics and imagery churn instrumentation; preserve residency/order.
- [x] Generate exact geometry tiles in scripts/build-london-geometry.mjs; src/terrain/prepared-geometry.js decodes one at a time. Test exact attributes/bounds, cancellation/reset, corruption, fallback and memory bounds. Compare real-data construction runs.
- [x] Integrate prepared source/output pins and payload into scripts/build-web.mjs. Bundler must reject stale/corrupt geometry; repeated builds must be identical.
- [x] Complete physics debt and lifecycle regression tests; keep state clocks coherent with executed steps.
- [ ] Add controlled paired rendering/screenshot/difference suite and workflow, run full local tests then remote Chromium and Android validation, including1200-second observation.
- [ ] Review complete changes independently, correct important findings, commit logically and deliver draft/reviewable PR plus artifacts. Publish experimental release only if available release gates pass.

## Execution record

2026-10-30: continuation after model quota interruption. Existing edits preserved; no source changes have yet been pushed. Local Git is a comparison snapshot, not remote ancestry. Remote commits must use the verified08449d1 tree/parent through GitHub, preserving all remote files. No synthetic local root commit will be pushed.
