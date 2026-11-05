"""Old male palette skin (kept as the armature input rig-source.skin.glb of build.py). Run Blender headless.
Blender -b --python assets/char.courier-male-skin/build-palette.py -- --glb assets/char.courier-male-skin/rig-source.skin.glb
"""
from pathlib import Path
import sys, runpy
sys.argv += ['--variant', 'male']
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'char.courier-female-skin/build-palette.py'), run_name='__main__')
