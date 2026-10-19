"""Archive completed row checks before removing bulky raw scene telemetry."""
import json
import os
from pathlib import Path
import sys
import time

root, destination, parent = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
seen = set()
if destination.exists():
    seen = {json.loads(line)['name'] for line in destination.read_text().splitlines()}
while True:
    for path in root.glob('*/metrics.json'):
        if time.time() - path.stat().st_mtime < 15:
            continue
        try:
            data = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if path.parent.name not in seen:
            compact = {key: data.get(key) for key in ('spec', 'backend', 'requestedBackend', 'tier', 'actualTier', 'frames', 'timing', 'checks', 'consoleErrors')}
            compact['name'] = path.parent.name
            metrics = data.get('metrics', {})
            compact['perf'] = {key: metrics.get(key) for key in ('backend', 'quality', 'drawCalls', 'triangles', 'simMs', 'awakeProps')}
            with destination.open('a') as stream:
                stream.write(json.dumps(compact, separators=(',', ':')) + '\n')
                stream.flush()
                os.fsync(stream.fileno())
            seen.add(path.parent.name)
        path.unlink()
    try:
        os.kill(parent, 0)
    except ProcessLookupError:
        break
    time.sleep(15)
