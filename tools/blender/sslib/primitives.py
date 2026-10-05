import bpy


def rounded_box(name, size, mat, center=(0, 0, 0), bevel=.03):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new('bevel', 'BEVEL')
    modifier.width = min(bevel, min(size) * .4)
    modifier.segments = 2
    return obj


def cylinder(name, radius, depth, mat, center=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def tapered_limb(name, radius, depth, mat, center=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=radius * .7, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj
