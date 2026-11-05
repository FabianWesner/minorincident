"""Hero infected tabby. +X forward, Z up, -Y right. Deterministic rigid parts.
Build/render only through experiment/tools/blender_run.py; no external textures.
"""
import argparse, math, sys, json
from pathlib import Path
import bpy, bmesh
from mathutils import Vector
P=Path(__file__).resolve().parent
ap=argparse.ArgumentParser()
ap.add_argument('--lod',type=int,choices=[0,1,2],default=0);ap.add_argument('--render');ap.add_argument('--glb');ap.add_argument('--view',default='hero')
ap.add_argument('--samples',type=int,default=24);ap.add_argument('--width',type=int,default=960);ap.add_argument('--height',type=int,default=540);ap.add_argument('--pose',action='store_true')
a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
bpy.ops.wm.read_factory_settings(use_empty=True)
S=bpy.context.scene;parts={};objects=[]
def save_turnaround(path):
    import numpy as np
    panels=[]
    for view in ['front','side','back','hero']:
        im=bpy.data.images.load(str(P/'renders'/('round4-'+view+'.png')))
        w,h=im.size;pixels=np.empty(w*h*4,dtype=np.float32);im.pixels.foreach_get(pixels)
        panels.append(pixels.reshape(h,w,4))
    data=np.concatenate(panels,axis=1)
    sheet=bpy.data.images.new('turnaround',width=data.shape[1],height=data.shape[0],alpha=True)
    sheet.pixels.foreach_set(data.ravel());sheet.filepath_raw=path;sheet.file_format='PNG';sheet.save()
if a.view=='turnaround' and a.render:
    save_turnaround(a.render);print('OK turnaround');sys.exit(0)

def mat(token,hex,rough=.7,emit=0):
    m=bpy.data.materials.new(('emi_' if emit else 'pal_')+token);m.use_nodes=True
    c=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]+[1]
    b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=c;b.inputs['Roughness'].default_value=rough
    if emit:b.inputs['Emission Color'].default_value=c;b.inputs['Emission Strength'].default_value=emit
    m.diffuse_color=c;return m
M={k:mat(k,v,r) for k,v,r in [('infectedSkin','c9a39a',.68),('picketWhite','f2e6dc',.85),('asphalt','5b4f5c',.8),('uiDark','25222c',.78),('blood','b3121f',.35)]}
M['eye']=mat('infectedEye','ff3b2f',.24,2.5)
def node(n,p,par=None):
    o=bpy.data.objects.new(n,None);S.collection.objects.link(o);o.location=p
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    parts[n]=o;return o
def finish(o,n,m,par,sub=0):
    o.name=n;o.data.materials.append(M[m]);bpy.context.view_layer.objects.active=o
    if sub:
        mod=o.modifiers.new('sculpt smoothing','SUBSURF');mod.levels=sub;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=True
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if par:
        bpy.context.view_layer.update();o.parent=parts[par];o.matrix_parent_inverse=o.parent.matrix_world.inverted()
    objects.append(o);return o

def ell(n,p,sz,m,par,rot=None,seg=8,rings=6,sub=1):
    seg=min(seg,12);rings=min(rings,8)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p);o=bpy.context.object;o.scale=sz
    if rot:o.rotation_euler=rot
    return finish(o,n,m,par,sub)
def mesh(n,v,f,m,par,sub=1):
    me=bpy.data.meshes.new(n);me.from_pydata(v,[],f);me.update();o=bpy.data.objects.new(n,me);S.collection.objects.link(o)
    return finish(o,n,m,par,sub)
def tube(n,points,radii,m,par,N=8,sub=1):
    N=min(N,8)
    v=[];f=[]
    for j,p in enumerate(points):
        tangent=Vector(points[min(j+1,len(points)-1)])-Vector(points[max(j-1,0)])
        tangent.normalize();u=tangent.cross(Vector((1,0,0)))
        if u.length<.1:u=tangent.cross(Vector((0,1,0)))
        u.normalize();w=tangent.cross(u);r=radii[j];rx,ry=(r,r) if isinstance(r,(int,float)) else r
        for i in range(N):v.append(Vector(p)+u*rx*math.cos(i*2*math.pi/N)+w*ry*math.sin(i*2*math.pi/N))
    for j in range(len(points)-1):
        for i in range(N):k=j*N+i;kk=j*N+(i+1)%N;f.append((k,kk,kk+N,k+N))
    f.extend([tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+i for i in range(N))])
    return mesh(n,v,f,m,par,sub)
def patch(n,pts,m,par,depth=.006):
    # Soft extruded silhouette in the front-facing Y/Z plane, with explicit thickness.
    v=[tuple(p) for p in pts]+[(p[0]-depth,p[1],p[2]) for p in pts];N=len(pts)
    f=[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)]
    o=mesh(n,v,f,m,par,0);mod=o.modifiers.new('edge rounding','BEVEL');mod.width=.004;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    for f in o.data.polygons:f.use_smooth=False
    return o
M['orange']=mat('corgiOrange','ec9b48',.72)
M['skinPatch']=mat('skinBlush','e49b8c',.8)
M['pink']=mat('corgiPink','e8839f',.74)
M['tongue']=mat('corgiTongue','ed5e79',.55)
M['stripe']=mat('woodWarm','b0703f',.8)
# Established palette materials, no additional texture or shader dependencies.
node('root',(0,0,0));node('hip',(-.42,0,.52),'root');node('body',(-.12,0,.53),'hip');node('torso',(.17,0,.52),'body')
node('neck',(.32,0,.54),'torso');node('head',(.43,0,.59),'neck');node('jaw',(.53,0,.435),'head');node('front',(.74,0,.55),'head')
node('tail',(-.57,0,.61),'hip');node('backpackSocket',(-.14,0,.75),'body')
ell('arched_body',(-.14,0,.55),(.49,.235,.255),'orange','body',seg=20,rings=12)
ell('haunch',(-.43,0,.49),(.23,.25,.23),'orange','hip',seg=16,rings=10)
ell('chest',(.20,0,.445),(.215,.21,.23),'picketWhite','torso',seg=16,rings=10)
ell('scruff',(.26,0,.57),(.20,.225,.19),'orange','neck',seg=16,rings=10)
# Thick leaf-shaped fur volumes. Individual clumps build the silhouette, never hair strands.
def lock(n,start,bend,tip,w,m,par):
    p,q,r=map(Vector,[start,bend,tip]);t=(r-p).normalized()
    normal=Vector((0,1 if p.y>0 else -1,0)) if abs(p.y)>.07 else Vector((0,0,1))
    across=t.cross(normal).normalized()
    v=[p-across*w*.72,p+across*w*.72,p+normal*w*.32,
       q-across*w*.65,q+across*w*.65,q+normal*w*.35,r]
    f=[(0,1,2),(0,3,4,1),(0,2,5,3),(2,1,4,5),(3,5,6),(5,4,6),(4,3,6)]
    o=mesh(n,v,f,m,par,0)
    mod=o.modifiers.new('fur soft edges','BEVEL');mod.width=.005;mod.segments=1
    bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
for j in range(7):
    x=.26-j*.12;z=.69+.13*math.sin(j*math.pi/10)
    for s in [-1,1]:
        lock('raised_spine'+str(j)+str(s),(x+.055,s*.038,z-.065),(x-.024,s*.058,z+.008),(x-.136,s*.10,z+.038+(j%3)*.013),.069,'stripe' if j%3==1 else 'orange','body')
for side,s in [('L',1),('R',-1)]:
    for row in [0,2]:
        for j in range(6):
            x=.23-j*.136+.014*math.sin(j*3+row);z=.63-row*.105+.08*math.sin(j*.43)+.016*math.cos(j*2+row)
            y=s*(.17+.023*row)
            lock('coat_'+side+str(row)+'_'+str(j),(x+.062,y*.87,z+.064),(x-.018,y*1.07,z),(x-.16,y*1.09,z-.13),.11,
                 'picketWhite' if row==2 else ('stripe' if j%3==1 else 'orange'),'body')
for name in ['arched_body','haunch']:
    o=bpy.data.objects[name]
    o.data.materials.append(M['stripe'])
    for face in o.data.polygons:
        c=o.matrix_world@face.center
        wave=c.x*30+math.sin(c.z*22)*.6
        if math.sin(wave)>.65:face.material_index=1
# Cat forelimbs and bent rear hocks. Character nodes are actual motion parents.
for side,s in [('L',1),('R',-1)]:
    for front in [True,False]:
        tag=('F' if front else 'B')+side
        upper=('arm' if front else 'leg')+side;lower=('foreArm' if front else 'shin')+side;foot=('hand' if front else 'foot')+side
        shoulder=(.22,s*.166,.47) if front else (-.43,s*.166,.46)
        knee=(.24,s*.225,.26) if front else (-.28,s*.23,.28)
        ankle=(.38,s*.258,.105) if front else (-.52,s*.264,.115)
        node(upper,shoulder,'torso' if front else 'hip');node('leg'+tag,shoulder,upper)
        node(lower,knee,'leg'+tag);node(foot,ankle,lower);node('paw'+tag,ankle,foot)
        tube('upper_'+tag,[shoulder,Vector(shoulder).lerp(Vector(knee),.4),knee],[.103,.112,.075],'orange','leg'+tag,N=12)
        tube('lower_'+tag,[knee,Vector(knee).lerp(Vector(ankle),.58),ankle],[.077,.065,.046],'picketWhite',lower,N=12)
        ell('paw_pad_'+tag,(ankle[0]+.025,ankle[1],.068),(.105,.093,.067),'picketWhite','paw'+tag,seg=12,rings=8)
        for j in range(4):
            y=ankle[1]+(j-1.5)*.045;x=ankle[0]+.095-.008*abs(j-1.5)
            ell('toe_'+tag+str(j),(x,y,.047),(.043,.027,.045),'picketWhite','paw'+tag)
            tube('claw_'+tag+str(j),[(x+.022,y,.049),(x+.047,y,.033),(x+.05,y,.006)],[.012,.009,.001],'uiDark','paw'+tag,N=8)
        for j in range(3):
            p=Vector(shoulder).lerp(Vector(knee),.20+j*.20)
            lock('leg_stripe_'+tag+str(j),(p.x+.063,p.y-s*.056,p.z+.015),(p.x+.084,p.y,p.z),(p.x+.046,p.y+s*.074,p.z-.035),.025,'stripe','leg'+tag)
# Raised curved tail with integral alternating bands.
tailpts=[(-.57,0,.62),(-.69,0,.59),(-.86,.018,.66),(-.95,.025,.81),(-.94,.02,.97),(-.84,.005,1.06),(-.72,-.01,1.07)]
tail=tube('curled_tail',tailpts,[.077,.072,.072,.068,.065,.06,.045],'orange','tail',N=12,sub=2)
tail.data.materials.append(M['stripe']);tail.data.materials.append(M['picketWhite'])
for f in tail.data.polygons:
    c=tail.matrix_world@f.center
    if c.z>1.045 and c.x>-.85:f.material_index=2
    elif int((c.z+c.x*.26)*42)%5<2:f.material_index=1
for j in range(4):
    lock('tail_tip'+str(j),(-.8,(j-1.5)*.017,1.04),(-.72,(j-1.5)*.022,1.085),(-.67,(j-1.5)*.025,1.03),.035,'picketWhite','tail')
# Broad low skull, strong muzzle and genuine open mouth cavity.
ell('skull',(.46,0,.625),(.215,.218,.185),'orange','head',seg=20,rings=14)
ell('chin',(.579,0,.403),(.099,.105,.037),'picketWhite','jaw',seg=16,rings=10)
ell('mouth_shadow',(.611,0,.473),(.064,.10,.09),'uiDark','head',seg=16,rings=12)
# Remove the intersecting skull at the mouth aperture.
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(.66,0,.48))
cutter=bpy.context.object;cutter.scale=(.12,.103,.105);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
obj=bpy.data.objects['skull'];bpy.context.view_layer.objects.active=obj
mod=obj.modifiers.new('hissing mouth opening','BOOLEAN');mod.object=cutter;mod.operation='DIFFERENCE';bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
for s in [-1,1]:
    ell('muzzle'+str(s),(.644,s*.063,.558),(.083,.082,.047),'picketWhite','head',seg=16,rings=10)
    ell('eye_socket'+str(s),(.601,s*.125,.641),(.020,.078,.067),'blood','head',rot=(0,0,s*.22),seg=16,rings=10)
    ell('eye_rim'+str(s),(.618,s*.125,.642),(.016,.067,.053),'uiDark','head',seg=16,rings=10)
    ell('red_eye'+str(s),(.633,s*.125,.643),(.018,.052,.043),'eye','head',seg=16,rings=10)
    ell('eye_hotspot'+str(s),(.650,s*.125,.65),(.004,.013,.018),'picketWhite','head',seg=10,rings=8)
    tube('brow'+str(s),[(.652,s*.058,.674),(.641,s*.115,.709),(.59,s*.185,.711)],[.027,.033,.016],'orange','head',N=10)
    lock('cheek'+str(s),(.53,s*.16,.57),(.55,s*.213,.555),(.62,s*.29,.52),.072,'orange','head')
    for j in range(3):
        lock('cream_ruff'+str(s)+str(j),(.44-j*.04,s*.17,.515-j*.01),(.43-j*.04,s*.224,.48-j*.014),(.39-j*.045,s*.25,.43-j*.02),.06,'picketWhite','head')
    # Three long whiskers each side, anchored above the mouth.
    for j in range(3):
        tube('whisker'+str(s)+str(j),[(.698,s*.09,.555-j*.013),(.70,s*.235,.566-j*.029),(.67,s*(.34+j*.015),.55-j*.043)],[.0028,.002,.0005],'picketWhite','head',N=5,sub=0)
        ell('whisker_pore'+str(s)+str(j),(.712,s*(.043+j*.025),.568-(j%2)*.013),(.0025,.0035,.0035),'uiDark','head',seg=8,rings=6)
# Triangular nose with soft corners and central philtrum.
patch('pink_nose',[(.723,-.037,.576),(.732,.037,.576),(.739,.0,.543)],'infectedSkin','head',.025)
tube('nose_line',[(.739,-.025,.569),(.744,0,.553),(.739,.025,.569)],[.006,.006,.005],'uiDark','head',N=6)
tube('philtrum',[(.727,0,.55),(.713,0,.534)],[.003,.002],'uiDark','head',N=6)
# Blood gums, pointed upper canines, tiny incisors and lower teeth.
for row in [0,1]:
    z=.532 if row==0 else .419;par='head' if row==0 else 'jaw'
    tube('gum'+str(row),[(.645,-.083,z),(.67,0,z-.004),(.645,.083,z)],[.014]*3,'blood',par,N=10)
    for j in range(6):
        y=(j-2.5)*.026;large=j in [0,5];length=.067 if large and row==0 else .026
        tube('tooth'+str(row)+str(j),[(.672,y,z),(.681,y,z+(-1 if row==0 else 1)*length*.65),(.678,y,z+(-1 if row==0 else 1)*length)],[.012 if large else .008,.008 if large else .005,.001],'picketWhite',par,N=8)
ell('tongue',(.668,0,.434),(.026,.038,.013),'tongue','jaw',seg=12,rings=8)
tube('tongue_center',[(.69,0,.438),(.671,0,.445)],[.002,.001],'blood','jaw',N=6)
# Tall ears with modeled torn notch on right. Extruded triangular shell and inset.
for s in [-1,1]:
    y=s*.155
    pts=[(.49,y-s*.067,.72),(.42,y+s*.105,.738),(.402,y+s*.095,.843),(.438,y+s*.06,.806),(.447,y+s*.045,.87),(.527,y-s*.01,.764)] if s==-1 else [(.49,y-s*.068,.725),(.39,y+s*.093,.747),(.431,y+s*.082,.883),(.526,y-s*.012,.765)]
    patch('ear_shell'+str(s),pts,'orange','head',.053)
    inner=[(.537,p[1]*.94,p[2]-.018) for p in pts]
    patch('ear_pink'+str(s),inner,'pink','head',.012)
    for j in range(3):
        lock('ear_tuft'+str(s)+str(j),(.54,y+s*(.014+j*.025),.757),(.559,y+s*(.025+j*.021),.77),(.579,y+s*(.037+j*.02),.736),.023,'picketWhite','head')
# Layered swept crown fur breaks up the skull outline without hiding the eyes.
for j in range(7):
    y=(j-3)*.042
    lock('crown_fur'+str(j),(.39,y*.85,.765),(.47,y,.803+(j%2)*.012),(.57,y*.92,.747),.048,'orange' if j%3 else 'stripe','head')
for s in [-1,1]:
    for j in range(4):
        lock('scruff_fur'+str(s)+str(j),(.33-j*.026,s*.15,.68-j*.023),(.28-j*.021,s*.218,.65-j*.031),(.19-j*.026,s*.25,.60-j*.04),.064,'orange','neck')
for j in range(5):
    y=(j-2)*.059
    lock('forehead_mark'+str(j),(.48,y,.795),(.571,y*.94,.767),(.628,y*.83,.72),.033,'stripe','head')
for s in [-1,1]:
    for j in range(3):
        lock('face_stripe'+str(s)+str(j),(.49-j*.024,s*.205,.662-j*.034),(.553-j*.023,s*.206,.641-j*.035),(.595-j*.026,s*.17,.615-j*.035),.023,'stripe','head')
# Skin patches are irregular raised islands with ragged fur edges, as in the reference.
def wound(n,p,rx,rz,s,par):
    x,y,z=p
    pts=[(x+rx*math.cos(i*math.tau/11)*(1 if i%2 else .72),y+s*.008,z+rz*math.sin(i*math.tau/11)*(1 if i%3 else .62)) for i in range(11)]
    # Y-facing extruded silhouette; thick enough to avoid coincident surfaces.
    v=pts+[(xx,yy-s*.016,zz) for xx,yy,zz in pts];N=len(pts)
    mesh(n,v,[tuple(range(N)),tuple(range(2*N-1,N-1,-1))]+[(i,(i+1)%N,(i+1)%N+N,i+N) for i in range(N)],'skinPatch',par,0)
    scar=[(x-rx*.40,y+s*.020,z+rz*.55),(x-rx*.04,y+s*.021,z+rz*.27),(x+rx*.21,y+s*.021,z+rz*.11),(x+rx*.13,y+s*.020,z-rz*.56),(x-rx*.10,y+s*.020,z-rz*.35),(x-rx*.23,y+s*.021,z-rz*.08),(x-rx*.17,y+s*.021,z+rz*.12)]
    mesh(n+'_ragged_scar',scar,[tuple(range(len(scar)))],'blood',par,0)
    mesh(n+'_dark_centre',[(x-rx*.11,y+s*.026,z+rz*.18),(x+rx*.06,y+s*.026,z+rz*.04),(x+rx*.02,y+s*.026,z-rz*.29),(x-rx*.09,y+s*.026,z-rz*.15)],[(0,1,2,3)],'uiDark',par,0)
    for j in range(4):
        t=j*math.tau/4+.27
        lock(n+'_rag'+str(j),(x+rx*math.cos(t),y,z+rz*math.sin(t)),(x+rx*.8*math.cos(t),y+s*.025,z+rz*.8*math.sin(t)),(x+rx*.56*math.cos(t),y+s*.028,z+rz*.5*math.sin(t)),.040,'orange',par)
for s in [-1,1]:
    wound('flank_wound'+str(s),(-.23,s*.270,.57),.12,.11,s,'body')
    wound('haunch_wound'+str(s),(-.47,s*.260,.45),.073,.095,s,'hip')
    wound('scruff_wound'+str(s),(.17,s*.209,.59),.049,.052,s,'neck')
    wound('foreleg_wound'+str(s),(.278,s*.27,.26),.025,.053,s,'foreArm'+('L' if s==1 else 'R'))
tube('chin_drip',[(.63,-.047,.415),(.635,-.05,.386),(.632,-.055,.355)],[.007,.005,.001],'blood','jaw',N=8)
# Proximal caps survive detached limbs. Zero scale is portable glTF hidden state.
capkeys=['head','armL','armR','foreArmL','foreArmR','legL','legR']
for key in capkeys:
    target=parts[key];parent=target.parent.name;p=target.matrix_world.translation.copy()
    size=(.058,.06,.016)
    if key.startswith('arm'):
        p.y+=(.055 if key.endswith('L') else -.055);size=(.063,.017,.065)
    o=ell('stump_'+key,p,size,'blood',parent,seg=8,rings=4,sub=0)
    o['hidden']=True;o['stumpFor']=key;o.scale=(0,0,0)
for key in ['legFL','legFR','legBL','legBR']:
    target=parts[key];o=ell('stump_'+key,target.matrix_world.translation,(.061,.06,.017),'blood',target.parent.parent.name,seg=8,rings=4,sub=0);o['hidden']=True;o['stumpFor']=key;o.scale=(0,0,0)
# Applied sculpt surfaces are simplified once for the infected hero budget.
for o in objects:
    if len(o.data.polygons)>80:
        bpy.context.view_layer.objects.active=o
        mod=o.modifiers.new('game density','DECIMATE');mod.ratio=.65
        bpy.ops.object.modifier_apply(modifier=mod.name)
# Triangulate and merge ornaments per material and rigid pivot, retaining stump names.
for o in objects:
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
# Boolean cutters can leave an empty material slot; collapse it to the surface material.
for o in objects:
    fallback=next(m for m in o.data.materials if m)
    materials=[m or fallback for m in o.data.materials]
    unique=list(dict.fromkeys(materials))
    indices=[unique.index(materials[f.material_index]) for f in o.data.polygons]
    o.data.materials.clear()
    for m in unique:o.data.materials.append(m)
    for f,i in zip(o.data.polygons,indices):f.material_index=i
buckets={};caps=[]
for o in objects:
    if o.name.startswith('stump_'):caps.append(o)
    else:buckets.setdefault((o.parent.name,tuple(m.name for m in o.data.materials)),[]).append(o)
joined=[]
for (parent,mats),group in buckets.items():
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join()
    o=group[0];o.name=parent+'__'+mats[0];joined.append(o)
objects=joined+caps
# Animals appear in groups: explicit 8k LOD0 ceiling, then 3k/1.3k crowd LODs.
# Keep every motion/cap node at all levels; simplify only its rigid geometry.
def reduce_mesh(o,ratio):
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('animal LOD density','DECIMATE');mod.ratio=max(.01,min(1,ratio))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces))
    tiny=[f for f in bm.faces if f.calc_area()<1e-10]
    if tiny:bmesh.ops.delete(bm,geom=tiny,context='FACES')
    bm.to_mesh(o.data);bm.free()
for o in caps:reduce_mesh(o,32/max(1,len(o.data.polygons)))
budget=[8000,3200,1500][a.lod];target=[7400,2900,1250][a.lod]
cap_count=sum(len(o.data.polygons) for o in caps)
ratio=(target-cap_count)/sum(len(o.data.polygons) for o in joined)
for o in joined:reduce_mesh(o,ratio)
assert sum(len(o.data.polygons) for o in objects)<=budget

# Put each planted paw exactly on the ground after smoothing.
bpy.context.view_layer.update()
for key in ['pawFL','pawFR','pawBL','pawBR']:
    meshes=[o for o in joined if o.parent==parts[key]]
    floor=min((o.matrix_world@v.co).z for o in meshes for v in o.data.vertices)
    parts[key].location.z-=floor
bpy.context.view_layer.update()
(P/('rig-rest.json' if a.lod==0 else f'rig-rest-lod{a.lod}.json')).write_text(json.dumps({
    'pivots':{n:list(o.matrix_world.translation) for n,o in parts.items()},
    'feet_min_z':min((o.matrix_world@v.co).z for o in joined if o.parent.name.startswith('paw') for v in o.data.vertices)
},indent=2))
required=['root','body','neck','head','jaw','tail','hip','torso','backpackSocket']+[k+s for k in ['arm','foreArm','hand','leg','shin','foot'] for s in ['L','R']]+[k+s for k in ['leg','paw'] for s in ['FL','FR','BL','BR']]+['stump_'+k for k in capkeys+['legFL','legFR','legBL','legBR']]
stats={'triangles':sum(len(o.data.polygons) for o in objects),'meshes':len(objects),'missing_nodes':[n for n in required if n not in bpy.data.objects]}
(P/('build-stats.json' if a.lod==0 else f'build-stats-lod{a.lod}.json')).write_text(json.dumps(stats,indent=2))
if a.glb:
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects+list(parts.values()):o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=a.glb,export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False)
def pose_test():
    parts['armL'].rotation_euler.y=-.55;parts['foreArmL'].rotation_euler.y=.8;parts['legR'].rotation_euler.y=.55
    # Show proximal cap on left front shoulder and remove that upper fur mass.
    cap=bpy.data.objects['stump_armL'];cap.scale=(1,1,1);cap['hidden']=False
    for o in objects:
        if o.parent==parts['legFL']:o.hide_render=True
    bpy.context.view_layer.update()
    (P/'pose-test.json').write_text(json.dumps({
        'rotations_radians':{n:list(parts[n].rotation_euler) for n in ['armL','foreArmL','legR']},
        'stump_armL_visible':list(cap.scale)==[1,1,1],
        'parents':{n:parts[n].parent.name for n in ['armL','foreArmL','legR']}
    },indent=2))
if a.pose:pose_test()
if a.render:
    world=bpy.data.worlds.new('studio');world.use_nodes=True;S.world=world;world.node_tree.nodes['Background'].inputs[0].default_value=(.11,.095,.14,1);world.node_tree.nodes['Background'].inputs[1].default_value=.45
    bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='studio_ground';floor.data.materials.append(M['uiDark'])
    def area(n,p,power,col,size):
        bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.color=col;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,.45))-o.location).to_track_quat('-Z','Y').to_euler()
    area('warm_key',(2,-3,4),380,(1,.80,.61),4);area('cool_fill',(1,3,2.5),240,(.61,.72,1),3);area('gold_rim',(-3,.5,3),430,(1,.57,.25),2.5)
    cameras={'hero':(3,-4,2.25),'front':(4,0,1.3),'side':(0,-4,1.2),'back':(-4,0,1.3)}
    pos=cameras.get(a.view,cameras['hero']);bpy.ops.object.camera_add(location=pos);cam=bpy.context.object;cam.rotation_euler=(Vector((-.06,0,.52))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8;S.camera=cam
    S.render.engine='CYCLES';S.cycles.samples=a.samples;S.cycles.use_denoising=True;S.render.resolution_x=a.width;S.render.resolution_y=a.height;S.render.resolution_percentage=100
    S.view_settings.view_transform='AgX';S.view_settings.look='AgX - Medium High Contrast';S.render.image_settings.file_format='PNG';S.render.filepath=a.render
    render_views=['hero','pose-test'] if a.view=='final-set' else ['front','side','back','hero'] if Path(a.render).stem.startswith('round') or a.view=='review-set' else [a.view]
    for view in render_views:
        if view=='pose-test':
            pose_test();S.cycles.samples=24;S.render.resolution_x=960;S.render.resolution_y=540
        cam.location=(3,4,2.25) if view=='pose-test' or a.pose else cameras.get(view,cameras['hero'])
        cam.rotation_euler=(Vector((-.06,0,.52))-cam.location).to_track_quat('-Z','Y').to_euler()
        S.render.filepath=str(Path(a.render).with_name(Path(a.render).stem+'-'+view+'.png')) if len(render_views)>1 else a.render
        if a.view=='final-set':S.render.filepath=str(P/'renders'/(view+'.png'))
        bpy.ops.render.render(write_still=True)
    if a.view=='final-set':save_turnaround(str(P/'renders'/'turnaround.png'))
print('OK',json.dumps(stats))
