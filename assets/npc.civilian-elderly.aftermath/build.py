"""Authored aftermath skin; retain the shipped civilian rigid rig."""
import sys
from pathlib import Path
from sslib.aftermath import build_aftermath
args = sys.argv[sys.argv.index("--") + 1:]
build_aftermath(Path(__file__).parent, args[args.index("--glb") + 1])
