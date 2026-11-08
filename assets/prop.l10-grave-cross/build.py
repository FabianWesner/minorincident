"""Small field grave cross; one palette mesh, no physics or text dependency."""
import bpy
from mathutils import Vector
from sslib import palette

def build(ctx):
    root = ctx.root
    wood = palette.mat('woodWarm')
    parts = []
    def bar(name, location, dimensions):
        bpy.ops.mesh.primitive_cube_add(size=1, location=location)
        obj = bpy.context.object
        obj.name = name
        obj.dimensions = dimensions
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.data.materials.append(wood)
        obj.parent = root
        parts.append(obj)
    # Cross planted at grade, 0.82 m tall and intentionally readable at distance.
    bar('upright', (0, 0, .41), (.075, .075, .82))
    bar('arms', (0, 0, .59), (.48, .065, .075))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = parts[0]; body.name = 'body'; body.parent = root
    body.location = (0, 0, 0)
    return root
