"""bld.metro-entrance: Fairhaven Metro stair canopy with shutter. Authored LODs (no decimation)."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.fh_metro import recipe
if '--decay' in sys.argv:
    from sslib.fairhaven_w5 import run as run_damage
    run_damage('bld.metro-entrance', __file__)
else:
    run('bld.metro-entrance', __file__, recipe)
