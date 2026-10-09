"""Intact Fairhaven landmark with explicit authored distance recipes."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
if '--decay' in sys.argv:
    from sslib.fairhaven_w5 import main
else:
    from sslib.fairhaven_civic import main
main('bld.church', Path(__file__).resolve().parent)
