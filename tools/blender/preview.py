"""Workbench preview sheets for the clean low-poly builds (no GPU slot; flat palette colours, studio light)."""
import math
import bpy
import numpy as np
from mathutils import Vector


def render_sheet(path, views=('front', 'side', 'back', 'game'), size=520, target=(.25, 0, 1.15), dist=7.5, scale=2.7, bg=(.30, .26, .30)):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    sh = scene.display.shading
    sh.light = 'STUDIO'
    sh.color_type = 'MATERIAL'
    sh.show_cavity = False
    sh.show_shadows = True
    sh.studio_light = 'Default' if 'Default' in [s.name for s in bpy.context.preferences.studio_lights] else sh.studio_light
    world = bpy.data.worlds.new('w')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (*bg, 1)
    scene.world = world
    scene.render.film_transparent = False
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    dirs = {'front': (1, 0, .1), 'side': (0, -1, .1), 'back': (-1, 0, .1), 'game': (.62, -.62, .62), 'game2': (-.5, -.7, .55),
            'top': (.1, 0, 1), 'hero': (.8, -.45, .25), 'close': (.8, -.3, .3)}
    tiles = []
    for v in views:
        d = Vector(dirs[v]).normalized()
        tgt = Vector(target)
        cam.location = tgt + d * dist
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = path + f'.{v}.png'
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(scene.render.filepath)
        w, h = im.size
        px = np.empty(w * h * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        tiles.append(px.reshape(h, w, 4))
        bpy.data.images.remove(im)
    sheet = np.concatenate(tiles, axis=1)
    out = bpy.data.images.new('sheet', width=sheet.shape[1], height=sheet.shape[0], alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = path
    out.file_format = 'PNG'
    out.save()
    import os
    for v in views:
        os.remove(path + f'.{v}.png')
