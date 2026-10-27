# Confirmed design decisions: v0.2 acceptance map

27 October 2026. The owner's28 decisions remain authoritative. This records the implemented experimental state, not a replacement specification or a full acceptance pass. `RETAINED/PARTIAL` means inherited code exists and/or incremental changes shipped; it does not certify every original capability or the requested quality. Release source488ea110cb57e5e0ba59605547f6da0687706f41; evidence links are in [delivery audit](delivery-v0.2.md).

| # | Confirmed choice | Actual v0.2 state / remaining gate |
| ---: | --- | --- |
| 1 | Infinite Flight / Microsoft Flight Simulator mixture | PARTIAL. Mobile presentation and authored details; target visual standard not reached. |
| 2 | Balanced visual improvement | PARTIAL. Aircraft/cockpit/airport/material refinements; full scene reconstruction unfinished. |
| 3 | High-detail adaptive F-35B exterior | PARTIAL. Authored near fuselage/intakes/nozzle, quality/distance fallback, actual geometry tests/captures. Gear/silhouette/CAD fidelity remain incomplete; no sustained high-detail device benchmark. |
| 4 | Authentic subtle materials | PARTIAL. Grey material/panel treatment; visual inspiration, no manufacturer material validation. |
| 5 | Detailed functional cockpit | PARTIAL. Added furnishing/controls, preserved HUD and clear display-center test; full functional interior unfinished. |
| 6 | Switchable instruments | IMPLEMENTED in settings: Minimal/Military/Landing. Readability on A51 NOT TESTED. |
| 7 | Precision/cinematic/custom cameras | PARTIAL. Added tracking, distance/shake and precision/fixed options atop inherited camera modes; full camera acceptance unfinished. |
| 8 | Varied procedural biomes | RETAINED/PARTIAL. Seeded world plus palettes/strata; major biome/world overhaul unfinished. |
| 9 | Hampshire and Cappadocia regions | NOT IMPLEMENTED as real geography. Appearance-only JSON palettes are explicitly labeled; dataset/licence investigation only. |
| 10 | Civilian airport detail | PARTIAL. Runway material/designators, instanced terminal windows/hangar doors; complete airport reconstruction unfinished. |
| 11 | Balanced natural/built world | RETAINED/PARTIAL. Existing generated world; cities/roads/ground features have not received full reconstruction. |
| 12 | Adaptive multilevel world detail | RETAINED/PARTIAL. Existing terrain/scene quality plus bounded render policy and near-aircraft fallback; complete streaming/LOD acceptance unfinished. |
| 13 | Advanced layered clouds | RETAINED/PARTIAL. Existing layered procedural clouds; advanced new cloud overhaul not delivered. |
| 14 | Weather graphics and physics | RETAINED/PARTIAL. Existing coupling preserved by unchanged physics; no complete weather-flight regression qualification. |
| 15 | Natural physically inspired lighting | PARTIAL. Restrained material/scene treatment; no full light/atmosphere reconstruction or physical radiometric validation. |
| 16 | Detailed night flying | RETAINED/PARTIAL. Existing lights/night systems; captured/measured night scene, full detailed night acceptance unfinished. |
| 17 | Detailed coasts and reflections | RETAINED/PARTIAL. Original water/coasts; new detailed reflection/coast pipeline unfinished. |
| 18 | Balanced aircraft effects | RETAINED/PARTIAL. Existing effects; full new exhaust/heat/contrail/downwash treatment unfinished. |
| 19 | Hybrid adaptive audio | NOT COMPLETE. Procedural audio retained; no recorded audio assets imported. |
| 20 | Carefully refined flight realism | RETAINED/UNQUALIFIED.16 protected core functions exact, saved-flight/replay integrity fixed, actual control-only takeoff passed. No empirical flight-envelope calibration or full lifecycle pass. |
| 21 | Improved STOVL visuals/modelling | PARTIAL/UNQUALIFIED. Visual detail follows inherited animation. Bounded safe-conversion/vertical-landing pilots failed/timed out; cause unresolved. |
| 22 | Free flight and exploration | RETAINED. Actual browser/native flight starts and advances; complete exploration acceptance unfinished. |
| 23 | Civilian AI aviation | RETAINED/PARTIAL. Existing traffic; full new AI-aircraft visuals/behavior acceptance unfinished. |
| 24 | Fully customizable mobile controls | PARTIAL. Existing handedness/size/sensitivity/dead-zone plus persistent stick offsets/opacity; full arbitrary control layout and physical multitouch acceptance unfinished. |
| 25 | Optional gyroscope | RETAINED/PARTIAL. Existing on/off/calibration path and zero-beta correction; physical sensor behavior NOT TESTED. |
| 26 | Default30FPS / optional higher | IMPLEMENTED policy, PERFORMANCE UNQUALIFIED.30/60 modes, adaptive buffers, hysteresis. Cloud software rendering misses30; A51 NOT TESTED. |
| 27 | Balance heat and graphics | PARTIAL. Governor/fallback exists; no physical power/thermal measurements. Cloud wall-time endurance cannot qualify phone heat. |
| 28 | APK, offline browser, complete source | DELIVERED for experimental v0.2 scope: real signed-debug installed/emulator-tested APK, matching offline single HTML, Git source/build/config/licence/evidence and Releases. Full requested feature scope remains PARTIAL. |

Followups remain tracked in repository issues, especially physical A51 acceptance and [safe STOVL qualification #7](https://github.com/mtt004/F35-flight-simulator/issues/7). No accurate region pack, hybrid recording library or full1.0 overhaul is advertised as complete.
