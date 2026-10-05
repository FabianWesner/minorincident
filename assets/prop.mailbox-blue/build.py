"""Blue street mailbox: metres, +X forward, Z up; texture-free palette geometry."""
import argparse,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for key in ('render','glb'):p.add_argument('--'+key)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={}
for token,h in {'policeBlue':'2f6bff','uiDark':'25222c','picketWhite':'f2e6dc','survivorRed':'d9363e','sidewalk':'b9a4a0'}.items():
    rgb=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    bs=m.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
    bs.inputs['Roughness'].default_value=.34 if token=='policeBlue' else .53
    bs.inputs['Metallic'].default_value=.15 if token=='policeBlue' else 0
    M[token]=m

def empty(name,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc
    if parent:
        bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
    return o
root=empty('root');root['asset_id']='prop.mailbox-blue'
body=empty('body',parent=root);door=empty('door_collection',(-.329,-.365,.745),root)
flap=empty('mail_flap',(.296,0,1.111),root)
def finish(o,name,mat,parent=body,bevel=0):
    o.name=name;o.data.materials.append(M[mat])
    bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('soft edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for face in o.data.polygons:face.use_smooth=True
    mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
    return o

def box(name,loc,size,mat='policeBlue',parent=body,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,min(bevel,min(size)*.4))

def arch(name,y,width,r,inner=None):
    # Extruded closed semicircle or curved annular band in the X/Z plane.
    n=32;outer=[(r*math.cos(i*math.pi/n),1.18+r*math.sin(i*math.pi/n)) for i in range(n+1)]
    profile=outer+([(inner*math.cos(i*math.pi/n),1.18+inner*math.sin(i*math.pi/n)) for i in range(n,-1,-1)] if inner else [])
    verts=[(x,y+s*width/2,z) for s in (-1,1) for x,z in profile];k=len(profile)
    faces=[tuple(range(k-1,-1,-1)),tuple(range(k,2*k))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,'policeBlue',bevel=.009)
# Curved roof and solid side caps, framed by continuous arches and legs.
arch('barrel_roof',0,.82,.325,.301)
for y in (-.439,.439):
    arch('arched_frame',y,.064,.359,.308)
    arch('side_cap',y,.034,.308)
    box('side_panel',(0,y,.771),(.602,.034,.804),bevel=.016)
    for x in (-.333,.333):box('continuous_leg',(x,y,.588),(.064,.064,1.176),bevel=.009)
# Front assembled around a true slot opening; no surface hidden behind its aperture.
box('front_lower',(.311,0,.691),(.038,.813,.644),bevel=.010)
box('front_upper',(.311,0,1.147),(.038,.813,.066),bevel=.007)
for y in (-.362,.362):box('slot_side_panel',(.311,y,1.063),(.038,.090,.100),bevel=.006)
box('slot_dark_interior',(.239,0,1.065),(.019,.641,.091),'uiDark',bevel=.004)
box('slot_floor',(.289,0,1.016),(.133,.65,.018),'uiDark',bevel=.006)
for z in (1.015,1.115):box('slot_bezel',(.341,0,z),(.040,.68,.018),bevel=.007)
for y in (-.331,.331):box('slot_bezel',(.341,y,1.065),(.040,.018,.10),bevel=.006)
box('mail_flap_mesh',(.269,0,1.065),(.014,.624,.075),'uiDark',flap,.006)
box('front_bottom_rail',(.322,0,.339),(.047,.815,.070),bevel=.010)
# Recessed rear access panel, separate at its left vertical hinge.
box('rear_shadow',(-.307,0,.742),(.022,.812,.806),'uiDark',bevel=.012)
box('collection_panel',(-.324,0,.744),(.019,.784,.774),parent=door,bevel=.014)
for z in (.483,1.004):box('hinge',(-.343,-.371,z),(.040,.028,.083),parent=door,bevel=.009)
box('lock_socket',(-.340,.302,.806),(.014,.058,.071),'uiDark',door,.010)
box('lock',(-.352,.302,.806),(.012,.028,.037),'sidewalk',door,.005)
box('keyhole',(-.361,.302,.806),(.006,.006,.017),'uiDark',door,.002)
# Raised rounded badge; envelope strokes stand 5mm beyond its face.
profile=[]
for cy,cz,start in [(.230,.109,0),(-.230,.109,90),(-.230,-.109,180),(.230,-.109,270)]:
    for i in range(9):
        angle=math.radians(start+i*90/8)
        profile.append((cy+.027*math.cos(angle),.834+cz+.027*math.sin(angle)))
k=len(profile);verts=[(x,y,z) for x in (.330,.350) for y,z in profile]
faces=[tuple(range(k-1,-1,-1)),tuple(range(k,k*2))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
mesh=bpy.data.meshes.new('badge');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('badge',mesh);bpy.context.collection.objects.link(o);finish(o,'envelope_badge','picketWhite',bevel=.002)
def stroke(name,y1,z1,y2,z2,x):
    mid=(x,(y1+y2)/2,(z1+z2)/2);length=math.hypot(y2-y1,z2-z1)
    o=box(name,mid,(.010,length+.020,.020),'survivorRed',bevel=.005)
    o.rotation_euler.x=math.atan2(z2-z1,y2-y1)
for i,pts in enumerate([(-.175,.918,0,.815),(0,.815,.175,.918),(-.175,.748,-.052,.846),(.175,.748,.052,.846)]):stroke('envelope_stroke',*pts,.357+i*.004)
# Static geometry shares one primitive per palette material; joint assemblies stay separate.
for parent in (body,door,flap):
    for mat in M.values():
        obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==mat]
        if not obs:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:o.select_set(True)
        bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=parent.name+'_'+mat.name
col=empty('col:body',(0,0,.77),root);col['collider']='cuboid';col['size']=[.718,.942,1.54]
asset=list(bpy.context.scene.objects);meshes=[o for o in asset if o.type=='MESH']
# Deterministic AO carried as glTF vertex colors.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=17
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
    o.data.color_attributes.active_color=attr;o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.bake(type='AO')
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'prop.mailbox-blue','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted({m.name for o in meshes for m in o.data.materials}),'nodes_ok':all(bpy.data.objects.get(n) is not None for n in ('root','body','door_collection','mail_flap','col:body')),'within_budget':6000<=tri<=12000 and len(meshes)<=30,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Canonical policeBlue is brighter than the reference indigo.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene;world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.21,.29,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
    bpy.ops.mesh.primitive_plane_add(size=200);stage=bpy.data.materials.new('stage');stage.use_nodes=True;stage.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.035,.029,.043,1);bpy.context.object.data.materials.append(stage)
    for loc,power,size,color in [((3,-4,6),500,4,(1,.83,.67)),((-3,2,4),400,3,(.65,.75,1))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,.76))
    cam.location={'ref':(6,-4,3.2),'game':(5,-5,7),'front':(6,0,.8),'side':(0,-6,.8),'rear':(-5,3,2.7)}[a.view]
    cam.data.type='ORTHO';cam.data.ortho_scale=3.65;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='METAL';prefs.get_devices()
    for d in prefs.devices:d.use=True
    scene.cycles.device='GPU';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        cam.location=(5,-5,7);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
        scene.render.resolution_x=960;scene.render.resolution_y=540;scene.cycles.samples=24
        output=Path(a.render);game_name=output.name.replace('-ref','-game') if '-ref' in output.name else 'game.png'
        scene.render.filepath=str(output.with_name(game_name).resolve());bpy.ops.render.render(write_still=True)
    print('RENDER OK')
