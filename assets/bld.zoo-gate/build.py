"""Authored park/zoo exterior with complete native distance tiers."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "tools/blender"))
from sslib.park_zoo import run
run('bld.zoo-gate', __file__)
