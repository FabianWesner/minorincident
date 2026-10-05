"""Production Fizz machine. Metres, +X front, Z up. Geometry-only branding.
Static meshes merge by material within their movable assembly. All applied
markings have >=3mm surface clearance. Reference proportions: 1.0 x .70 x 2.16m.
"""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
for flag in ['render', 'glb']: p.add_argument('--' + flag)
p.add_argument('--view', default='ref')
p.add_argument('--samples', type=int, default=24)
p.add_argument('--width', type=int, default=960)
p.add_argument('--height', type=int, default=540)
a = p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M = {}
for token, h in {'policeBlue':'2f6bff','survivorRed':'d9363e','blood':'b3121f','uiDark':'25222c','sidewalk':'b9a4a0','picketWhite':'f2e6dc','schoolBusYellow':'f2b630','woodWarm':'b0703f','windowGlow':'ffc773'}.items():
    rgb = [int(h[i:i+2],16)/255 for i in (0,2,4)]
    color = tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    m = bpy.data.materials.new('pal_'+token); m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value=color
    bs.inputs['Roughness'].default_value=.42 if token in ['policeBlue','survivorRed'] else .65
    if token=='sidewalk': bs.inputs['Metallic'].default_value=.65
    M[token]=m
for token, strength in [('windowGlow',1.3),('survivorRed',.18)]:
    m=M[token].copy(); m.name='emi_'+token
    bs=m.node_tree.nodes['Principled BSDF']; bs.inputs['Emission Color'].default_value=bs.inputs['Base Color'].default_value; bs.inputs['Emission Strength'].default_value=strength
    M['emi_'+token]=m

def empty(name, loc=(0,0,0), parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc
    if parent:
        bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    return o
root=empty('root'); root['asset_id']='prop.vending-machine'
root['ss_physics']=json.dumps({'class':'fixed','mass':180,'friction':.8,'restitution':.05,'pushable':False,'kickable':False,'vaultable':False,'flammable':False,'sounds':'prop.metal-heavy'})
body=empty('body',parent=root)
door=empty('door_front',(.35,-.49,1.12),root)
flap=empty('delivery_flap',(.335,0,.443),door)
# World-space authoring, then preserve transforms when assigning joint origins.
parts=[]
def finish(o,name,mat,parent,bevel=0):
    o.name=name; o.data.materials.clear(); o.data.materials.append(M[mat])
    if bevel:
        mod=o.modifiers.new('rounded edges','BEVEL'); mod.width=bevel; mod.segments=3 if bevel>=.03 else 1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); world=o.matrix_world.copy(); o.parent=parent; o.matrix_world=world
    parts.append(o); return o

def box(name,loc,size,mat,parent=body,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.4))

def cyl(name,loc,r,depth,mat,parent=body,axis='z',n=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=depth,location=loc)
    o=bpy.context.object
    if axis=='x': o.rotation_euler.y=math.pi/2
    return finish(o,name,mat,parent)

def cut(o,loc,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); c=bpy.context.object; c.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('true recess','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=c
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name); bpy.data.objects.remove(c,do_unlink=True)

def frame(name,x,y,z,w,h,bar,mat,parent):
    for yy in [-1,1]: box(name,(x,y+yy*(w+bar)/2,z),(.035,bar,h+2*bar),mat,parent,.006)
    for zz in [-1,1]: box(name,(x,y,z+zz*(h+bar)/2),(.035,w,bar),mat,parent,.006)

shell=box('cabinet_shell',(0,0,1.13),(.70,1,2.04),'policeBlue',bevel=.045)
cut(shell,(.35,0,1.26),(.25,.83,1.54))
cut(shell,(.35,0,.355),(.30,.47,.17))
box('panel_back',(.20,0,1.26),(.03,.82,1.53),'blood',door)
panel=box('red_front',(.269,0,1.26),(.044,.815,1.53),'emi_survivorRed',door,.015)
cut(panel,(.28,0,.905),(.20,.69,.70))
box('display_back',(.13,0,.905),(.025,.70,.70),'blood',door)
for y in [-.355,.355]: box('bay_wall',(.222,y,.905),(.16,.02,.70),'survivorRed',door)
for z in [.552,1.258]: box('bay_floor_roof',(.222,0,z),(.16,.71,.02),'survivorRed',door)
frame('red_bay_rim',.295,0,.905,.69,.70,.014,'survivorRed',door)
# Script font meshes retain the reference's swooping lettering, without textures.
font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Brush Script.ttf')
def text(name,word,loc,w,h,mat,parent):
    bpy.ops.object.text_add(location=loc,rotation=(math.pi/2,0,math.pi/2)); o=bpy.context.object
    o.data.body=word; o.data.font=font; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=1; o.data.extrude=0; o.data.resolution_u=1
    bpy.ops.object.convert(target='MESH'); o=bpy.context.object
    xs=[v.co.x for v in o.data.vertices]; ys=[v.co.y for v in o.data.vertices]
    sx=w/(max(xs)-min(xs)); sy=h/(max(ys)-min(ys))
    for v in o.data.vertices: v.co.x*=sx; v.co.y*=sy
    return finish(bpy.context.object,name,mat,parent)
text('Fizz_logo','Fizz',(.298,0,1.67),.65,.58,'emi_windowGlow',door)
# Cans: formed shoulders, rolled rims, lids, pull-tabs and embossed labels.
for row,z in enumerate([1.085,.715]):
    for col,y in enumerate([-.249,-.083,.083,.249]):
        ink='policeBlue' if row==0 else 'survivorRed'
        cyl('can',(.226,y,z),.063,.234,ink,door,n=16)
        for sign in [-1,1]:
            bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.052 if sign<0 else .063,radius2=.063 if sign<0 else .052,depth=.021,location=(.226,y,z+sign*.127))
            finish(bpy.context.object,'can_shoulder','schoolBusYellow' if row==0 and sign>0 else ink,door)
            cyl('rolled_rim',(.226,y,z+sign*.140),.054,.008,'sidewalk',door,n=16)
        cyl('lid',(.226,y,z+.146),.047,.005,'uiDark',door,n=16)
        cyl('lid_inner',(.226,y,z+.150),.041,.004,'sidewalk',door,n=16)
        box('pull_tab',(.231,y,z+.155),(.026,.012,.004),'picketWhite',door,.002)
        text('can_Fizz','Fizz',(.294,y,z),.086,.089,'picketWhite',door)
        for j in range(3): cyl('bubble',(.294,y+(.022 if j%2 else -.022),z-.092+j*.018),.005,.006,'picketWhite',door,'x',12)
box('selection_rail',(.314,0,.925),(.075,.71,.081),'policeBlue',door)
for y in [-.249,-.083,.083,.249]:
    box('button_socket',(.36,y,.925),(.022,.10,.049),'uiDark',door)
    box('selection_button',(.379,y,.925),(.022,.082,.035),'picketWhite',door,.007)
# Lower panel: open bezel and top-hinged flap at its actual joint.
lower=box('lower_service_panel',(.357,0,.311),(.03,.95,.385),'policeBlue',door,.013)
cut(lower,(.36,0,.355),(.20,.47,.17))
box('delivery_darkness',(.21,0,.355),(.02,.48,.17),'uiDark',door)
frame('delivery_bezel',.389,0,.355,.47,.17,.026,'sidewalk',door)
box('delivery_flap_mesh',(.285,0,.362),(.018,.439,.144),'uiDark',flap)
box('flap_rib',(.298,0,.338),(.009,.428,.009),'sidewalk',flap,.003)
box('delivery_tray',(.32,0,.264),(.13,.44,.016),'uiDark',door)
for y,z in [(-.42,.466),(.42,.466),(-.42,.153),(.42,.153),(-.19,.145),(.19,.145)]:
    cyl('bolt_socket',(.379,y,z),.015,.008,'uiDark',door,'x')
    cyl('service_bolt',(.387,y,z),.010,.006,'sidewalk',door,'x')
for x in [-.23,.23]:
    for y in [-.38,.38]: box('foot',(x,y,.06),(.19,.17,.12),'uiDark',bevel=.012)
box('top_seam',(0,0,2.153),(.57,.86,.006),'uiDark')
box('lid_panel',(0,0,2.161),(.54,.83,.010),'policeBlue')
for x in [-.235,.235]:
    for y in [-.365,.365]: cyl('top_screw',(x,y,2.171),.010,.006,'sidewalk')
box('rear_seam',(-.354,0,1.12),(.009,.86,1.85),'uiDark')
box('rear_panel',(-.365,0,1.12),(.008,.83,1.82),'policeBlue')
for z in [.32,.36,.40,.44,.48,.52]: box('rear_vent',(-.375,0,z),(.006,.55,.015),'uiDark',bevel=.003)
for y in [-.505,.505]:
    box('side_seam',(-.025,y,1.12),(.54,.006,1.84),'uiDark',bevel=.002)
    box('side_panel',(-.025,y+(.009 if y>0 else -.009),1.12),(.516,.006,1.816),'policeBlue',bevel=.002)
# Purposeful edge chips, kept coarse and clear of underlying surfaces.
for side in [-1,1]:
    for i,z in enumerate([.19,.48,.82,1.14,1.49,1.86,2.06]):
        box('edge_chip',(.357,side*.472,z),(.008,.013,.019 if i%2 else .029),'woodWarm',bevel=.002)
# Merge static meshes by material and joint, leaving only animation assemblies.
for o in parts:
    mat=next(m for m in o.data.materials if m is not None)
    o.data.materials.clear(); o.data.materials.append(mat)
    for face in o.data.polygons: face.material_index=0
for parent in [body,door,flap]:
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0]; bpy.ops.object.join(); obs[0].name=parent.name+'_'+mat.name
light=empty('light:front',(.305,0,1.62),door); light.rotation_euler=(0,-math.pi/2,0)
light['ss_light']=json.dumps({'type':'window','color':'light_window_warm','intensity':2,'range':2.5,'pool':True,'beam':'none','flare':False,'reflect':True,'shadow':'none','heroPriority':0,'flicker':'none','animation':None,'powerGroup':'self','breakable':True,'emissiveNodes':['door_front_emi_windowGlow','door_front_emi_survivorRed'],'tiers':'all'})
col=empty('col:body',(0,0,1.08),root); col['collider']='cuboid'; col['shape']='cuboid'; col['size']=[.70,1,2.16]
asset=list(bpy.context.scene.objects); meshes=[o for o in asset if o.type=='MESH']
# Bake deterministic ambient occlusion directly to glTF vertex colors.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.seed=51
scene.render.bake.target='VERTEX_COLORS'; scene.render.bake.use_clear=True
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    o.data.color_attributes.active_color=attr
    o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO')
tri=0
for o in meshes:o.data.calc_loop_triangles(); tri+=len(o.data.loop_triangles)
report={'id':'prop.vending-machine','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(name) is not None for name in ['root','body','door_front','delivery_flap','light:front','col:body']),'within_budget':6000<=tri<=12000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Palette blue is brighter than the reference indigo.', 'Fine weathering, logo contours and can artwork are simplified.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene; world=bpy.data.worlds.new('studio'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.28,.38,1); world.node_tree.nodes['Background'].inputs[1].default_value=.55
    bpy.ops.mesh.primitive_plane_add(size=200)
    m=bpy.data.materials.new('stage'); m.use_nodes=True; m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.18,.16,.20,1); bpy.context.object.data.materials.append(m)
    for loc,power,size,color in [((4,-4,7),700,5,(1,.88,.72)),((-3,2,5),500,4,(.72,.80,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.data.energy=power; o.data.size=size; o.data.color=color; o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(); cam=bpy.context.object; scene.camera=cam; target=Vector((0,0,1.08))
    views={'ref':(6,2.5,3.0),'game':(6,-6,7),'front':(7,0,1.1),'side':(0,-7,1.1),'rear':(-6,-3,3)}
    cam.location=views[a.view]; cam.data.type='ORTHO'; cam.data.ortho_scale=4.7 if a.view!='game' else 4.6
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES'; scene.cycles.samples=a.samples; scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type='METAL'; prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU'; scene.render.resolution_x=a.width; scene.render.resolution_y=a.height
    scene.view_settings.view_transform='AgX'; scene.render.filepath=str(Path(a.render).resolve()); bpy.ops.render.render(write_still=True)
    print('RENDER OK')
