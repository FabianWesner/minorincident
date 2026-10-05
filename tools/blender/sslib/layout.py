"""Hybrid district export: unique meshes merged by palette, prop references as empties.
Placement/assembly pattern adapted from Bruno Simon folio-2025 (MIT).
"""
import bpy
import hashlib
import json
import math
from pathlib import Path

COLORS = {'grass': '#7f9f42', 'asphalt': '#454552', 'sidewalk': '#e3be8a', 'woodWarm': '#aa7047', 'picketWhite': '#f2e6dc', 'brick': '#a8483a', 'survivorRed': '#d9363e', 'backpackTeal': '#2f6e6a', 'schoolBusYellow': '#f2b630', 'policeBlue': '#2f6bff', 'uiDark': '#25222c', 'blood': '#b3121f', 'windowGlow': '#ffc773'}

def material(token):
    name = 'pal_' + token
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    h = COLORS[token].lstrip('#')
    m.diffuse_color = tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4)) + (1,)
    return m

def box(name, token, size, pos):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(pos[0], -pos[2], pos[1]))
    o = bpy.context.object
    o.name = name
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material(token))
    bevel = o.modifiers.new('toy_edges', 'BEVEL'); bevel.width = min(0.07, min(size) * 0.15); bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return o

def empty(name, pos, yaw=0, scale=(1,1,1)):
    o = bpy.data.objects.new(name, None); bpy.context.collection.objects.link(o)
    o.location = (pos[0], -pos[2], pos[1]); o.rotation_euler.z = -yaw; o.scale = (scale[0], scale[2], scale[1])
    return o

class Layout:
    def __init__(self, district, title):
        bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
        self.root = Path(__file__).resolve().parents[3]
        self.manifest = json.loads((self.root / 'src/assets/manifest.json').read_text())
        self.layers = [[] for _ in range(6)]
        self.empties = []
        self.data = dict(version=1, district=district, title=title, bounds=[[-28,-28],[28,-28],[28,28],[-28,28],[-28,-28]], roads={'nodes': [], 'edges': []}, placements=[], anchors={}, buildings=[], colliders=[], lawns=[], walkable={'cellSize': 1, 'excluded': []}, lightGroups=[], acousticZones=[], surfaces=[], layers=[dict(tier=i, remove=[], disableLights=[]) for i in range(1,6)])
        self.box('bedrock', 'woodWarm', [56,1,56], [0,-0.65,0])
        self.box('terrain', 'grass', [56,0.25,56], [0,-0.13,0])
        self.data['surfaces'].append(dict(surface='grass', polygon=self.data['bounds']))
        self.road_cross()
        for name, p in {'player-start': [0,0,4], 'arrival': [0,0,24], 'exit': [0,0,-24], 'safe-point': [5,0,5], 'cat-perch': [-18,3,-19], 'crow-roost': [20,4,-20]}.items(): self.anchor(name,p)
        for i, (x,z) in enumerate([(-23,-23),(23,-23),(-23,23),(23,23)]):
            self.data['lawns'].append(dict(min=[x-3,z-3], max=[x+3,z+3]))
            for dx,dz in [(0,0),(2,0),(0,2)]: self.place('prop.tree', [x+dx,0,z+dz])
            self.place('prop.hedge', [x-2,0,z])
        for z in range(-20,21,8):
            for x in [-5,5]: self.place('prop.street-lamp', [x,0,z]); self.place('prop.picket-fence', [x*1.6,0,z])
        for x,z in [(-6,-6),(6,6),(-6,6),(6,-6)]: self.place('prop.traffic-cone', [x,0,z])
        for x,z in [(10,-6),(-10,6),(20,-6),(-20,6)]: self.place('veh.sedan-red', [x,0,z])
        for block in range(4): self.data['lightGroups'].append(dict(id=f'block-{block}', offAt=3 if block%2==0 else 5))
        self.data['acousticZones'].append(dict(id='outdoor', preset='suburban-outdoor', polygon=self.data['bounds']))
        for tier in range(1,6):
            self.place('veh.wreck', [(-1 if tier%2 else 1)*3,0,-22+tier*7], tier=tier, allowed=True)
            for j in range(tier): self.box(f'rubble-{tier}-{j}', 'brick' if tier<4 else 'uiDark', [0.8+j*.25,.3+j*.1,.6], [-9+j, .2, -8+tier*4], tier)
            if tier>=2: self.box(f'blood-{tier}', 'blood', [2+ tier*.3,.015,1.3], [6, .08, -20+tier*6], tier)
            if tier>=3:
                self.box(f'char-{tier}', 'uiDark', [2,.03,2], [14,.1,-8+tier], tier)
                self.box(f'board-{tier}', 'woodWarm', [3,.25,.2], [-14,1.5,9.9], tier)
        self.box('collapse-canopy', 'schoolBusYellow', [5,.2,2], [14,3,-8])
        self.data['layers'][4]['remove'].append('collapse-canopy')
        self.data['layers'][2]['disableLights'] = ['block-0','block-2']
        self.data['layers'][4]['disableLights'] = ['block-1','block-3']

    def road_cross(self):
        nodes = [dict(id='center', point=[0,0]),dict(id='north',point=[0,-28]),dict(id='south',point=[0,28]),dict(id='west',point=[-28,0]),dict(id='east',point=[28,0])]
        self.data['roads']['nodes'] = nodes
        for n in nodes[1:]: self.data['roads']['edges'].append(dict(id=n['id'], start='center', end=n['id'], points=[[0,0],n['point']], laneWidth=7))
        for axis in [0,2]:
            s=[7,.08,56]; s[axis]=56; s[2-axis]=7
            self.box('road-'+str(axis), 'asphalt', s, [0,.01,0])
            for side in [-4.2,4.2]:
                sz=[1.4,.18,56]; sz[axis]=56; sz[2-axis]=1.4
                p=[0,.04,0]; p[2-axis]=side; self.box('curb', 'sidewalk', sz,p)
            for v in range(-24,25,4):
                if abs(v)<6: continue
                p=[0,.065,0]; p[axis]=v; sz=[.15,.018,.15]; sz[axis]=1.8
                self.box('lane-mark', 'picketWhite',sz,p)
            for v in [-6,6]:
                for k in range(-3,4):
                    p=[0,.066,0]; p[axis]=v; p[2-axis]=k; sz=[.65,.018,.65]; sz[axis]=1.1
                    self.box('crosswalk','picketWhite',sz,p)
        self.data['surfaces'] += [dict(surface='asphalt', polygon=[[-3.5,-28],[3.5,-28],[3.5,28],[-3.5,28],[-3.5,-28]]),dict(surface='asphalt', polygon=[[-28,-3.5],[28,-3.5],[28,3.5],[-28,3.5],[-28,-3.5]])]

    def box(self,name,token,size,pos,tier=0):
        o=box(name,token,size,pos); self.layers[tier].append(o); return o
    def anchor(self,name,pos):
        self.data['anchors'][name]=dict(position=pos,yaw=0)
        self.empties.append(empty('anchor:'+name,pos))
    def place(self,asset,pos,yaw=0,tier=0,allowed=False,scale=(1,1,1)):
        id=f'{asset}:{len(self.data["placements"])}'
        m=self.manifest[asset]; dims=[m['dimensions'][a]*scale[i] for i,a in enumerate(['x','y','z'])]
        sx=abs(math.cos(yaw))*dims[0]+abs(math.sin(yaw))*dims[2]; sz=abs(math.sin(yaw))*dims[0]+abs(math.cos(yaw))*dims[2]
        aabb=dict(min=[pos[0]-sx/2,pos[1],pos[2]-sz/2],max=[pos[0]+sx/2,pos[1]+dims[1],pos[2]+sz/2])
        p=dict(id=id,assetId=asset,position=pos,yaw=yaw,scale=list(scale),minTier=tier,maxTier=5,allowRoad=allowed,visualAabb=aabb)
        self.data['placements'].append(p)
        o=empty('inst:'+asset+':'+str(len(self.data['placements'])),pos,yaw,scale); o['assetId']=asset; o['minTier']=tier; o['maxTier']=5; self.empties.append(o)
        if m.get('solid'): self.data['colliders'].append(dict(id=id,aabb=aabb,minTier=tier,maxTier=5))
        return id
    def building(self,asset,x,z,door,title):
        id=self.place(asset,[x,0,z]); aabb=self.data['placements'][-1]['visualAabb']
        self.data['buildings'].append(dict(id=id,assetId=asset,aabb=aabb,label=title))
        self.anchor(door,[x,0,z+ (aabb['max'][2]-z)+1])
        self.data['acousticZones'].append(dict(id=id,preset='small-room',polygon=[[aabb['min'][0],aabb['min'][2]],[aabb['max'][0],aabb['min'][2]],[aabb['max'][0],aabb['max'][2]],[aabb['min'][0],aabb['max'][2]],[aabb['min'][0],aabb['min'][2]]]))
        self.data['surfaces'].append(dict(surface='tile',polygon=self.data['acousticZones'][-1]['polygon']))

    def export(self):
        out=self.root/'public/assets/layouts'; out.mkdir(parents=True,exist_ok=True)
        # Hash geometry in game-independent Blender coordinates before merging; exclude timestamps.
        canonical=[]
        for tier,objects in enumerate(self.layers):
            for o in objects:
                canonical.append([tier,o.name,o.data.materials[0].name,[list(v.co) for v in o.data.vertices],list(o.location)])
        self.data['geometryHash']=hashlib.sha256(json.dumps(canonical,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        for tier,objects in enumerate(self.layers):
            removable=set(sum([l['remove'] for l in self.data['layers']],[]))
            groups={}
            for o in objects:
                key=o.name if o.name in removable else o.data.materials[0].name
                groups.setdefault(key,[]).append(o)
            merged=[]
            for name,parts in groups.items():
                bpy.ops.object.select_all(action='DESELECT')
                for p in parts: p.select_set(True)
                bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join()
                parts[0].name=name; merged.append(parts[0])
            bpy.ops.object.select_all(action='DESELECT')
            for o in merged + (self.empties if tier==0 else []): o.select_set(True)
            suffix='base' if tier==0 else f'w{tier}'
            bpy.ops.export_scene.gltf(filepath=str(out/f'{self.data["district"]}.{suffix}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
        (out/f'{self.data["district"]}.layout.json').write_text(json.dumps(self.data,sort_keys=True,indent=2)+'\n')
