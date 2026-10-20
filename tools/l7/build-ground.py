"""Bake only the Northgate road extension; existing W0–W5 ground stays exact."""
import bpy, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import export, palette
bpy.ops.wm.read_factory_settings(use_empty=True)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
verts, faces = [], []
def slab(x0, x1, z0, z1, h):
    i = len(verts)
    verts.extend([(x0,-z0,h),(x1,-z0,h),(x1,-z1,h),(x0,-z1,h)])
    faces.append((i+3,i+2,i+1,i))
# Presentation apron continues beyond the closed playable strip, including the
# launcher camera's 2x ground footprint. Keep the original stepped road heights;
# physics/nav ownership remains the authored road, as for the town backdrop.
for i in range(53):
    x = 85 + 5*i; h = min(3.9, max(0, (x-85)/130*3.9))
    slab(x,x+5,-60,90,h)
slab(85,94,-44,2,.05); slab(85,94,30,50,.05)
mesh=bpy.data.meshes.new('northgateRoad');mesh.from_pydata(verts,[],faces);mesh.materials.append(palette.mat('asphalt'))
o=bpy.data.objects.new('northgateRoad',mesh);bpy.context.collection.objects.link(o);o.parent=root
bpy.context.view_layer.update()
export.glb(root, ROOT/'public/assets/layouts/D-FAIR.w6.glb')
