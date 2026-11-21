"""Timber climbing frame with rope and a hanging tyre for zoo enclosures."""
import math
import os
import bpy
from mathutils import Vector
from sslib.palette import mat

def build(ctx):
    root = ctx.root
    root.name = 'root'
    lod = int(os.environ.get('MI_ZOO_FRAME_LOD', '0'))
    def rod(name, a, b, radius, token, vertices=8):
        a, b = Vector(a), Vector(b)
        delta = b - a
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices if not lod else 4, radius=radius, depth=delta.length, location=(a+b)/2)
        obj = bpy.context.object
        obj.name = name
        obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
        obj.data.materials.append(mat(token))
        obj.parent = root
    # Four grounded trunks and raised crosspieces give monkeys room below.
    for x in (-1.8, 1.8):
        for y in (-1.1, 1.1):
            rod('trunk', (x,y,0), (x,y,3.5), .16, 'woodWarm')
    for y in (-1.1, 1.1):
        rod('top-log', (-1.95,y,3.35), (1.95,y,3.35), .16, 'woodWarm')
    if lod < 2:
        for x in (-1.8, 1.8):
            rod('cross-log', (x,-1.25,3.1), (x,1.25,3.1), .13, 'woodWarm')
    if lod == 0:
        for x in (-1.25, -.8, -.35, .1, .55, 1):
            rod('ladder-rung', (x,-1.12,1.2), (x,1.12,1.2), .055, 'khakiLight', 6)
        rod('swing-rope', (.95,0,3.2), (.95,0,1.35), .035, 'canvasTan', 6)
        bpy.ops.mesh.primitive_torus_add(major_segments=12, minor_segments=6, location=(.95,0,1.0), major_radius=.33, minor_radius=.105, rotation=(math.pi/2,0,0))
        tyre=bpy.context.object; tyre.name='tyre'; tyre.data.materials.append(mat('uiDark')); tyre.parent=root
    front = bpy.data.objects.new('front', None)
    bpy.context.scene.collection.objects.link(front)
    front.parent = root
    front.location = (2.05, 0, 1.7)
    from sslib.export import merge_by_material
    merge_by_material(root, set(), preserve_vertex_colors=True)
    return root
