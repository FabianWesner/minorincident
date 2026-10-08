"""bld.kessler-hardware: Fairhaven hardware store with rear cellar door. Authored LODs (no decimation)."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.fh_kessler import recipe
if '--decay' in sys.argv:
    from sslib.fairhaven_w5 import run as run_damage
    run_damage('bld.kessler-hardware', __file__)
else:
    run('bld.kessler-hardware', __file__, recipe)
