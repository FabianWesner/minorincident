# Identity features: chunky blue cabinet; red FIZZ sign; two rows of colorful cans;
# four big selection buttons; deep dark dispensing slot; short block feet.
# Simplified parts: beveled cabinet, raised red face, dark product recess, eight
# ten-sided cans, shelf/buttons, bold block-letter logo, dispensing frame, feet.
# Dropped: scratches/rust, bolts, hinges, panel seams, can lettering, pull tabs.
import bpy, math, argparse, sys, json
from mathutils import Vector
from pathlib import Path
p=argparse.ArgumentParser(); p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--samples',type=int,default=16); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540); p.add_argument('--glb'); p.add_argument('--blend'); a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
colors={'policeBlue':'2f6bff','survivorRed':'d9363e','picketWhite':'f2e6dc','uiDark':'25222c','sidewalk':'b9a4a0','schoolBusYellow':'f2b630'}
mats={}
for token,h in colors.items():
    m=bpy.data.materials.new('pal_'+token); m.diffuse_color=tuple(((int(h[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Metallic'].default_value=0; bs.inputs['Roughness'].default_value=.78; mats[token]=m
parts=[]
def box(name,loc,size,mat,bevel=0,segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(mats[mat])
    if bevel:
        mod=o.modifiers.new('soft toy corners','BEVEL'); mod.width=bevel; mod.segments=segments; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.append(o); return o
box('cabinet',(-.035,0,1.08),(.82,1.12,1.98),'policeBlue',.085,2)
for x in [-.28,.27]:
    for y in [-.40,.40]: box('foot',(x,y,.065),(.24,.23,.13),'uiDark',.02)
box('red front',(.397,0,1.22),(.075,.94,1.53),'survivorRed',.045,2)
box('product recess',(.446,0,.93),(.035,.80,.72),'uiDark',.025)
# +X face: the word reads left to right from the -Y side.
def stroke(y,z,w,h,rot=0):
    o=box('FIZZ stroke',(.457,y,z),(.032,w,h),'picketWhite'); o.rotation_euler.x=rot
bpy.ops.object.text_add(location=(.456,-.365,1.59),rotation=(math.pi/2,0,math.pi/2))
logo=bpy.context.object; logo.name='FIZZ'; logo.data.body='FIZZ'; logo.data.size=.37; logo.data.extrude=.01; logo.data.resolution_u=1; logo.data.materials.append(mats['picketWhite']); bpy.ops.object.convert(target='MESH'); parts.append(bpy.context.object)
# Eight cans with a single broad cream band and chunky yellow tops on blue cans.
def cyl(name,loc,r,depth,mat,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc); o=bpy.context.object; o.name=name; o.data.materials.append(mats[mat]); parts.append(o)
for zc,mat in [(1.13,'policeBlue'),(.77,'survivorRed')]:
    for yy in [-.30,-.10,.10,.30]:
        cyl('can',(.505,yy,zc),.076,.235,mat)
        cyl('can shoulder',(.505,yy,zc+.132),.076,.029,'schoolBusYellow' if zc>1 else mat,.059)
        cyl('can lid',(.505,yy,zc+.151),.060,.016,'sidewalk')
        box('can identity band',(.576,yy,zc),(.015,.105,.06),'picketWhite')
box('selection shelf',(.52,0,.97),(.13,.83,.083),'policeBlue',.012)
for yy in [-.30,-.10,.10,.30]: box('selection button',(.596,yy,.974),(.034,.13,.055),'picketWhite',.008)
box('dispense rim',(.408,0,.295),(.09,.67,.255),'sidewalk',.024)
box('dispense darkness',(.461,0,.305),(.035,.575,.17),'uiDark',.012)
box('dispense lip',(.49,0,.225),(.11,.60,.045),'policeBlue',.01)
# Merge every static part by palette material, preserving six draw calls.
groups={token:[o for o in parts if o.data.materials[0]==mats[token]] for token in mats}
for token,group in groups.items():
    if not group: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group: o.select_set(True)
    bpy.context.view_layer.objects.active=group[0]; bpy.ops.object.join(); group[0].name='body_'+token
asset=[o for o in bpy.context.scene.objects if o.type=='MESH']
root=bpy.data.objects.new('root',None); bpy.context.collection.objects.link(root)
for o in asset: o.parent=root
tri=sum(len(p.vertices)-2 for o in asset for p in o.data.polygons)
print('OK asset triangles',tri,'meshes',len(asset))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT'); root.select_set(True)
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
# Presentation stage is excluded from the model export.
scene=bpy.context.scene
bpy.ops.mesh.primitive_plane_add(size=200); ground=bpy.context.object; ground.name='presentation_ground'; gm=bpy.data.materials.new('stage'); gm.diffuse_color=(.17,.13,.20,1); gm.use_nodes=True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=gm.diffuse_color; ground.data.materials.append(gm)
world=bpy.data.worlds.new('warm studio'); scene.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.28,.40,1); world.node_tree.nodes['Background'].inputs[1].default_value=.5
for loc,power,size,col in [((4,-4,7),650,5,(1,.83,.65)),((-3,2,5),450,4,(.65,.73,1))]:
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=col; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam
if a.view=='game':
    target=Vector((0,0,.95)); dist=12; elev=math.radians(36); cam.location=target+Vector((math.cos(elev)*dist/2**.5,-math.cos(elev)*dist/2**.5,math.sin(elev)*dist)); cam.data.angle=math.radians(25)
else:
    target=Vector((0,0,1.04)); cam.location=(5,-3.6,3.4); cam.data.type='ORTHO'; cam.data.ortho_scale=4.4
cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
scene.render.engine='CYCLES'; scene.cycles.samples=a.samples
scene.cycles.use_denoising=True
scene.render.resolution_x=a.width; scene.render.resolution_y=a.height; scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'; scene.view_settings.look='Medium High Contrast' if False else 'None'
if a.blend: bpy.ops.wm.save_as_mainfile(filepath=a.blend)
if a.render: scene.render.filepath=a.render; bpy.ops.render.render(write_still=True)
