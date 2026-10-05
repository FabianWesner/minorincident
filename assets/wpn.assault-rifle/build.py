"""Deterministic palette rifle; +X muzzle, metres, grounded magazine."""
import argparse,json,math,sys
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
dark=mat('uiDark','25222c',.25);red=mat('survivorRed','d9363e');steel=mat('asphalt','5b4f5c',.25);bright=mat('sidewalk','b9a4a0',.55)
parts={}
def finish(o,m,b=.002,group='body'):
    o.data.materials.append(m)
    if b:
        mod=o.modifiers.new('soft edges','BEVEL');mod.width=b;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.setdefault(group,[]).append(o);return o
def mesh(name,v,f,m,b=.002,group='body'):
    d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update()
    o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,m,b,group)
def poly(name,outline,width,m,b=.002,group='body',y=0):
    n=len(outline);v=[(x,y+s*width/2,z) for s in [-1,1] for x,z in outline]
    return mesh(name,v,[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],m,b,group)
def box(name,loc,size,m,b=.002,group='body'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,m,b,group)
def cyl(name,loc,r,depth,m,axis=(1,0,0),group='body',vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name
    o.rotation_euler=Vector(axis).to_track_quat('Z','Y').to_euler()
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);return finish(o,m,.001,group)
def ring(name,outer,inner,width,m,y=0,group='body'):
    n=len(outer);v=[(x,y+s*width/2,z) for s in [-1,1] for loop in [outer,inner] for x,z in loop];f=[]
    for i in range(n):
        j=(i+1)%n;f.extend([(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),(i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)])
    return mesh(name,v,f,m,.001,group)
# Receiver and circular barrel line.
poly('upper receiver',[(-.155,.235),(.075,.235),(.082,.285),(.065,.305),(-.145,.305),(-.16,.292)],.065,dark,.004)
poly('lower receiver',[(-.155,.234),(.072,.234),(.070,.175),(.002,.172),(-.024,.191),(-.155,.185)],.060,dark,.003)
cyl('barrel',(.278,0,.267),.018,.245,steel)
for x,r,d in [(.155,.035,.026),(.267,.027,.019),(.322,.024,.016),(.366,.028,.02)]:cyl('barrel collar',(x,0,.267),r,d,dark)
# Hollow muzzle, with genuine bore rather than a painted circle.
n=16;v=[(x,r*math.cos(i*2*math.pi/n),.267+r*math.sin(i*2*math.pi/n)) for x,r in [(.432,.027),(.432,.019),(.380,.019),(.380,.027)] for i in range(n)]
f=[(k*n+i,k*n+(i+1)%n,((k+1)%4)*n+(i+1)%n,((k+1)%4)*n+i) for k in range(4) for i in range(n)]
mesh('open flash hider',v,f,steel,.001)
for s in [-1,1]:
    for x in [.401,.416]:box('muzzle slots',(x,s*.026,.267),(.008,.006,.014),dark,.0008)
# Red ribbed octagonal handguard.
cyl('handguard core',(.154,0,.267),.044,.172,red,vertices=8)
for i in range(8):cyl('handguard rib',(.083+i*.021,0,.267),.049,.015,red,vertices=8)
# Tall open triangular front sight.
ring('front sight',[(.225,.284),(.268,.284),(.264,.363),(.253,.390),(.236,.390)],[(.236,.299),(.258,.299),(.253,.350),(.248,.363),(.241,.363)],.021,steel)
box('front sight pin',(.246,0,.357),(.005,.007,.030),dark,.001)
for s in [-1,1]:cyl('sight pin',(.247,s*.015,.291),.006,.006,bright,(0,1,0))
# Raised red rear-receiver panels, offset 4 mm beyond the receiver face.
for s in [-1,1]:
    poly('rear receiver accent',[(-.158,.239),(-.146,.239),(-.135,.269),(-.145,.300),(-.158,.300)],.006,red,.001,y=s*.039)
# Buffer tube and skeleton stock.
cyl('buffer tube',(-.224,0,.268),.022,.15,steel)
poly('red stock shell',[(-.414,.233),(-.267,.233),(-.257,.248),(-.255,.295),(-.405,.307),(-.419,.292)],.059,red,.004)
ring('stock skeleton',[(-.416,.238),(-.267,.238),(-.279,.209),(-.416,.133)],[(-.399,.222),(-.294,.222),(-.301,.211),(-.399,.157)],.030,red)
poly('butt pad',[(-.433,.127),(-.413,.131),(-.413,.304),(-.429,.313),(-.442,.305),(-.442,.140)],.065,dark,.003)
for z in [.150,.176,.202,.228,.254,.280]:box('pad grooves',(-.443,0,z),(.006,.053,.008),steel,.001)
for s in [-1,1]:
    for z in [.254,.270]:box('stock slots',(-.380,s*.030,z),(.035,.007,.007),dark,.001)
# Slanted pistol grip and open trigger guard.
poly('pistol grip',[(-.142,.181),(-.093,.182),(-.094,.152),(-.139,.046),(-.191,.061)],.043,red,.004)
for s in [-1,1]:
    poly('grip inset',[(-.139,.157),(-.112,.154),(-.150,.065),(-.176,.074)],.006,red,.002,y=s*.025)
    cyl('grip screw',(-.163,s*.030,.071),.003,.003,dark,(0,1,0))
ring('trigger guard',[(-.101,.188),(-.015,.188),(-.015,.136),(-.092,.136)],[(-.091,.178),(-.026,.178),(-.026,.146),(-.084,.146)],.022,dark)
poly('trigger blade',[(-.060,.180),(-.052,.180),(-.056,.164),(-.063,.153),(-.074,.147),(-.079,.150),(-.069,.157),(-.063,.167)],.012,steel,.001,'trigger')
# Curved magazine with long ribs and contrasting bottom rim.
outline=[(-.010,.184),(.055,.184),(.060,.135),(.074,.079),(.098,.022),(.026,0),(.008,.057),(-.005,.116)]
poly('curved magazine',outline,.041,steel,.003,'magazine')
for s in [-1,1]:
    for dx in [.010,.035]:
        poly('magazine flute',[(dx,.162),(dx+.006,.162),(dx+.016,.088),(dx+.039,.022),(dx+.032,.020),(dx+.010,.085)],.007,dark,.001,'magazine',s*.024)
poly('magazine floor',[(.020,.007),(.096,.029),(.102,.018),(.026,0)],.051,bright,.001,'magazine')
box('magwell',(.020,0,.185),(.085,.073,.013),steel,.002)
# Receiver rail teeth, folding rear aperture, ejection pocket and controls.
box('top rail',(-.042,0,.309),(.207,.033,.010),dark)
for i in range(10):box('rail tooth',(-.138+i*.020,0,.317),(.010,.042,.009),steel,.001)
ring('rear aperture',[(-.112,.320),(-.078,.320),(-.078,.354),(-.084,.365),(-.105,.365),(-.112,.354)],[(-.102,.337),(-.087,.337),(-.087,.350),(-.091,.355),(-.098,.355),(-.102,.350)],.023,steel)
for s in [-1,1]:
    box('port recess',(-.025,s*.035,.267),(.128,.008,.022),dark,.001)
    box('port cover',(-.025,s*.040,.265),(.109,.006,.013),steel,.001)
    box('bolt release',(.001,s*.039,.215),(.014,.013,.030),steel,.001)
    box('selector',(-.092,s*.037,.216),(.032,.012,.009),dark,.001)
    for x,z in [(-.121,.202),(-.079,.224),(.061,.287),(.066,.245)]:cyl('receiver fastener',(x,s*.036,z),.004,.007,bright,(0,1,0))
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='wpn.assault-rifle'
for group,obs in parts.items():
    parent=root
    if group!='body':
        parent=bpy.data.objects.new(group,None);bpy.context.collection.objects.link(parent);parent.parent=root
        parent.location={'trigger':(-.056,0,.180),'magazine':(.02,0,.180)}[group]
    batches=[(m,[o for o in obs if o.data.materials[0]==m]) for m in [dark,red,steel,bright]]
    for m,selected in batches:
        if not selected:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in selected:o.select_set(True)
        bpy.context.view_layer.objects.active=selected[0];bpy.ops.object.join();o=bpy.context.object;o.name=group+'_'+m.name
        bpy.context.scene.cursor.location=parent.location if parent!=root else (0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
        world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
for name,loc in [('grip',(-.137,0,.113)),('muzzle',(.432,0,.267)),('front',(.432,0,.267))]:
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;o.parent=root
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.seed=0;scene.render.bake.target='VERTEX_COLORS'
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.bake(type='AO')
triangles=sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons)
report=dict(id='wpn.assault-rifle',tier='Side',triangles=triangles,draw_calls=len(meshes),materials=[m.name for m in [dark,red,steel,bright]],nodes_ok=all(bpy.data.objects.get(n) is not None for n in ['root','grip','muzzle']),within_budget=triangles<=6000 and len(meshes)<=30)
(HERE/'geometry.json').write_text(json.dumps(report,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
if a.render:
    scene.cycles.samples=a.samples;scene.cycles.use_denoising=True;scene.world.color=(.13,.13,.13)
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.location.z=-.002;bpy.context.object.data.materials.append(mat('stage','2a2730'))
    target=Vector((0,0,.205))
    def aim(o):o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler()
    for loc,power,size,color in [((.4,-.8,1.2),90,.8,(1,.92,.86)),((-.6,-.2,.8),45,.7,(.64,.65,1)),((.3,.6,.9),100,.7,(1,.72,.5))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;aim(o)
    views={'ref':(-.42, 1.8,.63),'game':(1.2,-1.2,1.7),'front':(1.5,0,.30),'side':(0,-1.7,.24),'rear':(-1.2,-.8,.6)}
    bpy.ops.object.camera_add(location=views[a.view]);o=bpy.context.object;aim(o);o.data.type='ORTHO';o.data.ortho_scale=1.10;scene.camera=o
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=-1.35
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True)
    if a.view=='ref':
        scene.camera.location=views['game'];aim(scene.camera);scene.camera.data.ortho_scale=1.10;scene.cycles.samples=24
        scene.render.resolution_x=960;scene.render.resolution_y=540
        game_path=HERE/'renders/game.png' if Path(a.render).name=='hero.png' else Path(a.render).with_name(Path(a.render).stem+'-game.png')
        scene.render.filepath=str(game_path.resolve());bpy.ops.render.render(write_still=True)
print('OK',json.dumps(report))
