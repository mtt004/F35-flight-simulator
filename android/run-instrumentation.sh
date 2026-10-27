#!/usr/bin/env bash
# Run precompiled device tests while retaining host evidence if QEMU disappears.
set -uo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
diagnostics_dir="$project_root/dist/android-host-diagnostics"
mkdir -p "$diagnostics_dir"
(
  while true; do
    date -u +'%Y-%m-%dT%H:%M:%SZ'
    free -m
    ps -eo pid,comm,rss --sort=-rss | head -n 16
    sleep 5
  done
) > "$diagnostics_dir/host-memory-samples.txt" 2>&1 &
sampler_pid=$!
collect_diagnostics() {
  kill "$sampler_pid" 2>/dev/null || true
  wait "$sampler_pid" 2>/dev/null || true
  free -m > "$diagnostics_dir/host-memory-final.txt"
  if [ -f /sys/fs/cgroup/memory.events ]; then
    cat /sys/fs/cgroup/memory.events > "$diagnostics_dir/cgroup-memory-events.txt"
  fi
  if command -v sudo >/dev/null; then
    sudo -n dmesg --ctime 2>/dev/null | grep -Ei 'out of memory|oom-kill|killed process|segfault|qemu' | tail -n 80 > "$diagnostics_dir/host-kernel-events.txt" || true
  fi
  # Preserve only bounded emulator-created crash evidence, not arbitrary runner files.
  python3 - "$diagnostics_dir" <<'PYTHON'
from pathlib import Path
import shutil, sys
source = Path('/tmp/android-runner')
destination = Path(sys.argv[1]) / 'emulator-native-crash'
remaining = 20 * 1024 * 1024
if source.is_dir():
    for path in sorted(source.rglob('*')):
        if path.is_symlink() or not path.is_file() or path.suffix not in {'.dmp', '.log', '.txt'}:
            continue
        size = path.stat().st_size
        if size > 5 * 1024 * 1024 or size > remaining:
            continue
        target = destination / path.relative_to(source)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        remaining -= size
PYTHON
  timeout 15s adb -s emulator-5554 get-state > "$diagnostics_dir/emulator-final-state.txt" 2>&1 || true
  timeout 20s adb -s emulator-5554 logcat -d -t 1200 > "$diagnostics_dir/android-logcat-final.txt" 2>&1 || true
}
trap collect_diagnostics EXIT
cd android
timeout --signal=TERM --kill-after=20s 10m bash ./gradlew --no-daemon --max-workers=1 connectedDebugAndroidTest
exit "$?"
