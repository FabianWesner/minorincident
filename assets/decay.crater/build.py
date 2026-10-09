"""Authored L5 debris tiers; see notes.md for terrain/collision interfaces."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "tools/blender"))
from sslib.war_debris import build_set
build_set('decay.crater', HERE)
