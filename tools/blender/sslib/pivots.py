from mathutils import Matrix, Vector
import bpy


def at(obj, position):
    """Move a mesh origin without moving its world-space geometry."""
    bpy.context.view_layer.update()
    delta = obj.matrix_world.inverted() @ Vector(position)
    if obj.type == 'MESH':
        obj.data.transform(Matrix.Translation(-delta))
    obj.matrix_world.translation = position


def parent(obj, target):
    bpy.context.view_layer.update()
    matrix = obj.matrix_world.copy()
    obj.parent = target
    obj.matrix_world = matrix
