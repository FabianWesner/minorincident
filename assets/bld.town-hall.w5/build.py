"""Base-owned W5 derivative; imports the integrated authored tier GLBs."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.fairhaven_w5 import main
main('bld.town-hall', Path(__file__).resolve().parent.parent / 'bld.town-hall')
