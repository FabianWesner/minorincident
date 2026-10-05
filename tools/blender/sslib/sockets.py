import bpy


def empty(name, position=(0, 0, 0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = position
    obj.parent = parent
    return obj
