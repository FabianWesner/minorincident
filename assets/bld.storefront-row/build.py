"""bld.storefront-row: three connected Fairhaven shops. Authored LODs (no decimation); see notes.md."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.fh_storefront import recipe
if '--decay' in sys.argv:
    from sslib.fairhaven_w5_commerce import run as run_damage
    run_damage('bld.storefront-row', __file__)
else:
    run('bld.storefront-row', __file__, recipe)
