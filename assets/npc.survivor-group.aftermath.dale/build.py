"""Independent member of the authored stock survivor skin."""
import sys
from pathlib import Path
from sslib.aftermath import build_member
args = sys.argv[sys.argv.index("--") + 1:]
build_member(Path(__file__).parent, args[args.index("--glb") + 1])
