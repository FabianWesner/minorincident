"""Deterministic CPU Cycles AO, exported as the active COLOR_0 vertex attribute."""
import bpy


def bake(obj, samples=32):
    bake_all([obj], samples)


def bake_all(objects, samples=32):
    meshes = [obj for obj in objects if obj.type == 'MESH']
    if not meshes:
        return
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.seed = 17
    scene.cycles.use_animated_seed = False
    scene.render.bake.target = 'VERTEX_COLORS'
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in meshes)
    for obj in meshes:
        layer = obj.data.color_attributes.get('ao')
        if layer is None:
            layer = obj.data.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='CORNER')
        obj.data.color_attributes.active_color = layer
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.bake(type='AO', use_clear=True)
