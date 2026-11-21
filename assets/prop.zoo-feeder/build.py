"""Zoo hay rack and water trough, with authored simplified distance tiers."""
import os
import bpy
from sslib.palette import mat
from sslib.export import merge_by_material

def build(ctx):
    root = ctx.root
    water = root.name == 'prop.zoo-trough'
    root.name = 'root'
    lod = int(os.environ.get('MI_ZOO_FEED_LOD', '0'))
    def box(name, loc, size, token):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.name = name
        o.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat(token))
        o.parent = root
    wood = 'khakiSeam' if water else 'woodWarm'
    box('base', (0,0,.18 if lod else .36), (2.2,.85,.36 if lod else .18), wood)
    box('contents', (0,0,.72), (2.02,.67,.16), 'backpackTeal' if water else 'mustard')
    if lod < 2:
        for y in (-.40,.40): box('side', (0,y,.68), (2.2,.10,.55), wood)
        for x in (-1.05,1.05): box('end', (x,0,.68), (.10,.75,.55), wood)
    if lod == 0:
        for x in (-.90,.90):
            for y in (-.30,.30): box('leg', (x,y,.22), (.16,.16,.44), 'hairBrown')
        if not water:
            for x in (-.7,0,.7): box('hay', (x,0,.84), (.45,.5,.18), 'khakiLight')
    front = bpy.data.objects.new('front', None)
    bpy.context.scene.collection.objects.link(front)
    front.parent = root
    front.location = (1.1, 0, .5)
    merge_by_material(root, set(), preserve_vertex_colors=True)
    return root
