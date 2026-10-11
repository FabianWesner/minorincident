"""int.basement-cellar: Kessler cellar interior (stairs, shelves, bulb anchor, barrable door). Authored LODs."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.fh_cellar import recipe
run('int.basement-cellar', __file__, recipe, 'interior')

# The cellar is placed standalone in Fairhaven: cap it outside, lift only its own lid inside.
from sslib.roofed_shell import run as roofed
roofed('int.basement-cellar', 'int.basement-cellar', __file__)
