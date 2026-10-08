"""Intact Fairhaven landmark with explicit authored distance recipes."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.fairhaven_civic import main
main('bld.town-hall', Path(__file__).resolve().parent)
