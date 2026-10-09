"""Base-owned W5 wrapper; canonical build: assets:build -- bld.kessler-hardware --decay w5."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools/blender"))
from sslib.fairhaven_w5 import run
run("bld.kessler-hardware", __file__)
