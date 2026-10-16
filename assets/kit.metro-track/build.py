"""kit.metro-track: open track module identical to the tunnel's track, for the station platform run."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.l6_metro import track
run('kit.metro-track', __file__, track, 'default')
