"""Reproducible authored LODs for wpn.halligan; see notes.md."""
import sys
from pathlib import Path
import bpy
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.rescue_assets import build_set
build_set('wpn.halligan', HERE)
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
