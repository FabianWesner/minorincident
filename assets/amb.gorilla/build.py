"""Healthy (uninfected) zoo silverback derived from the shipped infected gorilla's exact rig and proportions.
Headless: python3 tools/blender/run.py assets/amb.gorilla/build.py --glb assets/amb.gorilla/model.glb
(one run writes model.glb, model.lod1.glb and model.lod2.glb)
"""
import runpy
import sys
from pathlib import Path
sys.argv.append('--healthy')
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'inf.gorilla/build.py'), run_name='__main__')
