"""kit.reception-plaza: authored LODs (0/1/2) from explicit recipes; see sslib/army_plaza.py."""
import shutil
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.army_core import build_set
from sslib.army_plaza import recipe
build_set('kit.reception-plaza', HERE, recipe)
if '--glb' in sys.argv:
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb':
        shutil.copyfile(HERE / 'model.glb', output)
