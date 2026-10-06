"""Own foliage asset; run only through experiment/tools/blender_run.py."""
import argparse, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools/blender'))
from sslib.foliage_asset import build as build_foliage
p=argparse.ArgumentParser();p.add_argument('--glb',required=True);p.add_argument('--quality',default='high');p.add_argument('--lod1');p.add_argument('--lod2')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
build_foliage('prop.hedge',a.glb)
for path in [a.lod1,a.lod2]:
    if path:build_foliage('prop.hedge',path,8)
