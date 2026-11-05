"""L6 adult variant derived from the shipped civilian sculpt and rig."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.shelter_adults import build_adult

if "--glb" in sys.argv:
    build_adult(Path(__file__).resolve().parent, sys.argv[sys.argv.index("--glb") + 1])
