"""Reproducible authored LODs for decay.rubble-pile; see notes.md. Blender -b --python assets/decay.rubble-pile/build.py"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.rubble import build_rubble
build_rubble(HERE)
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
