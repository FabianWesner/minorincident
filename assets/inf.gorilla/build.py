"""Hero infected silverback. Deterministic rigid rig; +X forward, -Y right, Z up.
All subdivision and bevels are applied. Run only through blender_run.py.
"""
import argparse, math, sys, json, struct
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
for k in ['render','glb']:ap.add_argument('--'+k)
ap.add_argument('--view',default='hero');ap.add_argument('--pose',action='store_true')
for k,v in [('samples',24),('width',960),('height',540)]:ap.add_argument('--'+k,type=int,default=v)
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def sheet(names,path,crop=False):
    import numpy as np
    panels=[]
    for name in names:
        im=bpy.data.images.load(str(P/'renders'/name));w,h=im.size;v=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(v);v=v.reshape(h,w,4)
        panels.append(v[:,160:800,:] if crop else v)
    data=np.concatenate(panels,axis=1);im=bpy.data.images.new('review_sheet',width=data.shape[1],height=data.shape[0],alpha=True)
    im.pixels.foreach_set(data.ravel());im.filepath_raw=str(path);im.file_format='PNG';im.save()
if a.render and a.view=='turnaround':
    sheet(['front.png','side.png','back.png','review-hero.png'],a.render,True)
    print('OK turnaround');sys.exit(0)
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[]
def mat(token,h,rough=.75,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(h[i:i+2],16)/255 for i in (0,2,4)];c=[x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c]+[1]
    b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,h,r) for k,h,r in [('uiDark','25222c',.87),('asphalt','5b4f5c',.88),('sidewalk','b9a4a0',.83),('infectedSkin','c9a39a',.69),('blood','b3121f',.36),('survivorRed','d9363e',.44),('picketWhite','f2e6dc',.42)]}
M['eye']=mat('infectedEye','ff3b2f',.25,4)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if sub:
        mod=o.modifiers.new('applied sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o
def ell(n,p,sz,m,par,seg=12,rings=8,rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,1)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=8,sub=1):
    v=[];f=[]
    for j,p in enumerate(points):
        t=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)]);t.normalize();u=t.cross(Vector((1,0,0)))
        if u.length<.1:u=t.cross(Vector((0,1,0)))
        u.normalize();w=t.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def lock(n,p,d,w,l,m,par):
    # Rounded tapered fur blade. Narrow roots disappear inside the underlying mass.
    p=Vector(p);d=Vector(d).normalized()
    o=tube(n,[p-d*.03,p+d*l*.18,p+d*l*.52,p+d*l*.83,p+d*l],[(w*.65,w*.22),(w,w*.39),(w*.76,w*.30),(w*.31,w*.14),.002],m,par,N=6)
    o['fur']=True;return o
def fur_mass(n,c,r,par,rows=4,count=12,silver=False):
    ell(n+'_undercoat',c,r,'sidewalk' if silver else 'uiDark',par)
    for j in range(rows):
        lat=-.82+j*1.77/max(rows-1,1)
        for i in range(count):
            t=i*2*math.pi/count+.23*(j%2);q=math.sqrt(1-lat*lat)
            p=(c[0]+r[0]*q*math.cos(t),c[1]+r[1]*q*math.sin(t),c[2]+r[2]*lat)
            d=(.4*math.cos(t),.4*math.sin(t),-.8)
            m=('sidewalk' if j>=1 else 'asphalt') if silver else 'uiDark'
            lock(n+'_fur_%d_%d'%(j,i),p,d,.112 if silver else .112,.25 if silver else .24,m,par)
node('root',(0,0,0));parts['root']['assetId']='inf.gorilla'
node('hip',(-.49,0,.89),'root');node('torso',(-.28,0,1.12),'hip');node('head',(.38,0,1.48),'torso')
node('backpackSocket',(-.55,0,1.52),'torso')
ell('haunch',(-.52,0,.96),(.38,.43,.36),'uiDark','hip')
ell('barrel_chest',(-.10,0,1.24),(.55,.56,.49),'uiDark','torso',seg=16,rings=10,rot=(0,-.32,0))
# Bare broad chest with two pectorals, sternum and sagging abdominal planes.
ell('chest_skin',(.33,0,1.17),(.11,.39,.35),'asphalt','torso',seg=16,rings=10)
for s in [-1,1]:
    ell('pectoral'+str(s),(.391,s*.19,1.31),(.091,.20,.15),'asphalt','torso')
    tube('pectoral_crease'+str(s),[(.448,s*.035,1.2),(.46,s*.15,1.18),(.39,s*.31,1.17)],[.013,.018,.008],'uiDark','torso')
ell('belly',(.24,0,.96),(.16,.29,.17),'asphalt','torso')
# Silverback saddle flows over shoulders down the back; layered locks follow the coat.
ell('silver_saddle',(-.38,0,1.45),(.39,.48,.35),'sidewalk','torso',seg=16,rings=10)
for j in range(3):
    x=-.60+j*.16
    for i in range(7):
        y=-.36+i*.12
        z=1.43+.34*math.sqrt(max(.02,1-((x+.36)/.46)**2-(y/.55)**2))
        lock('saddle_top_%d_%d'%(j,i),(x,y,z),(-.65,y*.6,-.6),.115,.29,'sidewalk','torso')
# Project descending coat roots onto the curved back and rump, avoiding a bare equator.
bpy.context.view_layer.update()
for j in range(7):
    z=.91+j*.12
    for i in range(7):
        y=-.36+i*.12;hits=[]
        for name in ['barrel_chest','haunch','silver_saddle']:
            o=bpy.data.objects[name];inv=o.matrix_world.inverted()
            hit,p,normal,index=o.ray_cast(inv@Vector((-2,y,z)),inv.to_3x3()@Vector((1,0,0)))
            if hit:hits.append(o.matrix_world@p)
        if hits:
            p=min(hits,key=lambda p:p.x);p.x-=.03
            lock('silver_mantle_%d_%d'%(j,i),p,(-.13,y*.22,-.95),.115,.25,'sidewalk' if j>0 else 'asphalt','torso' if j>1 else 'hip')
for s,side in [(1,'L'),(-1,'R')]:
    shoulder=(.00,s*.49,1.47);elbow=(.22,s*.74,.84);wrist=(.62,s*.78,.30)
    node('arm'+side,shoulder,'torso');node('foreArm'+side,elbow,'arm'+side);node('hand'+side,wrist,'foreArm'+side)
    fur_mass('shoulder'+side,(.015,s*.53,1.40),(.34,.34,.40),'arm'+side,5,11)
    for j in range(5):
        lock('shoulder_cape'+side+str(j),(.15,s*(.35+j*.08),1.71-abs(j-2)*.025),(.16,s*.25,-.9),.125,.29,'uiDark','arm'+side)
        lock('silver_shoulder'+side+str(j),(-.17,s*(.32+j*.083),1.70-abs(j-2)*.033),(-.3,s*.35,-.8),.10,.26,'sidewalk','arm'+side)
    tube('bicep'+side,[shoulder,(.09,s*.65,1.23),elbow],[.25,.29,.23],'uiDark','arm'+side,N=12)
    fur_mass('upperarm'+side,(.12,s*.69,1.04),(.24,.26,.32),'arm'+side,3,10)
    tube('forearm'+side,[elbow,(.35,s*.77,.62),wrist],[.23,.28,.20],'uiDark','foreArm'+side,N=12)
    fur_mass('gauntlet'+side,(.39,s*.78,.57),(.26,.28,.33),'foreArm'+side,4,11)
    ell('palm'+side,(.68,s*.78,.21),(.24,.235,.19),'asphalt','hand'+side)
    for j in range(4):
        y=s*(.61+j*.114)
        tube('curled_digit'+side+str(j),[(.77,y,.26),(.91,y,.23),(.92,y,.12),(.81,y,.078)],[.062,.07,.064,.047],'asphalt','hand'+side,N=8)
        ell('knuckle'+side+str(j),(.91,y,.145),(.064,.063,.075),'sidewalk','hand'+side,seg=8,rings=6)
        ell('nail'+side+str(j),(.959,y,.117),(.011,.036,.032),'asphalt','hand'+side,seg=8,rings=6)
    tube('thumb'+side,[(.62,s*.57,.23),(.76,s*.53,.17),(.83,s*.57,.12)],[.081,.072,.048],'asphalt','hand'+side,N=8)
    hip=(-.47,s*.29,.92);knee=(-.65,s*.41,.49);ankle=(-.52,s*.43,.17)
    node('leg'+side,hip,'hip');node('shin'+side,knee,'leg'+side);node('foot'+side,ankle,'shin'+side)
    fur_mass('thigh'+side,(-.58,s*.36,.70),(.29,.29,.36),'leg'+side,3,10,silver=True)
    tube('calf'+side,[knee,(-.65,s*.43,.32),ankle],[.23,.21,.16],'uiDark','shin'+side,N=10)
    fur_mass('shincoat'+side,(-.62,s*.44,.36),(.22,.23,.25),'shin'+side,3,9)
    ell('foot'+side,(-.41,s*.44,.115),(.29,.21,.115),'asphalt','foot'+side)
    for j in range(4):
        y=s*(.29+j*.10)
        ell('toe'+side+str(j),(-.18,y,.075),(.107,.053,.075),'asphalt','foot'+side,seg=8,rings=6)
        ell('toenail'+side+str(j),(-.089,y,.076),(.012,.034,.029),'sidewalk','foot'+side,seg=8,rings=6)
node('throwSocketR',(.72,-.78,.23),'handR');node('weaponSocketL',(.72,.78,.23),'handL');node('weaponSocketR',(.72,-.78,.23),'handR')
# Gorilla head: heavy cranial crest, projecting muzzle, ears and strong orbital ridges.
ell('cranium',(.35,0,1.70),(.31,.30,.34),'uiDark','head',seg=16,rings=10)
ell('face_mask',(.579,0,1.63),(.16,.242,.29),'asphalt','head',seg=16,rings=10)
ell('jaw',(.61,0,1.39),(.16,.209,.118),'asphalt','head')
for s in [-1,1]:
    ell('ear'+str(s),(.34,s*.301,1.72),(.066,.047,.099),'asphalt','head')
    ell('ear_bowl'+str(s),(.382,s*.326,1.725),(.033,.022,.059),'uiDark','head')
    tube('ear_helix'+str(s),[(.4,s*.328,1.68),(.416,s*.332,1.74),(.392,s*.332,1.77)],[.014,.016,.012],'sidewalk','head')
    ell('cheek'+str(s),(.619,s*.185,1.61),(.060,.082,.126),'asphalt','head')
    ell('orbit'+str(s),(.659,s*.116,1.777),(.04,.085,.077),'blood','head')
    ell('socket'+str(s),(.694,s*.117,1.784),(.029,.065,.052),'uiDark','head')
    ell('red_eye'+str(s),(.715,s*.118,1.782),(.025,.048,.038),'eye','head')
    ell('hot_pupil'+str(s),(.737,s*.118,1.785),(.008,.012,.014),'picketWhite','head',seg=8,rings=6)
    tube('heavy_brow'+str(s),[(.687,s*.026,1.806),(.691,s*.116,1.856),(.623,s*.211,1.857)],[.04,.058,.038],'asphalt','head',N=10)
    tube('brow_scar'+str(s),[(.731,s*.051,1.831),(.724,s*.084,1.855)],[.006,.005],'blood','head',N=6)
    for j in range(5):
        lock('cheek_ruff%d_%d'%(s,j),(.46,s*(.235+j*.009),1.86-j*.082),(.08,s*.20,-.9),.080,.23,'asphalt' if j%3==0 else 'uiDark','head')
ell('nose_bridge',(.685,0,1.72),(.078,.073,.108),'sidewalk','head')
ell('muzzle_upper',(.717,0,1.62),(.094,.164,.067),'infectedSkin','head')
ell('nose',(.752,0,1.686),(.081,.095,.059),'asphalt','head')
for s in [-1,1]:
    ell('nostril'+str(s),(.819,s*.043,1.69),(.019,.027,.018),'uiDark','head',seg=8,rings=6,rot=(s*.3,0,0))
    ell('nose_ala'+str(s),(.778,s*.079,1.677),(.038,.028,.025),'sidewalk','head')
# Boolean-cut true open mouth, with a recessed black bowl and raised fleshy lip contour.
bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=(.75,0,1.478));cut=bpy.context.object;cut.scale=(.18,.139,.184)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
for n in ['face_mask','jaw','muzzle_upper']:
    o=bpy.data.objects[n];mod=o.modifiers.new('open roaring mouth','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cut,do_unlink=True)
ell('mouth_depth',(.652,0,1.477),(.061,.144,.18),'uiDark','head',seg=16,rings=10)
pts=[(.775,.148*math.cos(t*2*math.pi/24),1.474+.192*math.sin(t*2*math.pi/24)) for t in range(25)]
tube('torn_lip',pts,[.02]*25,'blood','head',N=8)
for j in range(8):
    y=(j-3.5)*.029
    for row in [0,1]:
        z=(1.628 if row==0 else 1.315)+(abs(j-3.5)*(-.006 if row==0 else .006))
        tube('tooth%d_%d'%(row,j),[(.779,y,z),(.796,y,z+(-.036 if row==0 else .028))],[.014,.009],'picketWhite','head',N=8)
for s in [-1,1]:
    tube('upper_fang'+str(s),[(.784,s*.112,1.627),(.804,s*.119,1.564),(.81,s*.102,1.532)],[.023,.017,.002],'picketWhite','head',N=8)
    tube('lower_fang'+str(s),[(.786,s*.109,1.321),(.804,s*.115,1.36),(.807,s*.105,1.377)],[.019,.014,.002],'picketWhite','head',N=8)
ell('tongue',(.73,0,1.361),(.04,.075,.059),'survivorRed','head')
tube('tongue_cleft',[(.77,0,1.35),(.775,0,1.388)],[.004,.002],'blood','head',N=6)
for j in range(9):
    y=(j-4)*.052
    lock('crown_crest'+str(j),(.35-(j%3)*.035,y,1.942+(j%3)*.014),(-.55,y*.6,.65),.088,.17,'asphalt' if j%3==0 else 'uiDark','head')
for j in range(16):
    t=2*math.pi*j/16
    lock('crown_mantle'+str(j),(.33+.22*math.cos(t),.25*math.sin(t),1.93),(.3*math.cos(t),.25*math.sin(t),-.45),.086,.24,'uiDark','head')
for j in range(8):
    t=2*math.pi*j/8
    lock('nape'+str(j),(.16+.09*math.cos(t),.23*math.sin(t),1.79),(-.45,.25*math.sin(t),-.9),.086,.28,'uiDark','head')
# Irregular wounds are volumetric, embedded among the fur, with pale torn skin edges.
def wound(n,p,ry,rz,par):
    x,y,z=p
    ell(n+'_gash',p,(.022,ry,rz),'blood',par,seg=10,rings=6)
    for j in range(3):
        py=y+(j-1)*ry*.73;pz=z+(j%2-.5)*rz
        tube(n+'_rag'+str(j),[(x+.01,py-.025,pz+rz*.5),(x+.03,py,pz+.006),(x+.025,py+.022,pz-rz*.4)],[.012,.024,.004],'infectedSkin',par,N=6)
    for j in range(2):
        tube(n+'_drip'+str(j),[(x+.026,y+(j-.5)*ry*.6,z-rz*.3),(x+.03,y+(j-.5)*ry*.6,z-rz-.066)],[.014,.007],'blood',par,N=6)
wound('shoulder_tear',(.31,-.64,1.30),.13,.16,'armR')
wound('forearm_tear',(.611,.78,.62),.15,.115,'foreArmL')
wound('forearm_scars',(.60,-.82,.52),.09,.085,'foreArmR')
wound('chest_tear',(.439,-.22,1.15),.065,.085,'torso')
wound('temple_tear',(.588,-.19,1.92),.052,.045,'head')
# Back wounds face -X.
for n,p,ry,rz,par in [('saddle_wound',(-.825,.17,1.53),.105,.055,'torso'),('haunch_wound',(-.828,-.37,.81),.09,.074,'legR')]:
    x,y,z=p;ell(n,p,(.025,ry,rz),'blood',par)
    for j in range(3):lock(n+'_rim'+str(j),(x-.016,y+(j-1)*ry*.7,z+.035),(-.2,.4,-.5),.03,.08,'infectedSkin',par)
# Hidden dismemberment caps remain on the proximal part. Geometry is retained at zero scale.
for key,par,p,sz in [('head','torso',(.38,0,1.48),(.16,.19,.022)),('armL','torso',(0,.49,1.47),(.19,.025,.19)),('armR','torso',(0,-.49,1.47),(.19,.025,.19)),('foreArmL','armL',(.22,.74,.84),(.18,.18,.022)),('foreArmR','armR',(.22,-.74,.84),(.18,.18,.022)),('legL','hip',(-.47,.29,.92),(.21,.20,.022)),('legR','hip',(-.47,-.29,.92),(.21,.20,.022))]:
    o=ell('stump_'+key,p,sz,'blood',par,seg=10,rings=6);o['hidden']=True;o['stumpFor']=key;o.scale=(0,0,0)
# Widen the mask and cranial silhouette to the reference's heavy gorilla proportions.
bpy.context.view_layer.update()
for o in objects:
    if o.parent==parts['head']:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            p=o.matrix_world@v.co;p.y*=1.10;v.co=inv@p
# Remove redundant tessellation while keeping rounded contours; merge by rigid part/material.
for o in objects:
    bpy.context.view_layer.objects.active=o
    if len(o.data.polygons)>100:
        mod=o.modifiers.new('game density','DECIMATE');mod.ratio=.085 if o.get('fur') else .15;bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));tiny=[f for f in bm.faces if f.calc_area()<1e-9]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
caps=[o for o in objects if o.name.startswith('stump_')]
# Preserve individual sculpt pieces for LODs: global reduction of joined tufts creates spikes.
lod_sources=[(o.name,o.data.copy(),o.matrix_world.copy(),o.parent.name,bool(o.get('fur'))) for o in objects if o not in caps]
def join_parts(items):
    buckets={}
    for o in items:buckets.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
    joined=[]
    for (par,m),group in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        if len(group)>1:bpy.ops.object.join()
        o=group[0];o.name=par+'__'+m;joined.append(o)
    return joined
objects=join_parts([o for o in objects if o not in caps])+caps
bpy.context.view_layer.update()
# Plant the lowest toe and curled knuckle surfaces exactly on the ground plane.
ground_shifts={}
for par in ['footL','footR','handL','handR']:
    group=[o for o in objects if o.parent==parts[par]]
    floor=min((o.matrix_world@v.co).z for o in group for v in o.data.vertices)
    ground_shifts[par]=floor
    for o in group:o.location.z-=floor
required=list(parts)+['stump_'+n for n in ['head','armL','armR','foreArmL','foreArmR','legL','legR']]
triangles=sum(len(o.data.polygons) for o in objects)
stats={'id':'inf.gorilla','triangles':triangles,'meshes':len(objects),'nodes_ok':all(n in bpy.data.objects for n in required),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
(P/'build-stats.json').write_text(json.dumps(stats,indent=2))
(P/'rig-rest.json').write_text(json.dumps({'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},'hierarchy':{n:o.parent.name if o.parent else None for n,o in parts.items()}},indent=2))
assert triangles<=25000, f'LOD0 over animal budget: {triangles}'
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
    lod_counts={'LOD0':triangles}
    for level,step,ratio in [(1,3,.24),(2,6,.10)]:
        reduced=[];fur_index={}
        for name,data,world,par,is_fur in lod_sources:
            if is_fur:
                index=fur_index.get(par,0);fur_index[par]=index+1
                if index%step:continue
            o=bpy.data.objects.new('lod'+str(level)+'_'+name,data.copy());S.collection.objects.link(o)
            o.parent=parts[par];o.matrix_world=world;o.location.z-=ground_shifts.get(par,0)
            bpy.context.view_layer.objects.active=o
            # Minimum faces preserve eyes, teeth, fingers and closed, chunky tuft volumes.
            minimum=(12 if level==1 else 10) if is_fur else (24 if level==1 else 18)
            r=max(ratio,min(1,minimum/max(len(o.data.polygons),1)))
            if r<1:
                mod=o.modifiers.new('per-piece LOD','DECIMATE');mod.ratio=r;bpy.ops.object.modifier_apply(modifier=mod.name)
            reduced.append(o)
        reduced=join_parts(reduced)
        cap_data={o:o.data for o in caps}
        for o in caps:
            o.data=o.data.copy();bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('LOD stump cap','DECIMATE');mod.ratio=.5 if level==1 else .25;bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.select_all(action='DESELECT')
        for o in reduced+caps+list(parts.values()):o.select_set(True)
        target=str(Path(a.glb).with_name('model.lod'+str(level)+'.glb'))
        bpy.ops.export_scene.gltf(filepath=target,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
        data=Path(target).read_bytes();length=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+length])
        lod_counts['LOD'+str(level)]=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
        for o,data in cap_data.items():
            reduced_cap=o.data;o.data=data;bpy.data.meshes.remove(reduced_cap)
        for o in reduced:
            data=o.data;bpy.data.objects.remove(o,do_unlink=True);bpy.data.meshes.remove(data)
    (P/'lod-stats.json').write_text(json.dumps(lod_counts,indent=2))
for name,data,world,par,is_fur in lod_sources:bpy.data.meshes.remove(data)
def pose_joints():
    parts['armL'].rotation_euler.x=.72
    parts['foreArmL'].rotation_euler.y=-.65
    parts['legR'].rotation_euler.y=-.38
    bpy.context.view_layer.update()
def show_cap():
    for o in objects:
        p=o.parent
        while p:
            if p==parts['armL']:o.hide_render=True;break
            p=p.parent
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
if a.pose:
    pose_joints()
    if a.view=='stump':show_cap()
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.075,.067,.085,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    def light(n,p,power,color,size):
        d=bpy.data.lights.new(n,'AREA');o=bpy.data.objects.new(n,d);S.collection.objects.link(o);o.location=p;d.energy=power;d.color=color;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    light('warm key',(4,-4,6),650,(1,.83,.69),4);light('cool fill',(2,4,4),400,(.63,.72,1),3);light('amber rim',(-3,1,4),850,(1,.48,.23),3)
    bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(mat('studio','35303b'))
    cam=bpy.data.objects.new('camera',bpy.data.cameras.new('camera'));S.collection.objects.link(cam);S.camera=cam
    views={'hero':(6,-5,3.3),'front':(7,0,1.3),'side':(0,-7,1.3),'back':(-7,0,1.3),'stump':(5,6,3.0)}
    S.render.engine='CYCLES';S.cycles.use_denoising=True;S.view_settings.view_transform='AgX';S.render.image_settings.file_format='PNG'
    def render(view,path,width=960,height=540,samples=24):
        cam.location=views.get(view,views['hero']);cam.rotation_euler=(Vector((.06,0,1.02))-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.type='ORTHO';cam.data.ortho_scale=2.6*max(width/height,1)
        S.cycles.samples=samples;S.render.resolution_x=width;S.render.resolution_y=height;S.render.resolution_percentage=100;S.render.filepath=str(path);bpy.ops.render.render(write_still=True)
    if a.view=='final-set':
        for view,name in [('front','front'),('side','side'),('back','back'),('hero','review-hero')]:render(view,P/'renders'/f'{name}.png')
        sheet(['front.png','side.png','back.png','review-hero.png'],P/'renders'/'turnaround.png',True)
        render('hero',a.render,a.width,a.height,a.samples)
        pose_joints();render('hero',P/'renders'/'pose-joints.png')
        show_cap();render('stump',P/'renders'/'pose-stump.png')
        sheet(['pose-joints.png','pose-stump.png'],P/'renders'/'pose-test.png')
    else:render(a.view,a.render,a.width,a.height,a.samples)
print('OK',triangles,'triangles',len(objects),'meshes')
