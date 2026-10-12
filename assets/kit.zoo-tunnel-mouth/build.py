"""kit.zoo-tunnel-mouth: L8 service-tunnel outlet (closed masonry bunker, steel double door), all three distance tiers.
Headless: python3 tools/blender/run.py assets/kit.zoo-tunnel-mouth/build.py --glb "$PWD/assets/kit.zoo-tunnel-mouth/model.glb"
"""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.zoo_tunnel import tunnel_mouth
run('kit.zoo-tunnel-mouth', __file__, tunnel_mouth, 'default')
