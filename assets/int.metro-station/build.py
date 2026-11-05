"""Lakeshore concourse/platform, authored near/middle/far recipes."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.fairhaven import run
from sslib.l5_arrival import station
run('int.metro-station',__file__,station,'interior')
