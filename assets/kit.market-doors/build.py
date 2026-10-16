"""kit.market-doors: glazed double door set for Grove Market's two L2 doorways."""
import sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'tools/blender'))
from sslib.fairhaven import run
from sslib.l2_market_doors import market_doors
run('kit.market-doors', __file__, market_doors, 'default')
