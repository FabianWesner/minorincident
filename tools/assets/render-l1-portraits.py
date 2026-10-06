"""Render HUD head portraits from existing art; run through experiment/tools/blender_run.py."""
import bpy
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
for needed,source in [('survivor-m','char.survivor-male'),('survivor-f','char.survivor-female'),('corgi','char.corgi')]:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/'assets'/source/'model.glb'))
 head=bpy.data.objects.get('head')
 keep={head,*head.children_recursive}
 for obj in list(bpy.data.objects):
  if obj.type=='MESH' and obj not in keep: bpy.data.objects.remove(obj,do_unlink=True)
 points=[obj.matrix_world@Vector(c) for obj in keep if obj.type=='MESH' for c in obj.bound_box]
 lo=Vector(tuple(min(p[i] for p in points) for i in range(3)));hi=Vector(tuple(max(p[i] for p in points) for i in range(3)));center=(lo+hi)/2
 bpy.ops.object.camera_add(location=center+Vector((4,-5,2.5)))
 cam=bpy.context.object;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=max(hi-lo)*1.4;bpy.context.scene.camera=cam
 for loc,power,size in [((3,-4,6),450,5),((-4,-1,3),180,4)]:
  bpy.ops.object.light_add(type='AREA',location=center+Vector(loc));light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16;scene.render.resolution_x=256;scene.render.resolution_y=256;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(root/'public/assets/ui'/f'portrait-{needed}.png');scene.world=bpy.data.worlds.new('portrait-world');scene.world.color=(.2,.2,.2)
 bpy.ops.render.render(write_still=True)
