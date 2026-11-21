"""A low, irregular stone outcrop for enclosure cover."""
import os
import bpy
from sslib.palette import mat
from sslib.export import merge_by_material

def build(ctx):
    root = ctx.root
    root.name = 'root'
    lod = int(os.environ.get('MI_ZOO_ROCK_LOD', '0'))
    # Overlapping angular stones give a long, low cover silhouette.
    pieces = [(-.92, -.04, .48, 1.0, .48, .48), (.12, .08, .57, 1.05, .53, .57), (.98, -.05, .45, .78, .46, .45)]
    if lod == 2:
        pieces = [(0, 0, .54, 1.72, .58, .54)]
    for i, (x, y, z, sx, sy, sz) in enumerate(pieces):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2 if lod == 0 else 1, radius=1, location=(x, y, z))
        obj = bpy.context.object
        obj.name = 'stone'
        obj.scale = (sx, sy, sz)
        obj.rotation_euler.z = .23 * i
        obj.data.materials.append(mat('khakiSeam' if i % 2 else 'khaki'))
        obj.parent = root
    front = bpy.data.objects.new('front', None)
    bpy.context.scene.collection.objects.link(front)
    front.parent = root
    front.location = (1.75, 0, .5)
    merge_by_material(root, set(), preserve_vertex_colors=True)
    return root
