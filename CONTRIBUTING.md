# Development

Use feature branches and small reviewable commits. Preserve legacy bytes and core flight behavior unless a reproduced defect justifies a separate regression-tested correction. Never commit credentials, signing keys, dependencies, caches or generated APKs.

Run npm test and npm run build. Real browser tests and Android build/instrumentation are required for release; unit compilation alone cannot prove flight functionality. Keep source hashes, environment, failures and unavailable device tests in evidence. No fabricated benchmarks, geographic data or screenshots. Publish binaries through Releases and identify the exact source/tag.

Keep procedural appearance presets labelled as such. Document licences/provenance for any acquired asset or geographic dataset. Preserve repository privacy.
