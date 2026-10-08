"""Base-owned wreck wrapper; runtime registration belongs to the base vehicle."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.traffic_wrecks import build_wreck
build_wreck(Path(__file__).resolve().parent.parent / 'veh.sedan-white', sys.argv[sys.argv.index('--glb') + 1])
