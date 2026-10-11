"""bld.supermarket: roofed exterior of int.supermarket, retaining the accepted interior and supplied LODs."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.roofed_shell import run
run('bld.supermarket', 'int.supermarket', __file__)
