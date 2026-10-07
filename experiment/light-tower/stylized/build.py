# Identity features: yellow generator box; four oversized wheels; tall telescoping
# mast; twin rectangular glowing floodlights; broad side grille; rear carry handle.
# Simplified parts: beveled housing and lid, dark chassis, four 12-sided wheels
# with simple hubs, two mast stages/collars, two lamp cases and luminous faces,
# one grille with three broad slats, three-piece handle, fuel cap.
# Dropped: bolts, tread blocks, hinges, controls, panel seams, lettering, cables.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16)
p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
p.add_argument('--glb'); p.add_argument('--blend')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
S=bpy.context.scene; S.unit_settings.system='METRIC'
def mat(token,hex,emission=False):
    c=tuple(int(hex[i:i+2],16)/255 for i in (0,2,4))
    # Palette hex values are sRGB; Blender socket values are linear.
    c=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c)
    m=bpy.data.materials.new(('emi_' if emission else 'pal_')+token); m.diffuse_color=(*c,1); m.use_nodes=True
    n=m.node_tree.nodes.get('Principled BSDF'); n.inputs['Base Color'].default_value=(*c,1); n.inputs['Metallic'].default_value=0; n.inputs['Roughness'].default_value=.78
    if emission: n.inputs['Emission Color'].default_value=(*c,1); n.inputs['Emission Strength'].default_value=3
    return m
Y=mat('schoolBusYellow','f2b630'); D=mat('uiDark','25222c'); G=mat('sidewalk','b9a4a0'); W=mat('picketWhite','f2e6dc'); E=mat('windowGlow','ffc773',True)
static=[]; wheels=[]
def box(name,loc,size,m,bevel=0,group=True):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('soft toy edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    if group: static.append(o)
    return o
def cyl(name,loc,r,depth,m,axis='Z',group=True,verts=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc); o=bpy.context.object; o.name=name
    if axis=='Y': o.rotation_euler[0]=math.pi/2
    if axis=='X': o.rotation_euler[1]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(m)
    if group: static.append(o)
    return o
box('generator_shell',(0,0,1.06),(2.25,1.26,1.2),Y,.13)
box('lid',(0,0,1.67),(2.29,1.29,.22),Y,.08)
box('chassis',(0,0,.48),(2.55,1.42,.24),D,.06)
# Broad dark front mast mount is a strong graphic stripe.
box('mast_mount',(1.04,0,1.16),(.23,.47,1.15),D,.045)
box('side_grille',(-.32,-.64,1.22),(.94,.065,.55),D,.045)
for z in [1.08,1.22,1.36]: box('grille_slat',(-.32,-.682,z),(.78,.04,.045),G)
# Opposite side has the same simple readable ventilation treatment.
box('far_grille',(-.32,.64,1.22),(.94,.065,.55),D,.045)
for z in [1.08,1.22,1.36]: box('grille_slat',(-.32,.682,z),(.78,.04,.045),G)
# Four separate pivoted wheel assemblies, no tread or lug geometry.
for x,label in [(.78,'front'),(-.78,'rear')]:
    for y,side in [(-.77,'left'),(.77,'right')]:
        tire=cyl('wheel_'+label+'_'+side,(x,y,.37),.37,.28,D,'Y',False)
        s=-1 if y<0 else 1
        hub=cyl('hub',(x,y+s*.145,.37),.215,.035,G,'Y',False)
        cap=cyl('hub_center',(x,y+s*.17,.37),.095,.045,D,'Y',False,verts=8)
        bpy.ops.object.select_all(action='DESELECT')
        for o in [tire,hub,cap]: o.select_set(True)
        bpy.context.view_layer.objects.active=tire; bpy.ops.object.join(); wheels.append(tire)
# Mast slightly shortened and thickened for distant silhouette.
cyl('mast_lower',(.96,0,2.13),.145,1.12,G)
cyl('mast_upper',(.96,0,3.07),.105,.97,W)
cyl('mast_collar',(.96,0,2.64),.18,.14,D)
cyl('mast_top_joint',(.96,0,3.57),.16,.19,D)
box('lamp_crossbar',(.96,0,3.64),(.22,1.38,.14),D,.025)
# Both lamps face +X; exaggerated thick yellow rim and inset luminous panel.
for y in [-.49,.49]:
    case=box('floodlight_case',(.98,y,3.91),(.32,.84,.64),Y,.075)
    box('lamp_recess',(1.153,y,3.91),(.018,.69,.49),D,.035)
    box('lamp_glow',(1.17,y,3.91),(.025,.58,.38),E,.025)
# Chunky inverted U handle over the rear; no tiny hardware.
for y in [-.45,.45]: box('handle_leg',(-.86,y,1.88),(.14,.14,.4),Y,.035)
box('carry_handle',(-.86,0,2.04),(.16,1.04,.16),Y,.04)
cyl('fuel_cap',(-.46,0,1.82),.18,.09,D)
# Join static geometry by material, retaining rotating wheel pivots.
buckets={m:[o for o in static if o.data.materials[0]==m] for m in [Y,D,G,W,E]}
for m,objs in buckets.items():
    if objs:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name='body' if m==Y else 'static_'+m.name
asset=[o for o in S.objects if o.type=='MESH']
root=bpy.data.objects.new('light_tower',None); S.collection.objects.link(root)
for o in asset:o.parent=root
tri=sum(len(poly.vertices)-2 for o in asset for poly in o.data.polygons)
print('OK asset triangles',tri,'meshes',len(asset))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_cameras=False,export_lights=False)
# Presentation stage is excluded from export.
floor=mat('stage','5b4f5c')
box('stage_ground',(0,0,-.075),(200,200,.15),floor,group=False)
world=S.world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.19,.3,1); world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(3,-4,7)); key=bpy.context.object; key.data.energy=1150; key.data.shape='DISK'; key.data.size=5; key.data.color=(1,.81,.61); key.rotation_euler=(Vector((0,0,1.7))-key.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(-3,2,5)); fill=bpy.context.object; fill.data.energy=800; fill.data.size=5; fill.data.color=(.66,.73,1); fill.rotation_euler=(Vector((0,0,2))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; S.camera=cam; cam.data.type='PERSP'; cam.data.lens=81.2
if a.view=='game':
    target=Vector((0,0,1.9)); dist=24; elev=math.radians(36); cam.location=target+Vector((dist*math.cos(elev)/math.sqrt(2),-dist*math.cos(elev)/math.sqrt(2),dist*math.sin(elev)))
else: target=Vector((0,0,2)); cam.location=(9.6,-12.8,8.4); cam.data.lens=65
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
S.render.engine='CYCLES'; S.cycles.samples=a.samples
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices:d.use=True
    S.cycles.device='GPU'
except Exception: pass
S.render.resolution_x=a.width; S.render.resolution_y=a.height; S.render.resolution_percentage=100
S.view_settings.view_transform='AgX'; S.render.image_settings.file_format='PNG'
if a.blend:bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render:S.render.filepath=a.render; bpy.ops.render.render(write_still=True)
