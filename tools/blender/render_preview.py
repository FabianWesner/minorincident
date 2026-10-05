"""Shared studio layout preview: blender -b -P this.py -- --layout D-RES."""
import argparse
try:
    import bpy
except ModuleNotFoundError:
    import os
    import subprocess
    import sys
    raise SystemExit(subprocess.call([os.environ.get('BLENDER_BIN','/Applications/Blender.app/Contents/MacOS/Blender'),'-b','-t','4','--python-exit-code','1','--factory-startup','-P',__file__,'--',*sys.argv[1:]]))
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from sslib.layout import box
args=argparse.ArgumentParser(); args.add_argument('--layout',required=True)
opt=args.parse_args(sys.argv[sys.argv.index('--')+1:])
root=Path(__file__).resolve().parents[2]
data=json.loads((root/f'public/assets/layouts/{opt.layout}.layout.json').read_text())
manifest=json.loads((root/'src/assets/manifest.json').read_text())
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/f'public/assets/layouts/{opt.layout}.base.glb'))
for p in data['placements']:
    if p['minTier']>0: continue
    m=manifest[p['assetId']]; d=[m['dimensions'][a]*p['scale'][i] for i,a in enumerate(['x','y','z'])]
    o=box(p['id'],m['token'],d,[p['position'][0],p['position'][1]+d[1]/2,p['position'][2]]); o.rotation_euler.z=-p['yaw']
bpy.ops.object.camera_add(location=(65,-65,70)); camera=bpy.context.object; camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=82
scene=bpy.context.scene; scene.camera=camera; scene.render.engine='CYCLES'; scene.cycles.samples=16
bpy.ops.object.light_add(type='AREA',location=(0,-15,40)); bpy.context.object.data.energy=18000; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=30
scene.world.color=(.25,.25,.3); scene.render.resolution_x=960; scene.render.resolution_y=720; scene.render.resolution_percentage=100
out=root/'test-results/epics/E10/previews'; out.mkdir(parents=True,exist_ok=True); scene.render.filepath=str(out/f'{opt.layout}.png'); bpy.ops.render.render(write_still=True)
