"""kit.dispersal-pipe-tee: authored LODs (0/1/2) from explicit recipes; see sslib/minigun_cure.py."""
import shutil
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.army_core import build_set
from sslib.minigun_cure import kit_dispersal_pipe_tee as recipe
build_set('kit.dispersal-pipe-tee', HERE, recipe)
if '--glb' in sys.argv:
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb':
        shutil.copyfile(HERE / 'model.glb', output)
