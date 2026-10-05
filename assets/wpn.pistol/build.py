"""Chunky palette-only pistol. +X muzzle, Z up, metres; no textures."""
import argparse, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
for f in ['render','glb']:p.add_argument('--'+f)
p.add_argument('--view',default='ref')
for f,d in [('samples',24),('width',960),('height',540)]:p.add_argument('--'+f,type=int,default=d)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system='METRIC'
def mat(token,color,metal=0):
    rgb=[int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    m=bpy.data.materials.new('pal_'+token);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*rgb,1)
    bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=.38
    return m
dark=mat('uiDark','25222c',.12);red=mat('survivorRed','d9363e');steel=mat('sidewalk','b9a4a0',.65)
parts={}
def finish(o,m,b=.0015,group='body'):
    o.data.materials.append(m)
    if b:
        mod=o.modifiers.new('edge bevel','BEVEL');mod.width=b;mod.segments=2 if b>=.002 else 1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('weighted normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.setdefault(group,[]).append(o);return o
def mesh(name,v,f,m,b=.0015,group='body'):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,m,b,group)
def poly(name,outline,width,m,b=.002,group='body',y=0):
    n=len(outline);v=[(x,y+s*width/2,z) for s in [-1,1] for x,z in outline]
    return mesh(name,v,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],m,b,group)
def box(name,loc,size,m,b=.002,group='body'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,m,b,group)
def cyl(name,loc,r,depth,m,axis=(0,1,0),group='body'):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);return finish(o,m,.0007,group)
# Frame and sloping grip. Bottom of magazine is exactly z=0.
poly('frame',[(-.133,.153),(.126,.153),(.130,.119),(.039,.113),(.015,.105),(-.014,.107),(-.040,.082),(-.064,.014),(-.135,.014),(-.109,.111),(-.132,.119)],.041,dark,.003)
poly('grip casting',[(-.114,.125),(-.055,.122),(-.064,.104),(-.092,.010),(-.159,.010)],.045,dark,.004)
for s in [-1,1]:
    poly('red grip panel',[(-.111,.116),(-.069,.114),(-.101,.025),(-.144,.025)],.007,red,.002,y=s*.026)
    for x,z in [(-.100,.102),(-.114,.068),(-.129,.036)]:
        cyl('screw recess',(x,s*.031,z),.005,.004,dark)
        cyl('grip fastener',(x,s*.034,z),.003,.002,steel)
# Continuous upper slide with raised shoulder and recessed-looking rear groove valleys.
poly('slide',[(-.136,.159),(.140,.159),(.140,.202),(.128,.213),(-.122,.213),(-.133,.201)],.047,dark,.005,'slide')
box('top rib',(.024,0,.213),(.185,.025,.006),dark,.001,'slide')
for s in [-1,1]:
    for i in range(5):
        box('rear serration',(-.114+i*.010,s*.0255,.185),(.0045,.006,.037),dark,.001,'slide')
    box('slide stop',(-.027,s*.026,.131),(.015,.009,.009),dark,.001)
    cyl('slide pin',(.044,s*.0265,.181),.0035,.005,dark,group='slide')
# Ejection port is an actual pocket cut into slide top and side.
slide=parts['slide'][0]
cutter=box('port cutter',(-.023,-.020,.207),(.044,.023,.025),dark,.003,'temporary')
mod=slide.modifiers.new('ejection pocket','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
bpy.context.view_layer.objects.active=slide;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True);parts.pop('temporary')
box('chamber',(-.023,-.014,.198),(.037,.017,.014),steel,.002,'slide')
# Red muzzle plate with true bored hole. Barrel interior is a recessed tube.
plate=box('muzzle surround',(.143,0,.184),(.014,.055,.061),red,.004,'slide')
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.014,depth=.05,location=(.143,0,.184),rotation=(0,math.pi/2,0))
cutter=bpy.context.object
mod=plate.modifiers.new('muzzle bore','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
def tube():
    n=24;v=[(x,r*math.cos(i*2*math.pi/n),.184+r*math.sin(i*2*math.pi/n)) for x,r in [(.151,.014),(.151,.0105),(.115,.0105),(.115,.014)] for i in range(n)]
    f=[(k*n+i,k*n+(i+1)%n,((k+1)%4)*n+(i+1)%n,((k+1)%4)*n+i) for k in range(4) for i in range(n)]
    mesh('barrel lining',v,f,dark,0,'slide')
tube()
box('under barrel rail',(.091,0,.137),(.092,.043,.026),dark,.003)
cyl('recoil plug',(.139,0,.135),.005,.008,steel,(1,0,0))
for x in [-.109,.115]:
    box('sight pedestal',(x,0,.216),(.024,.023,.006),dark,.001,'slide')
    poly('red sight',[(x-.014,.218),(x+.013,.218),(x+.009,.231),(x-.009,.231)],.020,red,.0015,'slide')
box('front sight insert',(.119,-.012,.225),(.008,.004,.005),steel,.0006,'slide')
box('hammer',(-.144,0,.173),(.015,.023,.017),red,.002)
# Rounded rectangular open trigger guard via annular polygon extrusion.
outer=[(-.047,.112),(.030,.112),(.036,.105),(.035,.068),(.024,.059),(-.039,.060),(-.058,.076),(-.058,.099)]
inner=[(-.043,.104),(.022,.104),(.027,.099),(.026,.075),(.020,.068),(-.037,.069),(-.049,.080),(-.049,.096)]
n=len(outer);v=[(x,y,z) for y in [-.014,.014] for loop in [outer,inner] for x,z in loop]
f=[]
for i in range(n):
    j=(i+1)%n
    f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
mesh('open guard',v,f,dark,.0015)
poly('curved trigger',[(-.018,.106),(-.008,.106),(-.015,.090),(-.015,.083),(-.006,.073),(-.014,.073),(-.025,.083),(-.025,.091)],.012,red,.0015,'trigger')
poly('magazine floor',[(-.159,0),(-.086,0),(-.081,.011),(-.090,.018),(-.157,.012)],.051,dark,.002,'magazine')
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.pistol'
for group,obs in parts.items():
    batches=[(m,[o for o in obs if o.data.materials[0]==m]) for m in [dark,red,steel]]
    for m,selected in batches:
        if not selected:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in selected:o.select_set(True)
        bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object
        o.name=group if m==dark else group+'_'+m.name
        pivot={'slide':(-.12,0,.18),'trigger':(-.013,0,.106),'magazine':(-.12,0,.08)}.get(group,(0,0,0))
        bpy.context.scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.parent=root
# All materials belonging to a moving part follow its primary mesh.
for group in ['slide','trigger','magazine']:
    members=[o for o in bpy.context.scene.objects if o.type=='MESH' and (o.name==group or o.name.startswith(group+'_'))]
    primary=next((o for o in members if o.name==group),members[0]);primary.name=group
    for o in members:
        if o!=primary:
            world=o.matrix_world.copy();o.parent=primary;o.matrix_world=world
for name,loc in [('grip',(-.105,0,.068)),('muzzle',(.153,0,.184))]:
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='wpn.pistol',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [dark,red,steel]],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','muzzle']),within_budget=triangles<=6000 and len(meshes)<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.13,.13,.13)
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.location.z=-.001;bpy.context.object.data.materials.append(mat('stage','2a2730'))
    target=Vector((-.004,0,.116))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((.35,-.5,.65),22,.4,(1,.8,.65)),((-.4,-.1,.4),12,.3,(.64,.65,1)),((.2,.4,.5),25,.3,(1,.62,.27))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(.35,-.75,.36),'game':(.5,-.5,.80),'front':(.7,0,.19),'side':(0,-.7,.17),'rear':(-.5,.5,.35)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=.48;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-.5
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        scene.camera.location=views['game'];aim(scene.camera);scene.camera.data.ortho_scale=.56;scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        game_path=HERE/'renders/game.png' if Path(a.render).name=='hero.png' else Path(a.render).with_name(Path(a.render).stem+'-game.png')
        scene.render.filepath=str(game_path.resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
