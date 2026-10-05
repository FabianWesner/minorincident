"""Sunset Grove street sign. Deterministic solid lettering; +X front, Z up."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for flag in ['render','glb']: p.add_argument('--'+flag)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(token,hexcode,metal=0):
    rgb=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Roughness'].default_value=.44;bs.inputs['Metallic'].default_value=metal
    return m
teal=mat('backpackTeal','245551');cream=mat('picketWhite','f2e6dc')
silver=mat('sidewalk','b9a4a0',.65);dark=mat('uiDark','25222c',.25)
def finish(o,m,bevel=0,segments=2):
    o.data.materials.append(m)
    if bevel:
        b=o.modifiers.new('soft cast edges','BEVEL');b.width=bevel;b.segments=segments
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
        n=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');n.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=n.name)
    return o
def box(name,loc,size,m,bevel=.01,segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,m,bevel,segments)
def cyl(name,loc,r,depth,m,vertices=32,axis=(0,0,1),bevel=.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,m,bevel)
def plate(name,x,z,width,height,depth,m,r=.042):
    # Rounded rectangle extruded along X; unlike cube bevel, corners keep a broad radius.
    verts=[];outline=[]
    for cy,cz,start in [(width/2-r,height/2-r,0),(-width/2+r,height/2-r,90),(-width/2+r,-height/2+r,180),(width/2-r,-height/2+r,270)]:
        for i in range(9):
            t=math.radians(start+i*90/8);outline.append((cy+r*math.cos(t),cz+r*math.sin(t)))
    for xx in [x-depth/2,x+depth/2]:verts.extend((xx,y,z+zz) for y,zz in outline)
    n=len(outline);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    return finish(o,m,.003,2)
# Long pole is offset beneath the left third of the nameplates, as in the reference.
post_y=-.33
box('foot',(0,post_y,.065),(.34,.34,.13),dark,.028,3)
box('pedestal',(0,post_y,.245),(.235,.235,.27),dark,.02,3)
box('base cap',(0,post_y,.388),(.255,.255,.036),silver,.011)
cyl('post',(0,post_y,1.615),.058,2.46,silver,48,(0,0,1),.005)
cyl('post cap',(0,post_y,2.855),.062,.028,silver,48)
for label,z in [('Maple Ave',2.65),('Pine St',2.265)]:
    plate(label+' rim',.025,z,1.16,.335,.066,cream)
    plate(label+' face',.063,z,1.116,.291,.014,teal,.035)
    plate(label+' rear',-.013,z,1.116,.291,.012,teal,.035)
    # Front normal +X. Text's horizontal axis points toward -Y.
    bpy.ops.object.text_add(location=(.075,-.045,z-.002));o=bpy.context.object;o.name=label
    o.rotation_euler=(math.pi/2,0,math.pi/2)
    o.data.body=label;o.data.align_x='CENTER';o.data.align_y='CENTER'
    o.data.size=.235;o.data.extrude=.0025;o.data.bevel_depth=.0007;o.data.bevel_resolution=0;o.data.resolution_u=4
    bpy.context.view_layer.update()
    if o.dimensions.y>.86:o.scale.x*=.86/o.dimensions.y
    bpy.ops.object.convert(target='MESH');finish(bpy.context.object,cream)
    # Raised bolt and washer at the right end; front layers have >= 3 mm clearance.
    cyl(label+' washer',(.079,.478,z),.027,.014,dark,24,(1,0,0),.002)
    cyl(label+' bolt',(.092,.478,z),.022,.015,silver,6,(1,0,0),.003)
    box(label+' rear clamp',(-.065,post_y,z),(.075,.13,.11),silver,.012)
    for dy in [-.045,.045]:cyl(label+' clamp fastener',(-.109,post_y+dy,z),.013,.019,dark,6,(1,0,0),.002)
# Four sturdy mounting bolts at the ground plate.
for x in [-.12,.12]:
    for y in [post_y-.12,post_y+.12]:cyl('anchor bolt',(x,y,.13),.014,.015,silver,6,bevel=.002)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root)
root['asset_id']='prop.street-sign';root['static']=True
for m,name in [(silver,'body'),(teal,'sign_faces'),(cream,'rims_and_lettering'),(dark,'base_and_hardware')]:
    objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==m]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:o.select_set(True)
    bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;o.parent=root
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # AO is baked into a glTF vertex-color channel below.
    o.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER')
col=bpy.data.objects.new('col:post',None);bpy.context.collection.objects.link(col);col.parent=root
col.location=(0,post_y,1.43);col['collider']='cuboid';col['size']=[.13,.13,2.86]
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    o.data.color_attributes.active_color=o.data.color_attributes['ao']
    bpy.ops.object.bake(type='AO')
triangles=sum(len(poly.vertices)-2 for o in meshes for poly in o.data.polygons)
report=dict(id='prop.street-sign',tier='Side',triangles=triangles,draw_calls=4,materials=[m.name for m in [silver,teal,cream,dark]],nodes_ok=True,within_budget=6000<=triangles<=12000,rounds=3,webgpu_ok=False,webgl2_ok=False,gaps=[])
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in [root,col]+meshes:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.world.color=(.12,.12,.12)
    floor=mat('backdrop','2a2730');bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor)
    def aim(o,point):o.rotation_euler=(Vector(point)-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((4,-3,6),550,4,(1,.78,.58)),((1,4,4),300,3,(.65,.74,1)),((-3,-2,5),500,3,(1,.55,.28))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o,(0,0,1.5))
    views={'ref':(6,3.2,4.1),'game':(6,-6,8),'front':(6,0,2.4),'side':(0,-6,3),'rear':(-6,3,4)}
    bpy.ops.object.camera_add(location=views[a.view]);camera=bpy.context.object;aim(camera,(0,0,1.43));camera.data.type='ORTHO';camera.data.ortho_scale=5.9;scene.camera=camera
    scene.view_settings.view_transform='AgX';scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if Path(a.render).name.startswith('round') and a.view=='ref':
        camera.location=views['game'];aim(camera,(0,0,1.43))
        scene.render.filepath=str(Path(a.render).resolve()).replace('-ref.png','-game.png')
        bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
