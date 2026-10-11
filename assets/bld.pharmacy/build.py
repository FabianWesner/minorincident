"""bld.pharmacy: roofed exterior of int.pharmacy-clinic, retaining the accepted interior and supplied LODs."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.roofed_shell import run
run('bld.pharmacy', 'int.pharmacy-clinic', __file__)
