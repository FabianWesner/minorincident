"""Low, heavy timber barrier for an elephant habitat."""
import os
import bpy
from mathutils import Vector
from sslib.palette import mat
from sslib.export import merge_by_material

def build(ctx):
    root = ctx.root
    root.name = 'root'
    lod = int(os.environ.get('MI_ZOO_LOG_LOD', '0'))
    def log(name, a, b, radius, token):
        a, b = Vector(a), Vector(b)
        d = b - a
        bpy.ops.mesh.primitive_cylinder_add(vertices=10 if lod == 0 else 6 if lod == 1 else 4, radius=radius, depth=d.length, location=(a+b)/2)
        o = bpy.context.object
        o.name = name
        o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        o.data.materials.append(mat(token))
        o.parent = root
    for z in (.32, .90):
        log('horizontal-log', (-1.8, 0, z), (1.8, 0, z), .30, 'woodWarm')
    if lod < 2:
        for x in (-1.35, 1.35):
            log('upright', (x, 0, 0), (x, 0, 1.35), .20, 'hairBrown')
    front = bpy.data.objects.new('front', None)
    bpy.context.scene.collection.objects.link(front)
    front.parent = root
    front.location = (1.8, 0, .6)
    merge_by_material(root, set(), preserve_vertex_colors=True)
    return root
