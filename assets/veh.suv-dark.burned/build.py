"""Base-owned burned wrapper; runtime registration belongs to the intact car."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.civilian_burned import build_burned
build_burned(Path(__file__).resolve().parent.parent / 'veh.suv-dark', sys.argv[sys.argv.index('--glb') + 1])
