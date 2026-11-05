"""Base-owned burned variant; no conflicting canonical runtime registration."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools/blender'))
from sslib.burned_vehicles import build_burned
build_burned(Path(__file__).resolve().parent.parent / 'veh.school-bus', sys.argv[sys.argv.index('--glb') + 1])
