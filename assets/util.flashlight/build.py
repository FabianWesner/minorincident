"""Chunky mountable flashlight; runtime beam is represented by an ss_light anchor."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.fairhaven import run
from sslib.l5_arrival import flashlight
run('util.flashlight',__file__,flashlight)
