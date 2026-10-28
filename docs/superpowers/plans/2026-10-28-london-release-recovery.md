# London release recovery implementation plan

Goal: finish the existing geographic London milestone and deliver verified offline builds.
Architecture: retain Three.js r128, the existing London pack and the protected physics. Correct the courtyard triangulation defect; investigate and explicitly pin the currently supplied official OS edition without weakening hash checks.

The user's V0.3 specification is the authority and explicitly authorizes continuous execution, commits, PR review and release after gates pass.

- [ ] Reproduce closed-ring roof corruption with actual r128 geometry area/hole tests, normalize rings once before triangulation, and run all unit/configuration tests.
- [ ] Inspect official downloaded archive metadata, record exact new source hashes and dimensions, rebuild and validate all geodata; retain fail-closed source checks.
- [ ] Run actual browser, offline, flight, context recovery and fixed-camera visual checks. Record new build identities and benchmark limits.
- [ ] Commit the focused corrections to the existing PR with a branch-head lease, review CI, and publish only after genuine APK/emulator and release-verification gates pass.

Review focus: closed polygon holes, mutated input rings, source edition drift, offline assets, APK/source identity. Hardware performance remains untested without a physical A51.
