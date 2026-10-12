"""Healthy (uninfected) zoo lion derived from the shipped infected lion's exact rig and proportions.
Headless: python3 tools/blender/run.py assets/amb.lion/build.py --glb assets/amb.lion/model.glb --lod 0   (repeat 1, 2)
"""
import runpy
import sys
from pathlib import Path
sys.argv.append('--healthy')
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'inf.lion/build.py'), run_name='__main__')
