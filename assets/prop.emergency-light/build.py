"""Authored L6 fixture and distance tiers; see notes.md."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "tools/blender"))
from sslib.subway_fixtures import build_set
build_set('prop.emergency-light', HERE)
