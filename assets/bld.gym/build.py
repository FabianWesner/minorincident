"""bld.gym: roofed exterior of int.gym-cafeteria, retaining the accepted interior and supplied LODs."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.roofed_shell import run
run('bld.gym', 'int.gym-cafeteria', __file__)
