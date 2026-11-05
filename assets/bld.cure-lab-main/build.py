"""Reproducible authored LODs for bld.cure-lab-main (L10 cure kit, row A5); see notes.md and tools/blender/sslib/cure_kits.py and cure_kits_a5.py."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.cure_kits_a5 import build_set
build_set('bld.cure-lab-main', HERE)
if '--glb' in sys.argv:
    import shutil
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb': shutil.copyfile(HERE / 'model.glb', output)
