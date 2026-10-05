"""Concrete tunnel portal: deterministic, texture-free, +X entrance, Z-up metres."""
import argparse, json, math, random, sys
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
HERE=Path(__file__).resolve().parent
p=argparse.ArgumentParser()
p.add_argument('--render'); p.add_argument('--view',default='ref'); p.add_argument('--glb')
p.add_argument('--samples',type=int,default=24); p.add_argument('--width',type=int,default=960); p.add_argument('--height',type=int,default=540)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene; s.unit_settings.system='METRIC'; rng=random.Random(831)
def mat(t,h,emit=0):
    c=[int(h[i:i+2],16)/255 for i in (1,3,5)]; c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+t); m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*c,1); b.inputs['Roughness'].default_value=.83
    if emit: b.inputs['Emission Color'].default_value=(*c,1); b.inputs['Emission Strength'].default_value=emit
    return m
M={t:mat(t,h) for t,h in {'sidewalk':'#b9a4a0','picketWhite':'#f2e6dc','infectedSkin':'#c9a39a','woodWarm':'#b0703f','asphalt':'#5b4f5c','uiDark':'#25222c','grass':'#6f8f3a','foliage':'#7da23c','schoolBusYellow':'#f2b630','brick':'#a8483a'}.items()}
M['windowGlow']=mat('windowGlow','#ffc773',5)
def empty(n,loc=(0,0,0),parent=None):
    o=bpy.data.objects.new(n,None); s.collection.objects.link(o); o.location=loc; o.parent=parent; return o
root=empty('root'); root['asset_id']='bld.tunnel-portal'; root['category']='building'; root['tier']='Hero'; root['forward']='+X'
body=empty('body',parent=root); roof=empty('roof',parent=root); interior=empty('interior',parent=root)
def mesh(n,v,f,t,parent=body,bevel=.025):
    d=bpy.data.meshes.new(n); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(n,d); s.collection.objects.link(o); o.parent=parent; d.materials.append(M[t])
    if bevel:
        b=o.modifiers.new('Soft edges','BEVEL'); b.width=bevel; b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o
def box(n,c,sz,t,parent=body,b=.025):
    x,y,z=[v/2 for v in sz]; o=mesh(n,[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)],[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],t,parent,min(b,min(sz)*.25)); o.location=c; return o
def prism(n,yz,x0,x1,t,parent=body,b=.025):
    N=len(yz); return mesh(n,[(x,y,z) for x in (x0,x1) for y,z in yz],[tuple(reversed(range(N))),tuple(range(N,2*N))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],t,parent,b)
def arch(n,r0,r1,ang0,ang1,x0,x1,t,parent):
    pts=[(r*math.cos(ang),2.75+r*math.sin(ang)) for r,ang in [(r0,ang0),(r1,ang0),(r1,ang1),(r0,ang1)]]
    return prism(n,pts,x0,x1,t,parent,.035)
# Road paving extends into the open-ended tunnel; bottom contacts z=0.
box('road foundation',(.35,0,.09),(7.3,7,.18),'uiDark',interior)
for ix in range(9):
    for iy in range(8):
        box('asphalt paving',(3.55-ix*.8,-3.05+iy*.87,.2),(.784,.85,.11),'asphalt',interior,.013)
for side in (-1,1):
    for j in range(9):
        box('curb',(-2.9+j*.78,side*3.04,.38),(.76,.32,.38),'sidewalk',interior,.025)
        box('edge paint',(-2.85+j*.78,side*2.75,.262),(.765,.10,.012),'schoolBusYellow',interior,.002)
for x in [-2.6,-.7,1.2,3.1]: box('center dash',(x,0,.263),(.95,.105,.014),'schoolBusYellow',interior,.002)
# Tunnel lining: courses of masonry and segmented barrel vault.
for side in (-1,1):
    for row in range(3):
        for j in range(5): box('inner wall block',(-2.75+j*.76,side*3.24,.73+row*.82),(.74,.49,.79),'sidewalk',interior,.028)
for j in range(5):
    for i in range(16): arch('vault block',3.0,3.43,i*math.pi/16+.005,(i+1)*math.pi/16-.005,-3.12+j*.77,-2.37+j*.77,'sidewalk',roof)
# Recessed masonry terminus is a removable visual panel, with no collision.
end=empty('interior_end',parent=interior); end['removable']=True
for row in range(7):
    z0=.3+row*.78; z1=min(z0+.755,5.72)
    if z0>=5.72: continue
    half=3.0 if z1<2.75 else math.sqrt(max(0,9-(z1-2.75)**2))
    for j in range(8):
        y0=max(-half,-3+j*.75+.01); y1=min(half,-3+(j+1)*.75-.01)
        if y1>y0: box('recess block',(-2.1,(y0+y1)/2,(z0+z1)/2),(.24,y1-y0,z1-z0),'sidewalk',end,.025)
# Distinct broad arch stones at the mouth, including vertical jambs.
for side in (-1,1):
    for row in range(3): box('arch jamb',(.72,side*3.39,.70+row*.85),(1.02,.78,.82),'infectedSkin',body,.045)
for i in range(13): arch('voussoir',3.0,3.79,i*math.pi/13+.006,(i+1)*math.pi/13-.006,.24,1.24,'infectedSkin',roof)
# Tapered facade piers with large block joints.
for side in (-1,1):
    for row in range(6):
        z0=.28+row*1.08; z1=min(z0+1.05,6.65); outer0=4.64-z0*.075; outer1=4.64-z1*.075
        inner=3.83
        prism('facade pier',[(side*inner,z0),(side*outer0,z0),(side*outer1,z1),(side*inner,z1)],-.08,.99,'infectedSkin',body,.04)
# Spandrel blocks follow the outside arch contour up to the horizontal lintel.
for i in range(8):
    y0=-3.83+i*.9575+.008; y1=y0+.9415
    pts=[(y0,2.75+math.sqrt(max(0,3.81**2-y0*y0))+.045),(y1,2.75+math.sqrt(max(0,3.81**2-y1*y1))+.045),(y1,6.65),(y0,6.65)]
    if min(v[1] for v in pts[:2])<6.6: prism('spandrel',pts,-.07,.99,'infectedSkin',roof,.035)
for i in range(7): box('lintel',(.39,-3.78+i*1.26,7.13),(1.20,1.235,.90),'infectedSkin',roof,.05)
# Projecting battered buttresses and diagonal safety plates.
for side in (-1,1):
    y=side*4.12
    box('footing',(1.12,y,.25),(1.55,1.4,.5),'infectedSkin',body,.06)
    for row in range(3):
        z0=.5+row*1.14; z1=z0+1.11
        prism('buttress',[(y-.51,z0),(y+.51,z0),(y+.42,z1),(y-.42,z1)],.62,1.62-row*.14,'infectedSkin',body,.045)
    plate=box('hazard backplate',(1.67,y,1.32),(.075,.94,1.56),'uiDark',body,.022)
    # Clip diagonal bands to the rectangular plate, keeping paint 6mm proud.
    def clip(poly,axis,bound,less):
        out=[]
        for u,v in zip(poly,poly[1:]+poly[:1]):
            iu=(u[axis]<=bound) if less else (u[axis]>=bound); iv=(v[axis]<=bound) if less else (v[axis]>=bound)
            if iu: out.append(u)
            if iu!=iv:
                k=(bound-u[axis])/(v[axis]-u[axis]); out.append(tuple(u[j]+k*(v[j]-u[j]) for j in (0,1)))
        return out
    for k in range(-3,5):
        q=[(-.47,k*.66),(.47,k*.66+.94),(.47,k*.66+.94+.33),(-.47,k*.66+.33)]
        q=clip(clip(q,1,-.76,False),1,.76,True)
        if len(q)>2: prism('hazard stripe',[(y+u,1.32+v) for u,v in q],1.714,1.727,'schoolBusYellow',body,.002)
# Conduit, retaining clips and serviceable lamps with joint origins.
for side in (-1,1):
    for x in (-1.95,.05):
        box('conduit',(x,side*2.978,1.71),(.075,.075,2.6),'uiDark',interior,.025)
        for z in (.55,1.15,2.1,2.8): box('conduit clip',(x,side*2.94,z),(.15,.085,.065),'woodWarm',interior,.013)
    lamp=empty('lamp_'+('L' if side<0 else 'R'),(-1.98,side*1.1,3.1),interior)
    box('lamp housing',(.1,0,0),(.23,.48,.54),'uiDark',lamp,.045)
    face=box('lamp lens',(.232,0,0),(.045,.34,.37),'windowGlow',lamp,.025); face.name='lampLens'+('L' if side<0 else 'R')
    box('lamp guard',(.264,0,0),(.035,.055,.41),'woodWarm',lamp,.01)
    anchor=empty('light:tunnel_'+str(side),(.33,0,0),lamp)
    anchor['ss_light']=json.dumps({'type':'point','color':'light_sodium','intensity':4,'range':5,'pool':True,'beam':'none','flare':True,'reflect':True,'shadow':'hero','heroPriority':1,'flicker':'none','powerGroup':'D-EDGE','breakable':True,'emissiveNodes':[face.name],'tiers':'all'})
# Faceted rock edging and lush stylized leaf clusters.
def ico(n,c,scale,t,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=c); o=bpy.context.object; o.name=n; o.scale=scale; o.parent=body; o.data.materials.append(M[t]); return o
for side in (-1,1):
    for j in range(7):
        z=.5+j*.72; y=side*(5.12-.08*j+.24*math.sin(j*1.7)); x=-.9+rng.uniform(-.4,.4)
        rock=ico('faceted rock',(x,y,z),(1.08-j*.045,.93-j*.025,.85),'sidewalk',2); rock.rotation_euler=(rng.random(),rng.random(),rng.random())
        for k in range(5):
            c=(x+.45+rng.random()*.35,y+side*rng.uniform(-.15,.45),z+.36+rng.random()*.3)
            ico('leaf cluster',c,(.35,.38,.28),'foliage',2)
            for leaf in range(6):
                ang=leaf*math.tau/6+rng.random()*.3; dx=.38*math.cos(ang); dy=.38*math.sin(ang)
                v=[c,(c[0]+dx*.6-dy*.23,c[1]+dy*.6+dx*.23,c[2]+.12),(c[0]+dx,c[1]+dy,c[2]+.48),(c[0]+dx*.6+dy*.23,c[1]+dy*.6-dx*.23,c[2]+.12),(c[0]+dx*.5,c[1]+dy*.5,c[2]+.22)]
                mesh('pointed leaf',v,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],'grass' if leaf%2 else 'foliage',body,0)
            if k==1: ico('flower',(c[0]+.2,c[1],c[2]+.24),(.08,.08,.08),'schoolBusYellow',1)
for side in (-1,1):
    for y in [side*3.6,side*4.7]:
        for k in range(9):
            c=(1.3,y,.18); ang=k*math.tau/9
            mesh('grass blade',[c,(c[0]+.18*math.cos(ang)-.1,c[1]+.18*math.sin(ang),.28),(c[0]+.7*math.cos(ang),c[1]+.7*math.sin(ang),.75+rng.random()*.25),(c[0]+.18*math.cos(ang)+.1,c[1]+.18*math.sin(ang),.28)],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],'foliage',body,0)
for side in (-1,1):
    for k in range(10):
        c=(.2,side*3.55,7.59); ang=k*math.tau/10
        mesh('cap grass',[c,(c[0]+.15*math.cos(ang)-.09,c[1]+.15*math.sin(ang),7.64),(c[0]+.52*math.cos(ang),c[1]+.52*math.sin(ang),8.0+rng.random()*.18),(c[0]+.15*math.cos(ang)+.09,c[1]+.15*math.sin(ang),7.64)],[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],'foliage',body,0)
# Sparse proud concrete chips: no coincident painted faces.
for k in range(140):
    y=rng.uniform(-4.0,4.0); z=rng.uniform(.6,7.45)
    if abs(y)<3.83 and z<2.75+math.sqrt(max(0,3.83**2-y*y)): continue
    x=1.005 if z<6.66 else 1.0; w=rng.uniform(.025,.10); h=rng.uniform(.025,.17)
    prism('surface chip',[(y-w,z+h),(y+w,z+h*.8),(y+w*.3,z-h),(y-w*.4,z)],x+.005,x+.013,'woodWarm',roof if z>5.6 else body,0)
# Collision volumes leave the mouth open.
for side in (-1,1):
    col=empty('col:wall_'+str(side),(-.6,side*3.98,2.5),root)
    col['collider']=json.dumps({'type':'cuboid','size':[5.3,1.3,5.0]})
col=empty('col:crown',(-.5,0,6.9),root); col['collider']=json.dumps({'type':'cuboid','size':[5.3,8.5,1.3]})
# Apply shapes and join static geometry by material within each hideable group.
for o in list(s.objects):
    if o.type!='MESH': continue
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new(); bm.from_mesh(o.data); bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces)); bm.to_mesh(o.data); bm.free()
    o.select_set(False)
for parent in (body,roof,interior,end):
    for material in M.values():
        objs=[o for o in s.objects if o.type=='MESH' and o.parent==parent and o.data.materials[0]==material]
        if not objs: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join(); objs[0].name=parent.name+'_'+material.name
# Bake ambient occlusion into exported vertex colors using all asset geometry.
meshes=[o for o in s.objects if o.type=='MESH']
s.render.engine='CYCLES'; s.cycles.samples=32; s.render.bake.target='VERTEX_COLORS'; s.render.bake.margin=0
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    attr=o.data.color_attributes.new(name='ao',type='BYTE_COLOR',domain='CORNER'); o.data.color_attributes.active_color=attr; o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.bake(type='AO')
def stats():
    return {'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),'draw_calls':sum(len(o.data.materials) for o in meshes),'materials':sorted(set(m.name for o in meshes for m in o.data.materials))}
if a.glb:
    def export(path, select_all=True):
        if select_all: bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_all_vertex_colors=True)
    st=stats(); export(a.glb)
    originals={o:o.data.copy() for o in meshes}; lods={}
    for level,ratio in [(1,.13),(2,.03)]:
        for o in meshes:
            o.data=originals[o].copy(); bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('LOD simplification','DECIMATE'); mod.ratio=ratio; bpy.ops.object.modifier_apply(modifier=mod.name)
        if level==2:
            # Join tiny distant details into their nearest palette, then restore originals.
            replacements={'pal_grass':'foliage','pal_woodWarm':'infectedSkin'}
            for o in meshes:
                if o.parent in (body,roof,interior) and o.data.materials[0].name in replacements:
                    o.data.materials[0]=M['uiDark' if o.parent==interior else replacements[o.data.materials[0].name]]
            # Export-only joined copies avoid mutating the Hero scene hierarchy.
            copies=[]; names={}
            for o in meshes:
                names[o]=o.name; o.name=names[o]+'_hero'
                c=o.copy(); c.name=names[o]; c.data=o.data.copy(); s.collection.objects.link(c); copies.append(c)
            for parent in (body,roof,interior,end):
                for material in M.values():
                    objs=[o for o in copies if o.parent==parent and o.data.materials[0]==material]
                    if len(objs)<2: continue
                    bpy.ops.object.select_all(action='DESELECT')
                    for o in objs: o.select_set(True)
                    bpy.context.view_layer.objects.active=objs[0]; bpy.ops.object.join()
                    copies=[o for o in s.objects if o.type=='MESH' and o not in meshes]
            bpy.ops.object.select_all(action='DESELECT')
            for o in s.objects:
                if o.type=='EMPTY' or o in copies: o.select_set(True)
            lods[str(level)]={'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in copies),'draw_calls':len(copies)}
            export(Path(a.glb).with_name('model.lod2.glb'), select_all=False)
            for o in copies: bpy.data.objects.remove(o,do_unlink=True)
            for o,name in names.items(): o.name=name
        else:
            lods[str(level)]=stats(); export(Path(a.glb).with_name('model.lod1.glb'))
    for o in meshes: o.data=originals[o]
    (HERE/'metrics.json').write_text(json.dumps({'lod0':st,'lods':lods},indent=2))
if a.render:
    # Render-only floor, lights and camera are added after export.
    floor=box('preview floor',(0,0,-.15),(200,200,.25),'uiDark',None,.01)
    world=bpy.data.worlds.new('World'); s.world=world; world.use_nodes=True; world.node_tree.nodes['Background'].inputs[0].default_value=(.14,.12,.19,1); world.node_tree.nodes['Background'].inputs[1].default_value=.65
    def area(n,c,power,color,size,target):
        d=bpy.data.lights.new(n,'AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size; o=bpy.data.objects.new(n,d); s.collection.objects.link(o); o.location=c; o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    area('golden key',(7,-6,13),2300,(1,.72,.48),7,(0,0,3)); area('lavender fill',(1,8,8),1600,(.53,.57,1),8,(0,0,3)); area('rim',(-5,-2,11),2000,(1,.65,.38),6,(0,0,3))
    for side in (-1,1):
        d=bpy.data.lights.new('lamp spill','POINT'); d.energy=90; d.color=(1,.36,.06); d.shadow_soft_size=.28; o=bpy.data.objects.new('lamp spill',d); s.collection.objects.link(o); o.location=(-1.5,side*1.1,3.1)
    d=bpy.data.cameras.new('Camera'); cam=bpy.data.objects.new('Camera',d); s.collection.objects.link(cam); s.camera=cam
    target=Vector((.25,0,3.7)); directions={'ref':(22,-8,8),'game':(15,-15,18),'front':(20,0,4),'rear':(-20,0,6),'side':(0,-20,6)}
    cam.location=target+Vector(directions[a.view]); cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler(); d.type='ORTHO'; d.ortho_scale=21.0 if a.view=='game' else 19.6
    s.cycles.samples=a.samples; s.cycles.use_denoising=True; s.render.resolution_x=a.width; s.render.resolution_y=a.height; s.render.resolution_percentage=100
    s.view_settings.view_transform='AgX'; s.render.image_settings.file_format='PNG'; s.render.filepath=a.render; bpy.ops.render.render(write_still=True)
print('OK',json.dumps(stats()))
