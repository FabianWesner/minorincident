"""Reproducible authored LODs for veh.evac-bus; see notes.md."""
import sys
from pathlib import Path
import bpy
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
if '--decay' in sys.argv:
    kind = sys.argv[sys.argv.index('--decay') + 1]
    if kind == 'burned':
        from sslib.burned_vehicles import build_burned
        build_burned(HERE, sys.argv[sys.argv.index('--glb') + 1])
    elif kind == 'wrecked':
        from sslib.traffic_wrecks import build_wreck
        build_wreck(HERE, sys.argv[sys.argv.index('--glb') + 1])
    raise SystemExit(0)
from sslib.evac_bus import build_set
build_set('veh.evac-bus', HERE)
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
