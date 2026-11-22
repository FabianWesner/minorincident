"""A rooted clump of pond reeds with simple authored distance tiers."""
import math
import os
import bpy
from sslib.palette import mat
from sslib.export import merge_by_material

def build(ctx):
    root=ctx.root
    root.name='root'
    lod=int(os.environ.get('MI_ZOO_REEDS_LOD','0'))
    # A compact earthen root mass makes the clump a real obstruction.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1, location=(0,0,.28))
    base=bpy.context.object; base.name='root-mass'; base.scale=(.45,.42,.28); base.data.materials.append(mat('khakiSeam')); base.parent=root
    stems=[(-.23,-.16,1.35),(.22,-.17,1.65),(-.12,.18,1.7),(.2,.15,1.4),(0,0,1.9)]
    if lod==1: stems=stems[::2]
    if lod==2: stems=[(0,0,1.7)]
    for i,(x,y,h) in enumerate(stems):
        bpy.ops.mesh.primitive_cone_add(vertices=5 if lod==0 else 4, radius1=.08, radius2=.025, depth=h, location=(x,y,.25+h/2))
        o=bpy.context.object; o.name='reed-stalk'; o.rotation_euler.y=(i-2)*.025; o.data.materials.append(mat('apronOlive')); o.parent=root
        if lod==0:
            bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=1, location=(x,y,.25+h))
            o=bpy.context.object; o.name='reed-head'; o.scale=(.07,.07,.2); o.data.materials.append(mat('hairBrown')); o.parent=root
    front=bpy.data.objects.new('front',None); bpy.context.scene.collection.objects.link(front); front.parent=root; front.location=(.4,0,.7)
    merge_by_material(root,set(),preserve_vertex_colors=True)
    return root
