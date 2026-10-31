Project Lightning v0.5.0-experimental preserves v0.4 scenery and removes repeated building construction through exact prepared geometry. It also fixes slow simulation progression under rendering overload.

Source: a931fa33da68160026e2fdc973c4a99e5e7b772d
Validation: https://github.com/mtt004/F35-flight-simulator/actions/runs/41181412616
Review: https://github.com/mtt004/F35-flight-simulator/pull/10

Verified: 169 unit tests; complete offline/save/replay/visual gates; all866 prepared meshes and4,330 attribute arrays byte-equivalent to v0.4;19 visual pairs passed(17 exact); full20-minute CI flight; actual Android13/API33 installation and offline launch. Main CPU streaming phases used63–76% less synchronous work in the paired Node experiment. This is not an FPS or Mali estimate; steady cloud GPU throughput was essentially unchanged.

Physical Galaxy A51/Mali performance and the30FPS target are NOT TESTED. The APK is debug-signed with an ephemeral CI key; a differently signed installed build may require uninstalling before installation. Prepared assets increase HTML size from46.8MB to88.1MB. No intentional graphics-quality reduction was introduced.

Assets include the offline APK and single-HTML browser ZIP, scenery pack, performance report, metrics, matched visual preview, raw evidence, local v0.4/v0.5 sustained-flight evidence and checksums. The performance report explains test methods, memory costs, inherited limitations and rejected attempts.
