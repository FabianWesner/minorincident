"""Authored L3 frontage; see notes.md for interfaces and source reference."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "tools/blender"))
from sslib.street_frontages import run
run('bld.bus-stop', __file__, 'w2')
