# V0.3 release recovery — 28 October 2026

The pre-existing London PR #8 was at `e0046849`. Main was `ff365dc`; V2 release
source was `488ea110`. No active work or legacy source was overwritten. The
following focused corrections continue that geographic milestone:

| Commit | Change |
| --- | --- |
| `e9b63a6` | Normalize closed polygon rings before r128 triangulation; six roof-area/courtyard tests |
| `edf0d9f` | Review and pin the currently served official OS OpenMap TQ archive; pipeline version 4 |
| `720236a` | Merged Heathrow glazing/mullions, roof ribs/plant/skylights and marked concrete aprons |
| `7a2b749` | Verify exact scenery bytes and licences before bundling; reject truncated assets |

Current verified asset inputs produce HTML SHA-256
`b9163b605f312d637e655dfb817fd215a7e12e6f2a4fced259bf07021093f0e8`,
31,627,637 bytes. Code, asset and APK identities must be compared with the final
release metadata. A source-file change is not inferred from a branch name.

Current pack: 40,000 selected real footprints, 85,576 road features, 8,849 surface
features and 59,041 finite DEM samples. The 39 × 15 km extent, translated
EPSG:27700 coordinates, ODN heights, 100 m mesh sampling, estimated building
heights and vector-derived ground remain as described in `london-data.md`.

The old source archive no longer matched its pins. The replacement matches the
official API's byte count and MD5 plus independently computed SHA-256. Pin checks
were retained; raw dataset refreshes never become silently accepted updates.

The courtyard test reproduced 416 m² of roof for a 384 m² shape, plus filled
openings with two closed holes. All six open/closed cases pass after correction.
The terminal addition uses two merged meshes: 14,728 skin triangles, 652 apron
triangles, about 2.03 MB of vertex attributes, and 16 airport draw objects total.
It is authored architectural interpretation; terminal/stand survey fidelity and
phone performance are not inferred from these budgets.

The packager formerly accepted an empty water-mask file. This was reproduced
with a failing regression. It now checks positive manifest byte counts and
SHA-256 for all five assets/notices and embeds those exact verified buffers.
The local file truncation's original cause is unknown. Rejected empty-mask builds,
captures and old-browser failures are retained under `benchmarks/london-v0.3/rejected-local/`
and are not final visual acceptance evidence.

Validation at this source: 101 Node tests, 10 configuration checks, 13 Android
metadata/evidence checks, and six actual saved-flight/replay/corrupt-save UI checks
pass. The latter use Chromium 151 with SwiftShader. Chromium 131 repeatedly exited
with native SIGSEGV at second-tab navigation; the diagnostic is retained, with no
cgroup OOM event. This is not reclassified as a passing older-browser test.

The 7a browser CI lifecycle run also retained four failures: a Continue-click
timeout, two page-load timeouts, and a Replay assertion taken across asynchronous
driver calls. In the latter, the second request arrived 17.8 wall seconds later,
after the short replay could finish; resetting the clock for a new replay was
valid. The revised helper brackets the actual handler with same-task capture and
bubble observations, verifies an active replay ignores repeat requests, and
allows a fresh replay after natural completion. It records over eight seconds
of real flight and observes playback and a deliberate savePrefs(true) attempt immediately after the unchanged
replay update. Superseded tabs stop GPU draw submission before replacement-page
startup. All saved-state, pose, camera, restore and corrupt-record assertions
remain; a new source-function unit test protects legitimate post-completion replay.
No application/replay/flight body was changed for these harness corrections. The save check exercises the real save routine during a rendered playback frame; it does not claim that the natural autosave timer fired.

Current product checks pass: actual browser 9/9, London 7/7 including keyboard
runway takeoff, saved-flight/replay UI 6/6, and network-disabled file startup
36/36 with zero remote requests. Twelve fresh fixed-camera views match this
build. A fresh independent agent visually reviewed the airport, Thames/Tower
Bridge, high-altitude and night views after the water mask was regenerated.

The exact product HTML also appears in the genuine installed APK from Android
CI run 40758569421 (PR merge source `49cd7cf1f11825ee069a66c46342d19abb866248`).
That API 33 x86_64 software-GPU emulator gate passed; it is not an A51 result.
The source-bound raw XML and APK identity are retained in the final release.

## Performance observations

Ten-second fixed views and a 120-second active-city fixture ran sequentially in
Chrome 151/SwiftShader, Balanced Q1, 1280×720 viewport and 1152×648 draw buffer.
Raw intervals remain in `performance-without-gpu-queries.json`. This is a new
host/browser observation, not a same-workload speedup claim over earlier V2/V0.3.

| Scene | Median FPS | 1% low | p95 ms | p99 ms | Calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Heathrow | 6.36 | 2.86 | 327.0 | 349.3 | 298 | 184053 |
| London approach | 3.98 | 1.58 | 480.9 | 631.9 | 255 | 374229 |
| Skyline | 3.93 | 1.92 | 497.1 | 520.5 | 258 | 348714 |
| Tower Bridge | 3.81 | 1.81 | 494.4 | 552.0 | 239 | 246218 |
| Cockpit | 6.33 | 1.93 | 306.8 | 518.4 | 153 | 158826 |
| Night | 4.74 | 1.97 | 424.4 | 506.8 | 87 | 263695 |
| Active city, 120 s | 7.31 | 2.17 | 298.7 | 384.1 | 235 | 120256 |

The 30 FPS goal fails in this environment. A separate GPU-query diagnostic uses
the Khronos asynchronous WebGL2 timer API, bounded pending queries, disjoint
rejection and disposal. Short three-second static windows returned pending
queries rather than valid times; no timings were invented for those windows.
The live 120-second diagnostic collected 555 valid software-backend GPU samples,
median about 128.3 ms. This remains SwiftShader timing, not a physical GPU result.
The release reruns the query-enabled benchmark with its normal ten-second views.

A 60-second flight/streaming smoke observation advanced real simulated flight
without a crash. Its tightened policy rejects paused, frozen, nonfinite,
wrong-world or missing-landmark states. It is not the twenty-minute gate: the
release workflow performs a fresh 1200-second observation and retains the actual
result. Browser CI receives 40 minutes for source reconstruction plus real UI
checks; the release job receives 90 minutes including endurance and archive upload.
No assertion, takeoff requirement or installation check is removed.

The new release format was locally verified using the genuine installed APK,
matching browser HTML, raw instrumentation XML, processed pack and preserved
raw archives. This validates archive/checksum/source correspondence before the
publishing workflow independently repeats all gates. It does not publish or
pretend that a future release run already passed.

Historical reports elsewhere describe earlier build hashes;
they do not establish acceptance for a different build. Galaxy A51 testing,
native phone memory, thermal/battery behaviour, safe-STOVL touchdown and commercial
visual parity remain unqualified.
