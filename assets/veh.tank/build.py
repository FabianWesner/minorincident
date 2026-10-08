import sys
from pathlib import Path
if "--decay" in sys.argv and sys.argv[sys.argv.index("--decay") + 1] == "wrecked":
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
    from sslib.military_wrecks import build_wreck
    build_wreck(Path(__file__).resolve().parent, sys.argv[sys.argv.index("--glb") + 1])
    raise SystemExit(0)

"""veh.tank: authored LODs (0/1/2) from explicit recipes; see sslib/army_tank.py."""
import shutil
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.army_core import build_set
from sslib.army_tank import recipe
build_set('veh.tank', HERE, recipe, 'veh.tank')
if '--glb' in sys.argv:
    output = Path(sys.argv[sys.argv.index('--glb') + 1]).resolve()
    if output != HERE / 'model.glb':
        shutil.copyfile(HERE / 'model.glb', output)
