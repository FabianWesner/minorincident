"""Sunset Grove little-league scoreboard. Metres, +X face, geometry-only graphics."""
import argparse, json, math, sys, random
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parents[1]/'tools/blender'))
from sslib import palette, ao
p=argparse.ArgumentParser()
for n in ('render','glb'): p.add_argument('--'+n)
p.add_argument('--view',default='ref');p.add_argument('--samples',type=int,default=24)
p.add_argument('--width',type=int,default=960);p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
M={t:palette.mat(t) for t in ('backpackTeal','woodWarm','schoolBusYellow','picketWhite','uiDark','sidewalk','blood')}
M['bulb']=palette.mat('windowGlow',True)
root=bpy.data.objects.new('root',None);bpy.context.collection.objects.link(root);root['asset_id']='prop.scoreboard'
body=bpy.data.objects.new('body',None);bpy.context.collection.objects.link(body);body.parent=root

def finish(o,name,mat,bevel=0):
    o.name=name;o.data.materials.append(M[mat]);bpy.context.view_layer.objects.active=o
    if bevel:
        mod=o.modifiers.new('edge bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=o.modifiers.new('normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
    o.parent=body
    return o

def box(name,x,y,z,dx,dy,dz,mat='backpackTeal',bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,z));o=bpy.context.object;o.dimensions=(dx,dy,dz)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,min(bevel,min(dx,dy,dz)*.3))

def beam(name,start,end,width,depth,mat):
    start,end=Vector(start),Vector(end);o=box(name,*((start+end)/2),depth,width,(end-start).length,mat,0 if name in ('curved_gold_trim','crest_gold_rim','ball_seam','ball_stitch') else .015)
    o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler();return o

def sphere(name,x,y,z,r,mat,segments=12,rings=6,scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=r,location=(x,y,z));o=bpy.context.object;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for f in o.data.polygons:f.use_smooth=True
    return finish(o,name,mat)

def profile(name,points,x,depth,mat):
    k=len(points);v=[(xx,y,z) for xx in (x-depth/2,x+depth/2) for y,z in points]
    faces=[tuple(range(k-1,-1,-1)),tuple(range(k,k*2))]+[(i,(i+1)%k,(i+1)%k+k,i+k) for i in range(k)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);return finish(o,name,mat,.008)

def text(label,y,z,width,height,x=.235):
    c=bpy.data.curves.new(label,'FONT');c.body=label;c.align_x='CENTER';c.align_y='CENTER';c.size=1;c.extrude=.008;c.bevel_depth=0;c.bevel_resolution=0;c.resolution_u=1
    c.font=bpy.data.fonts.load('/System/Library/Fonts/Supplemental/Rockwell.ttc')
    o=bpy.data.objects.new(label,c);bpy.context.collection.objects.link(o)
    o.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler();o.location=(x,y,z)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    xs=[v.co.x for v in o.data.vertices];ys=[v.co.y for v in o.data.vertices]
    cx=(max(xs)+min(xs))/2;cy=(max(ys)+min(ys))/2
    for v in o.data.vertices:
        v.co.x-=cx;v.co.y-=cy
    o.scale=(width/(max(xs)-min(xs)),height/(max(ys)-min(ys)),1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,label,'picketWhite')
# Concrete footings and chunky structural posts.
for y in (-1.77,1.77):
    box('concrete_foot',0,y,.19,.65,.65,.38,'sidewalk',.045)
    box('timber_post',-.04,y,1.45,.26,.27,2.55)
    box('post_cap',-.04,y,2.75,.29,.30,.08,'woodWarm')
    beam('diagonal_brace',(-.16,y,.74),(-.16,y*.38,1.74),.19,.17,'backpackTeal')
    for z in (.65,1.25,1.8): box('post_worn_edge',.099,y+.075,z,.012,.025,.21,'woodWarm',.002)
# Individual planks reveal deep vertical seams rather than coplanar paint.
for i in range(10):
    box('board_plank',0,-1.71+i*.38,2.52,.28,.371,1.51)
# Upper arch, with a continuous gold rim.
curve=[(-1.94+3.88*i/32,3.42+.47*math.sin(math.pi*i/32)) for i in range(33)]
profile('arched_header',[(-1.94,2.99),(1.94,2.99)]+list(reversed(curve)),0,.30,'backpackTeal')
for (y,z),(yy,zz) in zip(curve,curve[1:]):beam('curved_gold_trim',(.19,y,z),(.19,yy,zz),.075,.08,'schoolBusYellow')
for z in (1.76,3.02):box('gold_cross_rail',.185,0,z,.10,3.98,.085,'schoolBusYellow')
for y in (-1.96,1.96):box('gold_side_rail',.18,y,2.51,.10,.105,1.59,'schoolBusYellow')
text('SUNSET GROVE',0,3.30,3.35,.34)
text('HOME',-1.17,2.80,.90,.27)
text('GUEST',1.17,2.80,.97,.27)
# Score wells stand proud; recessed black faces sit behind separate border rails.
def well(y,z,w,h):
    box('display_back',.195,y,z,.075,w,h,'woodWarm')
    box('display_inset',.242,y,z,.018,w-.09,h-.09,'uiDark',.004)
    for zz in (z-h/2+.025,z+h/2-.025):box('display_frame',.268,y,zz,.055,w,.046,'woodWarm',.007)
    for yy in (y-w/2+.025,y+w/2-.025):box('display_frame',.268,yy,z,.055,.046,h,'woodWarm',.007)
well(-1.17,2.20,1.01,.83);well(1.17,2.20,1.01,.83)
well(0,2.15,.61,.82)
for y in (-.34,.34):box('inning_trim',.26,y,2.26,.028,.019,1.06,'picketWhite',.003)
for z in (1.73,2.79):box('inning_trim',.26,0,z,.028,.70,.019,'picketWhite',.003)
text('INNING',0,2.68,.60,.18,.279)
segments={'a':(-.12,.27,.12,.27),'b':(.12,.27,.12,0),'c':(.12,0,.12,-.27),'d':(-.12,-.27,.12,-.27),'e':(-.12,0,-.12,-.27),'f':(-.12,.27,-.12,0),'g':(-.12,0,.12,0)}
patterns={'0':'abcdef','2':'abged','3':'abgcd','4':'fgbc'}
def digit(number,y,z):
    points=set()
    for s in patterns[number]:
        y1,z1,y2,z2=segments[s]
        for j in range(6):points.add((round(y1+(y2-y1)*j/5,4),round(z1+(z2-z1)*j/5,4)))
    for yy,zz in sorted(points):
        sphere('score_bulb',.293,y+yy,z+zz,.023,'bulb',6,3,(.85,1,1))
for n,y in [('0',-1.40),('3',-.95),('0',.94),('2',1.40),('4',0)]:digit(n,y,2.19 if y else 2.10)
# Round baseball medallion, horseshoe trim, and raised red stitching.
sphere('baseball',.205,0,3.92,.275,'picketWhite',24,12,(.38,1,1))
for i in range(28):
    t=-.32+i*(math.pi+.64)/27;t2=-.32+(i+1)*(math.pi+.64)/27
    beam('crest_gold_rim',(.20,.325*math.cos(t),3.92+.325*math.sin(t)),(.20,.325*math.cos(t2),3.92+.325*math.sin(t2)),.048,.07,'schoolBusYellow')
for side in (-1,1):
    points=[]
    for i in range(13):
        zz=-.22+i*.44/12;yy=side*(.115-.055*math.cos(zz/.22*math.pi/2));xx=.205+.275*.38*math.sqrt(max(0,1-(yy*yy+zz*zz)/.275**2))+.009
        points.append((xx,yy,3.92+zz))
    for s,e in zip(points,points[1:]):beam('ball_seam',s,e,.009,.010,'blood')
    for xx,yy,zz in points[1:-1]:beam('ball_stitch',(xx+.004,yy-.023,zz-.009),(xx+.004,yy+.023,zz+.009),.013,.013,'blood')
# Fasteners, grain scars and restrained paint chips give the timber a worn park look.
for y in (-1.96,1.96):
    for z in (1.82,2.30,2.98,3.20):sphere('rail_bolt',.245,y,z,.025,'woodWarm',8,4,(.5,1,1))
rng=random.Random(28)
for i in range(56):
    y=rng.uniform(-1.82,1.82);z=rng.choice((rng.uniform(1.80,1.88),rng.uniform(2.97,3.06)))
    box('paint_chip',.245,y,z,.009,rng.uniform(.025,.10),rng.uniform(.006,.018),'woodWarm',0)
for i in range(24):
    y=rng.uniform(-1.8,1.8);z=rng.uniform(1.85,2.95)
    box('wood_grain',.150,y,z,.008,.007,rng.uniform(.035,.11),'woodWarm',0)
# No moving mechanical components. Bulbs are decorative emissives, independently addressable by material.
for mat in M.values():
    obs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
    if not obs:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:o.select_set(True)
    bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name='body_'+mat.name
    if mat.name.startswith('emi_'):obs[0]['decorativeEmissive']=True
col=bpy.data.objects.new('col:body',None);bpy.context.collection.objects.link(col);col.parent=root;col.location=(0,0,2.8);col['collider']='cuboid';col['size']=[.42,4.03,2.90]
asset=list(bpy.context.scene.objects);meshes=[o for o in asset if o.type=='MESH']
ao.bake_all(meshes,32)
tri=0
for o in meshes:o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
report={'id':'prop.scoreboard','tier':'Side','triangles':tri,'draw_calls':len(meshes),'materials':sorted(m.name for m in M.values()),'nodes_ok':all(bpy.data.objects.get(n) for n in ('root','body','col:body')),'within_budget':6000<=tri<=12000 and len(meshes)<=30,'rounds':4,'webgpu_ok':False,'webgl2_ok':False,'gaps':['Canonical teal and amber palette differs from reference forest green and orange; weathering and concrete pitting simplified for Side tier.']}
(HERE/'report.json').write_text(json.dumps(report,indent=2)+'\n')
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in asset:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(Path(a.glb).resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('BUILD OK',tri,'triangles',len(meshes),'draw calls')
if a.render:
    scene=bpy.context.scene;world=bpy.data.worlds.new('studio');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.06,.05,.075,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7
    box('studio_floor',0,0,-.055,200,200,.1,'uiDark',0)
    for loc,power,size,color in [((5,-5,8),1600,5,(1,.79,.55)),((1,5,6),1100,4,(.70,.80,1)),((-4,-1,6),1300,3,(1,.7,.35))]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.data.color=color;o.rotation_euler=(Vector((0,0,2.1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;target=Vector((0,0,2.12))
    cam.location={'ref':(10,-2.8,4.7),'game':(8,-8,10),'front':(10,0,2.12),'side':(0,-10,3),'rear':(-8,4,5)}[a.view]
    cam.data.type='ORTHO';cam.data.ortho_scale=10 if a.view=='game' else 9.1;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=a.samples;scene.cycles.use_denoising=True
    scene.render.resolution_x=a.width;scene.render.resolution_y=a.height;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(Path(a.render).resolve());bpy.ops.render.render(write_still=True);print('RENDER OK')
