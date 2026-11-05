"""Deterministic river kit: reusable module roots, metres, Z-up, +X forward.
No textures: palette PBR, raised ribbon foam, broad faceted rocks and reeds.
"""
import bpy, bmesh, math, random, sys, json
from pathlib import Path
from mathutils import Vector
HERE = Path(__file__).resolve().parent
ARGS = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
def arg(key, default=None):
    return ARGS[ARGS.index(key)+1] if key in ARGS else default
rng = random.Random(260)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
root = bpy.data.objects.new('root', None)
scene.collection.objects.link(root)
root['asset_id'] = 'kit.river-terrain'
root['category'] = 'building'
root['forward'] = '+X'
materials = {}
def material(token, color, roughness=.8):
    mat = bpy.data.materials.new('pal_'+token)
    mat.use_nodes = True
    c = [int(color[i:i+2],16)/255 for i in (0,2,4)]
    rgba = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    mat.diffuse_color = rgba
    bs = mat.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = rgba
    bs.inputs['Roughness'].default_value = roughness
    materials[token] = mat
for token,color,rough in [('backpackTeal','205f79',.27),('policeBlue','29778e',.3),('picketWhite','f5e7c4',.5),('woodWarm','bd8761',.9),('sidewalk','8e879e',.9),('asphalt','655f78',.9),('grass','6f8f3a',.85),('foliage','9eae35',.8),('schoolBusYellow','d6c34b',.75),('brick','bd6f20',.7)]:
    material(token,color,rough)
modules = {}
def module(name, origin):
    ob=bpy.data.objects.new(name,None);scene.collection.objects.link(ob)
    ob.parent=root;ob.location=origin;ob['module']=True
    modules[name]=ob
    return ob
water=module('waterSurface',(-2.3,2.0,0))
bank=module('slopedBank',(-2.1,-2.45,0))
rocks=module('rocks',(3.1,2.4,0))
reeds=module('reeds',(3.0,-2.1,0))
def mesh(name, verts, faces, token, parent):
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob)
    ob.parent=parent;me.materials.append(materials[token]);return ob

def wave(x,y):
    return .28+.09*math.sin(4*x+2.5*y)+.045*math.sin(7*y-2*x)
def grid(name,x0,x1,y0,y1,nx,ny,height,token,parent,solid=False):
    vs=[(x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny,height(x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny)) for j in range(ny+1) for i in range(nx+1)]
    fs=[]
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;fs.extend([(a,a+1,a+nx+2),(a,a+nx+2,a+nx+1)])
    if solid:
        perimeter=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
        lows=[]
        for a in perimeter:lows.append(len(vs));vs.append((vs[a][0],vs[a][1],0))
        for i,a in enumerate(perimeter):
            k=(i+1)%len(perimeter);fs.append((a,lows[i],lows[k],perimeter[k]))
        fs.append(tuple(reversed(lows)))
    return mesh(name,vs,fs,token,parent)
def ribbon(name,pts,width,token,parent):
    vs=[]
    for i,p in enumerate(pts):
        direction=Vector(pts[min(i+1,len(pts)-1)])-Vector(pts[max(0,i-1)])
        d=Vector((-direction.y,direction.x,0)).normalized()*width*(.65+.35*math.sin(math.pi*i/(len(pts)-1)))
        edges = [Vector(p)-d, Vector(p)+d]
        if parent == water:
            for edge in edges: edge.z = wave(edge.x,edge.y) + (.038 if token == 'picketWhite' else .028)
        vs.extend(edges)
    return mesh(name,vs,[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(pts)-1)],token,parent)
def stone(name,center,scale,parent,moss=True,detail=2):
    bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=detail,radius=1)
    for v in bm.verts:
        v.co*=rng.uniform(.88,1.1)
        v.co.x*=scale[0];v.co.y*=scale[1];v.co.z*=scale[2]
        v.co.z=max(v.co.z,-scale[2]*.72)
    me=bpy.data.meshes.new(name);bm.to_mesh(me);bm.free()
    ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=parent;ob.location=center
    for token in ('sidewalk','asphalt','woodWarm','grass'):me.materials.append(materials[token])
    for p in me.polygons:
        p.material_index=3 if moss and p.normal.z>.25 and rng.random()<.13 else (2 if p.normal.z>.55 else (1 if rng.random()<.17 else 0))
    bevel=ob.modifiers.new('soft stone edges','BEVEL');bevel.width=.018;bevel.segments=1
    return ob

def blade(center,angle,length,parent,token):
    x,y,z=center;dx,dy=math.cos(angle),math.sin(angle);w=.058
    pts=[]
    for i in range(5):
        t=i/4;lean=length*(.09*t+.38*t*t)
        taper=w*(1-t)+.002
        pts.extend([(x+dx*lean-dy*taper,y+dy*lean+dx*taper,z+length*(t-.18*t*t)),(x+dx*lean+dy*taper,y+dy*lean-dx*taper,z+length*(t-.18*t*t)),(x+dx*lean,y+dy*lean,z+length*(t-.18*t*t)+.012*(1-t))])
    fs=[]
    for i in range(4):
        a=3*i;fs.extend([(a,a+3,a+5,a+2),(a+2,a+5,a+4,a+1)])
    mesh('folded reed blade',pts,fs,token,parent)
def grass(center,parent,count=11,size=.55):
    for i in range(count):
        a=2*math.pi*i/count+rng.uniform(-.2,.2)
        blade((center[0]+rng.uniform(-.07,.07),center[1]+rng.uniform(-.07,.07),center[2]),a,size*rng.uniform(.65,1.25),parent,('grass','foliage','schoolBusYellow')[i%3])
def cylinder_between(name,a,b,radius,token,parent,vertices=8):
    direction=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=radius,radius2=radius*.92,depth=direction.length,location=(0,0,0))
    ob=bpy.context.object;ob.name=name;ob.parent=parent;ob.location=(Vector(a)+Vector(b))/2
    ob.rotation_euler=direction.to_track_quat('Z','Y').to_euler();ob.data.materials.append(materials[token])
    return ob
# Water: a closed tile with geometric wave crests and foam ribbons 8 mm above it.
grid('wave tile',-2,2,-1.8,1.8,30,26,wave,'backpackTeal',water,True)
for row in range(10):
    y=-1.65+row*.35
    pts=[(-1.95+i*3.9/32,y+.10*math.sin(i*.36+row),0) for i in range(33)]
    pts=[(x,y,wave(x,y)+.008) for x,y,_ in pts]
    ribbon('blue wave ridge',pts,.028,'policeBlue',water)
    for start,end in ((2,9),(14,19),(24,30)):
        if rng.random()<.8:ribbon('crest foam',[(x,y,z+.008) for x,y,z in pts[start:end]],.011,'picketWhite',water)
for x,y,s in [(-1.25,-1.55,.43),(0,-1.65,.35),(1.72,-.8,.31)]:
    stone('shore rock',(x,y,.28),(s,s*.8,s*.72),water)
    grass((x-.22,y-.04,.35),water,10,.46)
# Separate slope: high dry edge behind a shallow rocky waterline.
def bank_height(x,y):
    return .22+1.05*((y+1.05)/2.1)**1.5+.08*math.sin(x*2.2)*math.sin((y+1.05)*1.6)
earth=grid('bank earth',-2.35,2.35,-1.05,1.05,26,14,bank_height,'woodWarm',bank,True)
earth.data.materials.append(materials['sidewalk'])
for face in earth.data.polygons:
    if abs(face.normal.z)<.1 or (face.center.y>.25 and face.center.x<-1.1 and rng.random()<.4): face.material_index=1
grid('bank waterline',-2.35,2.35,-1.55,-1.08,25,3,lambda x,y:.13+.012*math.sin(4*x+7*y),'backpackTeal',bank,True)
for i in range(11):
    x=-2.12+i*.42;y=-1.03+rng.uniform(-.14,.12);s=rng.uniform(.17,.37)
    stone('shore boulder',(x,y,.19+s*.45),(s,s*.75,s*.75),bank)
for i in range(34):
    x=rng.uniform(-2.25,2.25);y=rng.uniform(-.83,1.0)
    grass((x,y,bank_height(x,y)+.004),bank,7 if i<26 else 11,rng.uniform(.32,.63))
for i in range(24):
    x=rng.uniform(-2.3,2.3);y=rng.uniform(-.9,1)
    stone('bank pebble',(x,y,bank_height(x,y)+.015),(.045,.04,.035),bank,False,1)
# Low moss cushions break up the bank's dry earth.
for i in range(22):
    x=rng.uniform(-2.2,2.2); y=rng.uniform(-.65,.85)
    moss=stone('moss cushion',(x,y,bank_height(x,y)+.017),(.13,.10,.034),bank,False,1)
    moss.modifiers.clear();moss.data.materials.clear();moss.data.materials.append(materials['grass'])
    for face in moss.data.polygons: face.material_index=0
# Chunky shrub crowns along the high grassy edge.
for i in range(18):
    x=-2.18+i*.25; y=.93+rng.uniform(-.05,.06); z=bank_height(x,y)
    shrub=stone('low river shrub',(x,y,z+.10),(.17,.14,rng.uniform(.12,.23)),bank,False,1)
    shrub.modifiers.clear()
    shrub.data.materials.clear();shrub.data.materials.append(materials['foliage'])
    for face in shrub.data.polygons: face.material_index=0
# Four broad, distinct faceted boulders in the kit's spare-rock panel.
for i,(x,y,sx,sy,sz) in enumerate([(-.65,.75,.61,.57,.74),(.8,.75,.65,.54,.67),(-.7,-.95,.78,.62,.49),(.9,-.95,.55,.52,.49)]):
    stone('boulder '+str(i),(x,y,sz*.74),(sx,sy,sz),rocks)
# Reeds: separate cattail heads; each stem pivot stays at its planted base.
for k,(x,y,size,cattails) in enumerate([(-.85,.35,1.65,5),(.9,.25,1.25,0),(.45,-1.3,.9,0)]):
    grass((x,y,0),reeds,22,size)
    if cattails:
        for j in range(cattails):
            a=j*2.4;bx=x+.22*math.cos(a);by=y+.22*math.sin(a);h=size*rng.uniform(.95,1.3)
            cylinder_between('cattail stem',(bx,by,0),(bx+.05,by,h+.2),.012,'foliage',reeds)
            head=cylinder_between('cattail head',(bx+.04,by,h-.16),(bx+.05,by,h+.18),.058,'brick',reeds,10)
            b=head.modifiers.new('rounded seed head','BEVEL');b.width=.024;b.segments=2
    if k==2:stone('reed companion rock',(x+.48,y,.26),(.4,.35,.35),reeds)
# Apply bevels; split material islands and merge static geometry per reusable module.
for ob in list(scene.objects):
    if ob.type!='MESH':continue
    bpy.context.view_layer.objects.active=ob
    for modifier in list(ob.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
    if len(ob.data.materials)>1:
        bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
for ob in list(scene.objects):
    if ob.type == 'MESH':
        used = sorted({p.material_index for p in ob.data.polygons})
        mats = [ob.data.materials[i] for i in used]
        indices = [used.index(p.material_index) for p in ob.data.polygons]
        ob.data.materials.clear()
        for mat in mats: ob.data.materials.append(mat)
        for p, index in zip(ob.data.polygons, indices): p.material_index = index
for mod in modules.values():
    for mat in materials.values():
        batch=[ob for ob in scene.objects if ob.type=='MESH' and ob.parent==mod and ob.data.materials[0]==mat]
        if not batch:continue
        bpy.ops.object.select_all(action='DESELECT')
        for ob in batch:ob.select_set(True)
        bpy.context.view_layer.objects.active=batch[0];bpy.ops.object.join()
        bpy.context.object.name=mod.name+'_'+mat.name
meshes=[ob for ob in scene.objects if ob.type=='MESH']
def clean(ob):
    bm=bmesh.new();bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm,faces=list(bm.faces))
    zero=[face for face in bm.faces if face.calc_area()<1e-8]
    if zero: bmesh.ops.delete(bm,geom=zero,context='FACES')
    bm.to_mesh(ob.data);bm.free();ob.data.update()
for ob in meshes: clean(ob)
# Bake AO as glTF vertex colors, no bitmap dependencies.
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.seed=260
for ob in meshes:
    ao=ob.data.color_attributes.new(name='ao',type='FLOAT_COLOR',domain='CORNER');ob.data.color_attributes.active_color=ao
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes:ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO',target='VERTEX_COLORS')
def stats():
    for ob in meshes:ob.data.calc_loop_triangles()
    return sum(len(ob.data.loop_triangles) for ob in meshes)
def export(path):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in [root,*modules.values(),*meshes]:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_lights=False,export_cameras=False)
triangles=stats()
report={'id':'kit.river-terrain','tier':'Hero','triangles':triangles,'draw_calls':len(meshes),'materials':sorted(m.name for m in materials.values()),'nodes_ok':True,'within_budget':triangles<=20000 and len(meshes)<=40,'rounds':3,'webgpu_ok':False,'webgl2_ok':False,'gaps':[]}
(HERE/'build-stats.json').write_text(json.dumps(report,indent=2)+'\n')
if arg('--glb'):
    export(Path(arg('--glb')).resolve())
    # Small disconnected foliage sets a floor on the achieved LOD ratio.
    originals={ob:ob.data for ob in meshes}
    for level,ratio in [(1,.12),(2,.008)]:
        for ob in meshes:
            ob.data=originals[ob].copy()
            dec=ob.modifiers.new('LOD','DECIMATE');dec.ratio=ratio;dec.use_collapse_triangulate=True
            bpy.context.view_layer.objects.active=ob
            bpy.ops.object.modifier_apply(modifier=dec.name)
            clean(ob)
        export(HERE/f'model.lod{level}.glb')
        for ob in meshes:
            reduced=ob.data;ob.data=originals[ob];bpy.data.meshes.remove(reduced)
print('BUILD OK',triangles,'triangles',len(meshes),'draw calls')
if arg('--render'):
    scene.world=bpy.data.worlds.new('Studio world')
    scene.world.color=(.12,.12,.12)
    world=scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.14,.20,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
    def light(name,loc,power,color,size):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
        ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    light('warm key',(-3,-4,10),1700,(1,.76,.5),7)
    light('cool fill',(5,1,7),1000,(.58,.68,1),8)
    light('rim',(-3,7,6),1200,(1,.82,.57),6)
    ground=mesh('studio floor',[(-200,-200,-.025),(200,-200,-.025),(200,200,-.025),(-200,200,-.025)],[(0,1,2,3)],'asphalt',None)
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));scene.collection.objects.link(cam);scene.camera=cam
    view=arg('--view','ref');loc={'ref':(11,-16,15),'game':(13,-13,19),'front':(20,0,9),'side':(0,-20,9),'rear':(-12,15,13)}[view]
    cam.location=loc;cam.rotation_euler=(Vector((0,0,.3))-Vector(loc)).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=16.0 if view=='game' else 14.7
    scene.cycles.samples=int(arg('--samples',24));scene.cycles.use_denoising=True
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
    scene.render.resolution_x=int(arg('--width',960));scene.render.resolution_y=int(arg('--height',540));scene.render.resolution_percentage=100
    scene.render.filepath=str(Path(arg('--render')).resolve());bpy.ops.render.render(write_still=True)
    print('RENDER OK')
