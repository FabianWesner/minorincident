"""Commerce W2/W3: native source recipes, fixed anchors, solid authored tiers.
All batching is scoped to doors, roof and interior. No decimation or AABB fit.
"""
import json
import math
import runpy
import shutil
import struct
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector
from . import palette, primitives as P, export, sockets, colliders, ao


def consume_arguments(distance=0):
    if '--distance-tier' in sys.argv:
        i=sys.argv.index('--distance-tier');distance=int(sys.argv[i+1]);del sys.argv[i:i+2]
    if '--commerce-tier' in sys.argv:
        i=sys.argv.index('--commerce-tier');tier=int(sys.argv[i+1]);del sys.argv[i:i+2]
        i=sys.argv.index('--commerce-decay');decay=sys.argv[i+1];del sys.argv[i:i+2]
        i=sys.argv.index('--glb');output=sys.argv[i+1]
        return dict(dispatch=False,tier=tier,decay=decay,output=output)
    if '--decay' in sys.argv:
        i=sys.argv.index('--decay');decay=sys.argv[i+1]
        if decay not in ('w2','w3'):raise ValueError(decay)
        return dict(dispatch=True,decay=decay,output=sys.argv[sys.argv.index('--glb')+1],tierOnly=distance or None)
    return None


def build_variants(source, decay, output, tier=None):
    source=Path(source);argv=list(sys.argv)
    tiers=(0,1,2) if tier is None else (tier,)
    for tier in tiers:
        destination=source.parent/('model.'+decay+('' if tier==0 else '.lod'+str(tier))+'.glb')
        sys.argv=[str(source),'--','--commerce-tier',str(tier),'--commerce-decay',decay,'--glb',str(destination)]
        try:runpy.run_path(str(source),run_name='__main__')
        except SystemExit as error:
            if error.code not in (0,None):raise
    sys.argv=argv
    delivered=source.parent/('model.'+decay+('' if tiers[0]==0 else '.lod'+str(tiers[0]))+'.glb')
    if Path(output).resolve()!=delivered.resolve():shutil.copyfile(delivered,output)


def bounds(objects):
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in objects if o.type=='MESH' for v in o.data.vertices]
    return Vector(tuple(min(v[k] for v in points) for k in range(3))),Vector(tuple(max(v[k] for v in points) for k in range(3)))


def finish_native(source, options):
    asset=source.parent.name;tier=options['tier'];decay=options['decay']
    native=list(bpy.context.scene.objects)
    root=next(o for o in native if o.name=='root')
    # Remove explicit decoration recipes. Windows/doors/roof/wall solids survive.
    omit=['face_brick','side_brick','pier_course','roof_membrane_seam','chimney_course','masonry','rear_course','wall_chip','sign_patina','roof_wear','sack_seam','sack_brand','sack_stripe','unit_bolt','lid_rim','top_louver','fan_blade','fan_ring','fan_hub','leaf','flower','window_pot','window_plant','cupcake','bread','loaf','medicine','bottle_cap','display_shelf','pharmacy_shelf','stock','paint_tin','tin_','carton_','floor_tile','checker_tile','utensil','plate','stool','chair','table','booth','counter','fan_grille','hvac_bolt','sign_bolt']
    if tier>=1:omit+=['paver','paving','coping_stone','front_kerb','side_kerb','quoin','lamp_arm','cart_rail','service_conduit','box_access','rear_mullion','vent_louvre','vent_louver','louver','access_inset','side_access','unit_side','access_panel']
    if tier==2:omit+=['raised_TOOLS','slogan_lettering','badge','chalk','open_lettering','sign_border','sign_garden','window_mullion','rear_jamb','hinge','pull','utility','duct_band','sill_joint','wall_joint','pastry','scallop','condenser_pipe','top_grille','lid','seam','rim','sack_end','fan_','hvac_access','vent_black','bottle','electrical_box','box_access','rear_sill','window_plant','front_brick','checker','coffee','urn_','pendant','napkin','menu','cove','lettering','cornice_neon','planter_brick','pipe_clamp','hvac_recess','hvac_vent','hvac_louver','mural_bolt','shade_lip','access_screw','sign_fastener']
    for obj in list(native):
        interior=obj.parent and obj.parent.name=='interior' and obj.name!='floor' and obj.name!='interior_floor'
        if obj.type=='MESH' and (interior or any(word.lower() in obj.name.lower() for word in omit)):
            bpy.data.objects.remove(obj,do_unlink=True);native.remove(obj)
    # Copy the integrated base's semantic empties and exact matrices, not fitted geometry.
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source.parent/'model.glb'))
    reference=list(set(bpy.context.scene.objects)-before)
    # Original scripts center by the complete detailed silhouette. Translation only.
    rlow,rhigh=bounds(reference)
    anchor='col:building' if asset=='bld.mainstreet-brick' else 'door_front'
    original=next(o for o in native if o.name==anchor)
    matching=next(o for o in reference if o.name.removesuffix('.001')==anchor)
    shift=matching.matrix_world.translation-original.matrix_world.translation
    for obj in native:
        if obj.parent is None:obj.location+=shift
    bpy.context.view_layer.update()
    # Fuse the ground slab into a closed convex pavement silhouette; preserve metres.
    floorpoints=[obj.matrix_world@v.co for obj in reference if obj.type=='MESH' for v in obj.data.vertices if (obj.matrix_world@v.co).z<=.405]
    points=sorted(set((round(v.x,5),round(v.y,5)) for v in floorpoints))
    def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def half(points):
        result=[]
        for v in points:
            while len(result)>1 and cross(result[-2],result[-1],v)<=0:result.pop()
            result.append(v)
        return result
    for obj in list(native):
        if obj.type=='MESH' and max((obj.matrix_world@v.co).z for v in obj.data.vertices)<=.405:
            bpy.data.objects.remove(obj,do_unlink=True);native.remove(obj)
    if asset=='bld.mainstreet-brick':
        # Fuse paver seams into the original four closed pavement strips.
        for position,size in [((0,0,.17),(5.8,8.2,.34)),((0,-4.35,.20),(6.726,.75,.40)),((0,4.35,.20),(6.726,.75,.40)),((3.28,0,.20),(1.03,8.116,.40))]:
            pavement=P.rounded_box('baseFootprint',size,palette.mat('sidewalk'),Vector(position)+shift,0)
            pavement.modifiers.remove(pavement.modifiers['bevel']);pavement.parent=root
    else:
        groups=[points]
        if asset=='bld.joes-diner':
            # Separate forecourt and sign bed; never fill the triangular gap between them.
            cutoff=-4.56+shift.y
            main=[p for p in points if p[1]>=cutoff];sign=[p for p in points if p[1]<cutoff]
            top=min(p[1] for p in main)+.02
            sign.extend([(min(p[0] for p in sign),top),(max(p[0] for p in sign),top)])
            groups=[main,sorted(set(sign))]
        for group in groups:
            hull=half(group)[:-1]+half(list(reversed(group)))[:-1];n=len(hull)
            data=bpy.data.meshes.new('baseFootprint');data.from_pydata([(x,y,z) for z in (rlow.z,.20) for x,y in hull],[],[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)])
            data.materials.append(palette.mat('sidewalk'));pavement=bpy.data.objects.new('baseFootprint',data);bpy.context.collection.objects.link(pavement);pavement.parent=root
    # Blender adds numeric suffixes while the original objects occupy their names.
    data=(source.parent/'model.glb').read_bytes();length=struct.unpack_from('<I',data,12)[0]
    source_names={n.get('name','') for n in json.loads(data[20:20+length])['nodes']}
    anchors={}
    for obj in reference:
        if obj.type!='EMPTY':continue
        name=obj.name if obj.name in source_names else obj.name.removesuffix('.001')
        if name in source_names:anchors[name]=obj
    copied=[]
    for obj in list(native):
        if obj.type=='EMPTY' and obj.name in anchors:
            matrix=anchors[obj.name].matrix_world.copy()
            children=[(child,child.matrix_world.copy()) for child in obj.children]
            obj.matrix_world=matrix
            for child,world in children:child.matrix_world=world
            for key in anchors[obj.name].keys():obj[key]=anchors[obj.name][key]
    for name,obj in anchors.items():
        if not any(n.name==name for n in native):
            node=sockets.empty(name,parent=root);node.matrix_world=obj.matrix_world.copy()
            for key in obj.keys():node[key]=obj[key]
            native.append(node);copied.append((node,name))
    for obj in reference:bpy.data.objects.remove(obj,do_unlink=True)
    for node,name in copied:node.name=name
    # Solid low silhouette is authored in native coordinates, without rescaling.
    def box(name,pos,size,token='uiDark',parent=None,angle=0):
        obj=P.rounded_box(name,size,palette.mat(token),Vector(pos)+shift,.018 if tier==0 else 0)
        if tier:obj.modifiers.remove(obj.modifiers['bevel'])
        obj.parent=parent or root;obj.rotation_euler.x=angle;return obj
    def jagged(name,x,y,z,w,h,parent=None):
        # Closed deep dark recess with an irregular surviving glass edge.
        box(name+'Void',(x,y,z),(.026,w,h),'uiDark',parent)
        count=5 if tier==0 else 3 if tier==1 else 2
        for i in range(count):
            yy=y-w/2+(i+.5)*w/count
            zz=z+h/2;span=w/count*.9;drop=.13+(i%3)*.10
            verts=[Vector((xx,yy+dy,zz+dz))+shift for xx in (x+.025,x+.045) for dy,dz in [(-span/2,0),(span/2,0),(-span*.12,-drop)]]
            me=bpy.data.meshes.new(name+'Shard');me.from_pydata(verts,[],[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]);me.materials.append(palette.mat('sidewalk'))
            ob=bpy.data.objects.new(me.name,me);bpy.context.collection.objects.link(ob);ob.parent=parent or root
    if asset=='bld.mainstreet-brick':
        panes=[(3.29,-2.44,1.77,1.95,2.08),(3.03,2.4,1.85,1.94,2.08)]
        upper=[(3.04,y,5.35,.75,1.72) for y in (-2.95,-1.15,1.68,3.02)]
        wallx=2.91;trimz=3.49
    elif asset=='bld.joes-diner':
        panes=[(2.80,-2.4,1.88,1.38,1.48),(2.80,1.65,1.88,2.5,1.48)]
        upper=[];wallx=2.82;trimz=3.32
    else:
        panes=[(3.03,-1.57,1.98,2.27,1.70),(3.03,2.04,1.98,2.83,1.70)]
        upper=[];wallx=2.87;trimz=3.37
    for i,(x,y,z,w,h) in enumerate(panes):
        if decay=='w3' or i==0:jagged('brokenShop'+str(i),x,y,z,w,h)
        if decay=='w2':
            for angle in (-.48,.48):box('diagonalBoard',(x+.095,y,z-.28),(.10,w*1.06,.28),'sidewalk',angle=angle)
        else:
            # Local soot around the opening; broad asymmetric chunks read at 120px.
            for yy,zz,ww,hh in [(y-w*.44,z+h*.47,w*.30,.58),(y+w*.43,z+h*.15,w*.25,h*.72),(y,z+h*.60,w*.62,.27)]:
                box('localSoot',(wallx+.16,yy,zz),(.04,ww,hh))
            box('damagedTrim',(wallx+.19,y,trimz),(.05,w*.42,.13),'uiDark',angle=.12)
    if decay=='w2' and asset=='bld.mainstreet-brick':
        # Upper window bracing remains clear above the deep bakery awning at 120px.
        for x,y,z,w,h in upper[:2]:
            for angle in (-.98,.98):box('upperCrossboard',(x+.12,y,z),(.08,1.72,.19),'sidewalk',angle=angle)
    if decay=='w3':
        for i,p in enumerate(upper):jagged('brokenUpper'+str(i),*p)
    else:
        for i,(x,y,z,w,h) in enumerate(panes):
            box('entranceClutter',(min(x+.20,rhigh.x-shift.x-.24),y+w*.32,.59),(.40,.52,.38),'woodWarm',angle=.15*i)
    # Reset inherited custom RGB values to the shared palette.
    for mat in list(bpy.data.materials):
        if mat.name.startswith(('pal_', 'emi_')):mat.name += '_source'
    # Rebind every part to the common palette, reducing static assembly primitives.
    # Roof/interior/door material allowances are reserved before root batching.
    protected={'roof','interior'} | {o.name for o in root.children_recursive if o.type=='EMPTY' and o.name.startswith('door_')}
    for obj in list(root.children_recursive):
        if obj.type!='MESH':continue
        owner=obj.parent
        while owner!=root and owner.name not in protected:owner=owner.parent
        for i,mat in enumerate(obj.data.materials):
            token=mat.name.removeprefix('pal_').removeprefix('emi_').split('.')[0].removesuffix('_source')
            if owner.name=='roof':token='sidewalk' if asset!='bld.mainstreet-brick' and (token in ('picketWhite','sidewalk') or obj.name in ('joes_neon','diner_neon')) else 'asphalt'
            elif owner.name=='interior' or owner.name.startswith('door_'):token='uiDark'
            elif token in ('uiDark','asphalt','backpackTeal','grass'):token='uiDark'
            elif token in ('sidewalk','picketWhite'):token='sidewalk'
            elif token in ('woodWarm','windowGlow','schoolBusYellow','foliage'):token='woodWarm'
            else:token='brick' if asset!='bld.joes-diner' else 'survivorRed'
            if asset=='bld.joes-diner' and owner==root and token=='woodWarm':token='survivorRed'
            obj.data.materials[i]=palette.mat(token)
    # Broken power supply: retain light/socket empties, remove emitting records.
    for obj in root.children_recursive:
        if 'ss_light' in obj:del obj['ss_light']
    root['ss_physics']=json.dumps({'class':'fixed','mass':0,'friction':.8,'restitution':0,'centerOfMass':[0,(rhigh.z-rlow.z)/2,0],'pushable':False,'kickable':False,'flammable':False,'sounds':'prop.metal-heavy'})
    root['decay']=decay;root['asset_id']=asset
    # Coplanar font tessellation dissolves without changing authored outlines.
    for obj in root.children_recursive:
        if obj.type=='MESH':
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.dissolve_limit(bm,angle_limit=.001,verts=list(bm.verts),edges=list(bm.edges),use_dissolve_boundaries=False,delimit={'MATERIAL'})
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free()
    if tier==2:
        detail=[]
        for obj in root.children_recursive:
            if obj.type=='MESH':obj.data.calc_loop_triangles();detail.append((len(obj.data.loop_triangles),obj.name))
        print('DISTANCE COMPONENTS',sorted(detail,reverse=True)[:20],flush=True)
    export.merge_by_material(root,protected)
    meshes=[o for o in root.children_recursive if o.type=='MESH']
    # Cheap deterministic AO using the same shared bake as rescue assets.
    ao.bake_all(meshes,16)
    for obj in meshes:
        for value in obj.data.color_attributes['ao'].data:
            shade=max(.65,value.color[0]);value.color=(shade,shade,shade,1)
    triangles=0
    for obj in meshes:obj.data.calc_loop_triangles();triangles+=len(obj.data.loop_triangles)
    cap=(30000,12000,4000)[tier]
    if triangles>cap or len(meshes)>8:raise ValueError(f'{asset}.{decay} LOD{tier}: {triangles} triangles, {len(meshes)} draws')
    export.glb(root,options['output'])
    path=source.parent/(decay+'-stats.json');stats=json.loads(path.read_text()) if path.exists() else {}
    low,high=bounds(meshes)
    stats['lod'+str(tier)]={'triangles':triangles,'draws':len(meshes),'materials':len({m.name for o in meshes for m in o.data.materials}),'bounds':[list(low),list(high)],'bytes':Path(options['output']).stat().st_size}
    path.write_text(json.dumps(stats,indent=2)+'\n')
