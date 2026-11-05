"""Living aftermath skin; original civilian anatomy and explicit distance recipes."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.survivor_aftermath import build_aftermath
output = sys.argv[sys.argv.index("--glb") + 1]
build_aftermath(Path(__file__).resolve().parent, output)
