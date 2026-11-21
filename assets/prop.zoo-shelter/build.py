"""Open-sided timber shade shelter for a zoo paddock."""
import os
import bpy
from sslib.palette import mat
from sslib.export import merge_by_material

def build(ctx):
    root = ctx.root
    root.name = 'root'
    lod = int(os.environ.get('MI_ZOO_SHELTER_LOD', '0'))
    def box(name, loc, size, token):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o=bpy.context.object
        o.name=name
        o.dimensions=size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat(token))
        o.parent=root
    for x in (-2.0,2.0):
        for y in (-1.25,1.25): box('post', (x,y,1.25), (.20,.20,2.5), 'woodWarm')
    box('roof', (0,0,2.56), (4.6,3.0,.18), 'khakiSeam')
    if lod == 0:
        for x in (-1.2,-.4,.4,1.2): box('roof-batten',(x,0,2.67),(.08,2.95,.04),'woodWarm')
        for x in (-2.0,2.0): box('crossbeam',(x,0,2.37),(.18,2.7,.18),'hairBrown')
    front=bpy.data.objects.new('front',None)
    bpy.context.scene.collection.objects.link(front)
    front.parent=root
    front.location=(2.3,0,1.3)
    merge_by_material(root,set(),preserve_vertex_colors=True)
    return root
