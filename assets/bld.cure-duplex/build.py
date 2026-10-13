"""Reproducible authored LODs for bld.cure-duplex (L10 cure kit); see notes.md and tools/blender/sslib/cure_kits.py."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.cure_kits import build_set
build_set('bld.cure-duplex', HERE)
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
