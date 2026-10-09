"""Base-owned wreck wrapper; runtime registration belongs to veh.tank."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.military_wrecks import build_wreck
build_wreck(Path(__file__).resolve().parent.with_name("veh.tank"), sys.argv[sys.argv.index("--glb") + 1])
