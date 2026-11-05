"""Bake only the Northgate road extension; existing W0–W5 ground stays exact."""
import bpy, sys, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/blender'))
from sslib import export, palette
bpy.ops.wm.read_factory_settings(use_empty=True)
root = bpy.data.objects.new('root', None); bpy.context.collection.objects.link(root)
verts, faces, supports = [], [], []
def slab(x0, x1, z0, z1, h):
    i = len(verts)
    verts.extend([(x0,-z0,h),(x1,-z0,h),(x1,-z1,h),(x0,-z1,h)])
    faces.append((i+3,i+2,i+1,i))
def wall(points):
    i = len(verts)
    verts.extend(points)
    faces.append((i,i+1,i+2,i+3))
# Continuous low ground fills the wider camera without raising the playable verges.
slab(85,350,-60,2,-.01); slab(85,350,30,90,-.01)
for i in range(53):
    x = 85 + 5*i; h = min(3.9, max(0, (x-85)/130*3.9))
    slab(x,x+5,2,30,h)
    if h > 0:
        # Q-289: low terraces form a climbable embankment rather than a 3.9 m
        # blank vertical face with no gameplay wall behind it.
        for side, width in [(-1, 17), (1, 15)]:
            edge = 2 if side == -1 else 30
            for j in range(26):
                near = edge + side * width * j / 26
                far = edge + side * width * (j + 1) / 26
                top = h * (25 - j) / 26
                z0, z1 = sorted((near, far))
                slab(x, x+5, z0, z1, top)
                supports.append({'height': top, 'polygon': [[x,z0],[x+5,z0],[x+5,z1],[x,z1],[x,z0]]})
                upper = h * (26 - j) / 26
                wall([(x,-near,top),(x+5,-near,top),(x+5,-near,upper),(x,-near,upper)])
                previous = min(3.9, max(0, (x-90)/130*3.9)) * (25-j) / 26
                if top > previous:
                    wall([(x,-z0,previous),(x,-z1,previous),(x,-z1,top),(x,-z0,top)])
        previous = min(3.9, max(0, (x-90)/130*3.9))
        if h > previous:
            wall([(x,-2,previous),(x,-30,previous),(x,-30,h),(x,-2,h)])
    supports.append({'height': h, 'polygon': [[x,2],[x+5,2],[x+5,30],[x,30],[x,2]]})
wall([(350,-30,0),(350,-2,0),(350,-2,3.9),(350,-30,3.9)])
slab(85,94,-44,2,.05); slab(85,94,30,50,.05)
mesh=bpy.data.meshes.new('northgateRoad');mesh.from_pydata(verts,[],faces);mesh.materials.append(palette.mat('asphalt'))
o=bpy.data.objects.new('northgateRoad',mesh);bpy.context.collection.objects.link(o);o.parent=root
bpy.context.view_layer.update()
export.glb(root, ROOT/'public/assets/layouts/D-FAIR.w6.glb')
(ROOT/'public/assets/layouts/D-FAIR.w6.ground.json').write_text(json.dumps(supports, separators=(',', ':')) + '\n')
