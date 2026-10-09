"""kit.metro-tunnel: authored metro recipes at all three distance tiers."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.l6_metro import tunnel
run('kit.metro-tunnel', __file__, tunnel, 'default')
