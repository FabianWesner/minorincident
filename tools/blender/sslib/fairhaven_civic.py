"""Fairhaven intact landmarks. Explicit solid recipes at each distance tier.
Fixed local footprints and semantic owners are also the W5 derivation contract.
"""
import argparse
import json
import math
import shutil
from pathlib import Path
import bpy
import bmesh
from .rescue_assets import Scene
from . import sockets, colliders, export, ao, palette

DIMS = {
    'bld.apartment-block-a': (10.3, 12.85, 12.6),
    'bld.apartment-block-b': (9.96, 15.95, 12.6),
    'bld.town-hall': (12.08, 12.4, 16.0),
    'bld.church': (18.0, 13.8, 10.65),
}

class Civic(Scene):
    def __init__(self, asset, lod):
        super().__init__(asset, lod)
        self.roof = self.joint('roof')
        self.interior = self.joint('interior')
        self.door = self.joint('door_front', (4.25 if 'apartment' in asset else 4.65 if asset.endswith('town-hall') else 7.8, -.6, .25))
        self.door['animated'] = True
        sockets.empty('front', ({'bld.apartment-block-a':5.5,'bld.apartment-block-b':5.16,'bld.town-hall':6.93,'bld.church':9}[asset], 0, 1), self.root)
        sockets.empty('doorway', (self.door.location.x+.25, 0, .25), self.root)
        sockets.empty('nav_entry', (DIMS[asset][0]/2, 0, .25), self.root)
        sockets.empty('roof_cutaway', (0, 0, DIMS[asset][1]*.7), self.root)
        sockets.empty('stairwell', (2.5, 0, .35), self.root)
        self.physics()
        self.root['footprint'] = [DIMS[asset][0], DIMS[asset][2]]
        self.root['foundationFootprint'] = [9.6 if 'apartment' in asset else 10 if asset.endswith('town-hall') else 18, 10.6 if asset.endswith('church') else DIMS[asset][2]]
        self.root['forward'] = '+X'
    def box(self, name, pos, size, token='picketWhite', parent=None, angle=0):
        obj = super().box(name, pos, size, token, parent, angle)
        # Retain bevels on structural corners; fine detail stays closed and cheap.
        if max(size)<2 or min(size)<.09:
            mod = obj.modifiers.get('bevel')
            if mod: obj.modifiers.remove(mod)
        return obj
    def prism(self, name, yz, x0, x1, token, parent=None):
        n=len(yz)
        obj=self.mesh(name, [(x,y,z) for x in (x0,x1) for y,z in yz],
                      [tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)],token)
        obj.parent=parent or self.body
        return obj
    def lit(self, obj, glow=True):
        if glow:
            obj.data.materials.clear();obj.data.materials.append(palette.mat('windowGlow',True))
        return obj
    def window(self, x, y, z, w=1.0, h=1.6, side=False, arch=False, glow=False, far=False):
        def piece(name, a,b,c, sx,sy,sz, token):
            a=x+(a-x)*(1 if x>0 else -1)
            return self.box(name,(b,a,c) if side else (a,b,c),(sy,sx,sz) if side else (sx,sy,sz),token)
        if far and self.lod>=1:
            # Faces turned away from the fixed isometric camera keep only the glazing.
            self.lit(piece('glazing',x,y,z,.10,w,h,'blueTrim'),glow)
            return
        if self.lod==2 and not arch:
            self.lit(piece('glazing',x,y,z,.10,w,h,'blueTrim'),glow)
            outer=[(y-w/2-.12,z-h/2-.12),(y+w/2+.12,z-h/2-.12),(y+w/2+.12,z+h/2+.12),(y-w/2-.12,z+h/2+.12)]
            inner=[(y-w/2,z-h/2),(y+w/2,z-h/2),(y+w/2,z+h/2),(y-w/2,z+h/2)]
            vs=[(x+off,yy,zz) for off in (0,.16) for yy,zz in outer+inner]
            fs=[]
            for i in range(4):
                j=(i+1)%4
                fs.extend([(i,j,j+4,i+4),(i+8,i+12,j+12,j+8),(i,i+8,j+8,j),(i+4,j+4,j+12,i+12)])
            o=self.mesh('distanceWindowBorder',vs,fs,'backpackTeal' if self.asset.endswith('-b') else 'picketWhite')
            for v in o.data.vertices:
                if x<0:v.co.x=x-(v.co.x-x)
                if side:v.co.x,v.co.y=v.co.y,v.co.x
            return
        if arch:
            seg=[12,8,6][self.lod]
            r=w/2; spring=z+h/2-r
            def finish(o):
                # Mirror so the trim always stands proud of the wall on negative faces.
                if x<0:
                    for v in o.data.vertices:v.co.x=2*x-v.co.x
                if side:
                    # Rotate the +X-facing profile onto the long nave side.
                    for v in o.data.vertices: v.co.x,v.co.y=v.co.y,v.co.x
            profile=[(y-r,z-h/2),(y+r,z-h/2)]+[(y+math.cos(i*math.pi/seg)*r,spring+math.sin(i*math.pi/seg)*r) for i in range(seg+1)]
            o=self.prism('archedGlazing',profile,x-.07,x+.025,'blueTrim')
            self.lit(o,glow);finish(o)
            for i in range(seg):
                a=math.pi*i/seg; b=math.pi*(i+1)/seg
                yz=[(y+math.cos(t)*rr,spring+math.sin(t)*rr) for rr,t in ((r,a),(r,b),(r+.16,b),(r+.16,a))]
                o=self.prism('archStone',yz,x-.01,x+.17,'picketWhite')
                finish(o)
        else:
            self.lit(piece('glazing',x,y,z,.10,w,h,'blueTrim'),glow)
            piece('windowHead',x+.09,y,z+h/2+.08,.23,w+.3,.16,'picketWhite')
        for sign in (-1,1):piece('windowJamb',x+.07,y+sign*(w/2+.06),z,.18,.12,h,'backpackTeal' if 'apartment' in self.asset else 'picketWhite')
        piece('windowSill',x+.11,y,z-h/2-.08,.30,w+.30,.16,'picketWhite')
        if self.lod<2:
            piece('windowMullion',x+.075,y,z,.04,.055,h,'backpackTeal' if 'apartment' in self.asset else 'woodWarm' if self.asset.endswith('church') else 'uiDark')
            piece('windowCrossbar',x+.075,y,z,.04,w,.055,'backpackTeal' if 'apartment' in self.asset else 'woodWarm' if self.asset.endswith('church') else 'uiDark')
    def rail(self,x,y,z,w):
        if self.asset.endswith('-b'):
            # Solid teal fascia + cap rail so the balconies read at game distance.
            self.box('balconyFloor',(x-.15,y,z),(.95,w+.22,.2),'backpackTeal')
            self.box('balconyPanel',(x+.24,y,z+.42),(.10,w,.62),'backpackTeal')
            self.box('balconyTop',(x+.24,y,z+.86),(.14,w+.06,.08),'backpackTeal')
            if self.lod==0:
                for i in range(3):self.box('baluster',(x+.24,y-w/2+.2+i*(w-.4)/2,z+.55),(.06,.06,.7),'backpackTeal')
            if self.lod<2:
                for sign in (-1,1):self.box('balconyReturn',(x-.1,y+sign*w/2,z+.7),(.72,.075,.5),'backpackTeal')
            return
        self.box('balconyFloor',(x-.15,y,z),(.9,w+.22,.18))
        self.box('balconyTop',(x+.23,y,z+.85),(.07,w,.08),'backpackTeal')
        self.box('balconyLower',(x+.23,y,z+.18),(.07,w,.07),'backpackTeal')
        for i in range([7,5,2][self.lod]):
            yy=y-w/2+i*w/([7,5,2][self.lod]-1)
            self.box('baluster',(x+.23,yy,z+.5),(.065,.065,.72),'backpackTeal')
        for sign in ((-1,1) if self.lod<2 else ()):self.box('balconyReturn',(x-.1,y+sign*w/2,z+.85),(.72,.075,.08),'backpackTeal')
    def lantern(self,x,y,z):
        self.box('lanternFrame',(x,y,z),(.22,.27,.38),'backpackTeal' if 'apartment' in self.asset else 'uiDark')
        obj=self.box('entryGlow',(x+.12,y,z),(.035,.19,.25))
        obj.data.materials.clear();obj.data.materials.append(palette.mat('windowGlow',True))
        anchor=sockets.empty('light:entry', (x+.2,y,z), self.root)
        anchor['ss_light']=json.dumps(dict(type='point',color='light_window_warm',intensity=1.5,range=4,pool=True,beam='none',reflect=True,shadow='none',heroPriority=1,flicker='none',powerGroup='fairhaven-civic',breakable=True,emissiveNodes=['body_emi_windowGlow']))
    def doorpanel(self, token='backpackTeal'):
        width=1.6 if self.asset.endswith('church') else 1.2
        if self.asset.endswith('church'):
            seg=[10,8,6][self.lod]
            pts=[(0,0),(1.6,0),(1.6,1.5)]+[(.8+.8*math.cos(i*math.pi/seg),1.5+.8*math.sin(i*math.pi/seg)) for i in range(1,seg)]+[(0,1.5)]
            self.prism('doorLeaf',pts,-.06,.06,token,self.door)
            if self.lod<2:
                for y in (.3,.62,.98,1.3):self.box('doorPlank',(.075,y,.8),(.04,.07,1.5),token,self.door)
            self.door['hingeAxis']='Y';self.door['openAngle']=105
            return
        self.box('doorLeaf',(0,width/2,1.15),(.12,width,2.3),token,self.door)
        if self.lod<2:
            for y in (.25,.85):self.box('doorRaisedPanel',(.075,y,1.05),(.04,.43,1.6),token,self.door)
        self.door['hingeAxis']='Y';self.door['openAngle']=105
    def shell(self, depth, width, height, token, entry=1.5):
        self.box('rearWall',(-depth/2+.16,0,height/2),(.32,width,height),token)
        for y in (-width/2+.16,width/2-.16):self.box('sideWall',(0,y,height/2),(depth,.32,height),token)
        for sign in (-1,1):self.box('frontWall',(depth/2-.16,sign*(width+entry)/4,height/2),(.32,(width-entry)/2,height),token)
        self.box('doorLintel',(depth/2-.16,0,(height+2.6)/2),(.32,entry,height-2.6),token)
        self.box('floor',(0,0,.10),(depth,width,.2),'picketWhite',self.interior)
        for name,pos,size in [('rear',(-depth/2+.16,0,height/2),(.32,width,height)),('sideL',(0,-width/2+.16,height/2),(depth,.32,height)),('sideR',(0,width/2-.16,height/2),(depth,.32,height)),('frontL',(depth/2-.16,-(width+entry)/4,height/2),(.32,(width-entry)/2,height)),('frontR',(depth/2-.16,(width+entry)/4,height/2),(.32,(width-entry)/2,height))]:colliders.cuboid(name,size,pos,self.root)


def apartments(s):
    b=s.asset.endswith('-b'); floors=5 if b else 4; top=15.3 if b else 12.5
    token='picketWhite' if b else 'brick'
    s.shell(8.8,12,top,token)
    # Recesses on B are actual empty balcony volumes in front of the back wall.
    for z in ([.3,3.1,6.15,9.2,12.25,15.35] if b else [.3,3.15,12.55]):
        s.box('frontCornice',(4.49,0,z),(.30,12.35,.20))
        for sign in (-1,1):s.box('sideCornice',(0,sign*6.06,z),(9.02,.24,.20))
        s.box('rearCornice',(-4.46,0,z),(.25,12.35,.20))
    for floor in range(1,floors):
        z=1.7+floor*3.03
        for y in (-4.25,-1.45,1.45,4.25):
            recessed=b and abs(y)>3
            x=4.42
            if recessed:
                # Projecting piers and floor slabs make the recessed glazing readable.
                for dy in (-1.38,1.38):s.box('balconyPier',(4.65,y+dy,z),(.3,.26,2.86),token)
                s.box('balconyCeiling',(4.65,y,z+1.35),(.65,2.9,.20),'backpackTeal')
            s.window(x,y,z,1.55 if recessed or (not b and abs(y)<2) else .94,1.92,glow=b and (floor*2+int(y>0)+(1 if recessed else 0))%3!=1)
            if recessed or (not b and abs(y)<2):s.rail(4.78 if b else 5.2,y,z-1.05,2.35 if b else 1.8)
        for side in (-1,1):
            for col,x in enumerate((-2.5,.4,2.8)):s.window(side*6.015,x,z,.95,1.72,side=True,glow=b and (floor+col)%2==0,far=b and side>0)
        for y in (-4.25,-1.45,1.45,4.25):s.window(-4.46,y,z,.95,1.7,far=b)
    for y in (-3.6,3.6):
        s.window(4.46,y,1.55,3.8,2.22,glow=b)
        s.box('shopBase',(4.54,y,.38),(.2,4,.35),'backpackTeal')
        if b:
            # Striped teal/cream awning over a lit storefront.
            n=6 if s.lod<2 else 4
            for i in range(n):
                st=s.box('shopAwning',(4.80,y-2.0+(i+.5)*4.0/n,2.95),(.76,4.0/n,.14),'backpackTeal' if i%2==0 else 'picketWhite')
                st.rotation_euler.y=.5
            s.box('shopAwning',(5.12,y,2.72),(.04,4.0,.24),'backpackTeal')
            canopy=None
        else:
            canopy=s.box('shopAwning',(4.81,y,2.94),(.7,4.1,.32),'backpackTeal')
            canopy.rotation_euler.y=.25
        if s.lod<2:
            for yy in (y-1.28,y,y+1.28):s.box('shopMullion',(4.54,yy,1.54),(.10,.085,2.1),'backpackTeal')
    for y in (-.85,.85):s.box('entryPier',(4.54,y,1.55),(.34,.32,2.8))
    s.box('entryHead',(4.59,0,2.83),(.44,2,.3))
    s.doorpanel();s.lantern(4.57,0,3.35)
    s.box('roofDeck',(0,0,top-.13),(8.8,12,.22),'asphalt',s.roof)
    # Parapet remains structural body geometry, so hiding roof exposes the shell.
    for x in (-4.4,4.4):s.box('parapet',(x,0,top+.17),(.22,12.2,.36),'backpackTeal' if b else token)
    for y in (-6,6):s.box('parapet',(0,y,top+.17),(8.8,.22,.36),'backpackTeal' if b else token)
    if b:
        s.box('HVAC',(-2,2,top+.36),(1.1,1.1,.58),'asphalt',s.roof)
        for hx,hy,hw in ((-2,2,1.1),(1.4,3.2,1.3),(-2.9,-.3,1.0)):s.box('HVACFan',(hx,hy,top+.69),(hw-.1,hw-.1 if hw!=1.3 else .9,.1),'woodWarm',s.roof)
        # Rooftop clutter that reads from the game camera: two more AC units and a wooden water tank on legs.
        s.box('HVAC',(1.4,3.2,top+.36),(1.3,1.0,.58),'asphalt',s.roof)
        s.box('HVAC',(-2.9,-.3,top+.36),(1.0,1.0,.58),'asphalt',s.roof)
        for lx in (-.6,.6):
            for ly in (-.6,.6):s.box('tankLeg',(-1.4+lx,-3.0+ly,top+.55),(.12,.12,.9),'asphalt',s.roof)
        s.box('tankDeck',(-1.4,-3.0,top+.1),(1.7,1.7,.12),'asphalt',s.roof)
        s.tube('waterTank',(-1.4,-3.0,top+1.65),.85,1.3,'woodWarm',parent=s.roof)
        s.tube('waterTankCap',(-1.4,-3.0,top+2.36),.5,.2,'asphalt',parent=s.roof)
        if s.lod<2:
            for i in range(4):s.box('HVACGrille',(-1.44,2,top+.15+i*.13),(.02,.8,.045),'asphalt',s.roof)
    # A few warm occupied windows remain visible in every tier, sharing the
    # entry lantern batch. Broad navy glazing remains the dominant region.
    for floor in range(1,floors):
        glow=s.box('occupiedWindow',(4.493,-1.45 if floor%2 else 1.45,1.40+floor*3.03),(.028,.25,.42))
        glow.data.materials.clear();glow.data.materials.append(palette.mat('windowGlow',True))
    if s.lod==0 and not b:
        # Physical masonry relief is coarse enough to survive a near turntable;
        # the distance shells deliberately omit it without perforating walls.
        for row in range(24):
            z=.55+row*.49
            for col in range(16):
                y=-5.66+col*.73+(row%2)*.17
                if y>5.8:continue
                for x in (-4.42,4.42):s.box('masonryBrick',(x,y,z),(.04,.68,.43),'brick')
            for col in range(10):
                x=-4.0+col*.85+(row%2)*.18
                for sign in (-1,1):s.box('masonryBrick',(x,sign*6.015,z),(.79,.04,.43),'brick')
        # Sparse recessed-tone brick accents, rather than a mesh for every brick.
        for row in range(24):
            z=.55+row*.48
            for col in range(10):
                y=-5.6+col*1.14+(row%2)*.3
                if any(abs(y-w)<.7 for w in (-4.25,-1.45,1.45,4.25)):continue
                s.box('brickAccent',(4.414,y,z),(.012,.65,.025),'brick')
    # Continuous foundation fixes the ground lot; balcony projections are recorded separately.
    s.box('foundation',(0,0,.13),(9.6,12.6,.26))


def hip(s,name,cx,cy,w,d,z,h,token):
    vs=[(cx+x,cy+y,z) for x,y in ((-w/2,-d/2),(-w/2,d/2),(w/2,d/2),(w/2,-d/2))]+[(cx-w*.17,cy,z+h),(cx+w*.17,cy,z+h)]
    o=s.mesh(name,vs,[(0,1,4),(1,2,5,4),(2,3,5),(3,0,4,5),(3,2,1,0)],token);o.parent=s.roof


def hip_y(s,name,cx,cy,w,d,z,h,token):
    """Hipped roof whose ridge runs along the long (Y) axis."""
    r=max(d-w,0)/2*.9
    vs=[(cx+x,cy+y,z) for x,y in ((-w/2,-d/2),(-w/2,d/2),(w/2,d/2),(w/2,-d/2))]+[(cx,cy-r,z+h),(cx,cy+r,z+h)]
    o=s.mesh(name,vs,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4),(3,2,1,0)],token);o.parent=s.roof
    return r


def pyramid(s,name,cx,cy,w,d,z,h,token):
    vs=[(cx+x,cy+y,z) for x,y in ((-w/2,-d/2),(-w/2,d/2),(w/2,d/2),(w/2,-d/2))]+[(cx,cy,z+h)]
    o=s.mesh(name,vs,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(3,2,1,0)],token);o.parent=s.roof


def town_hall(s):
    s.shell(9.6,15.4,7.7,'brick',2.1)
    s.box('foundation',(0,0,.3),(10,16,.6))
    n=[12,6,4][s.lod]
    for sign in (-1,1):
        for x in (-4.68,4.68):
            for i in range(n):
                wide=.48 if i%2==0 else .34
                s.box('stoneQuoin',(x+(.0 if i%2==0 else (-.07 if x>0 else .07)),sign*7.64,.7+(i+.5)*6.7/n),(wide,.48,6.7/n-.03))
    for z in (.7,7.7):
        s.box('frontCornice',(4.8,0,z),(.45,15.8,.25))
        s.box('rearCornice',(-4.8,0,z),(.45,15.8,.25))
        for sign in (-1,1):s.box('sideCornice',(0,sign*7.75,z),(9.9,.4,.25))
    # String course between the floors makes the two storeys read.
    s.box('stringCourse',(4.82,0,3.85),(.18,15.4,.2))
    s.box('stringCourse',(0,-7.72,3.85),(9.6,.18,.2))
    s.box('stringCourse',(0,7.72,3.85),(9.6,.18,.2))
    for fl,z in enumerate((2.0,5.65)):
        for col,y in enumerate((-5.05,0,5.05)):
            if y==0 and z<3:continue
            s.window(4.82,y,z,1.4,2.25,glow=(col+fl)%3!=1 or fl==0)
            s.window(-4.83,y,z,1.4,2.25,far=True,glow=True)
        for sign in (-1,1):
            for col,x in enumerate((-2.7,0,2.7)):s.window(sign*7.72,x,z,1.3,2.25,True,glow=(col+fl)%3!=0 or fl==0,far=sign>0)
    # Portico: four round columns, entablature and a tall pediment on a stone platform.
    s.box('porticoPlatform',(5.5,0,.3),(1.4,6.8,.6))
    for y in (-2.9,-1.5,1.5,2.9):
        s.tube('entranceColumn',(5.5,y,2.2),.27,3.2,'picketWhite')
        s.box('columnBase',(5.5,y,.72),(.7,.7,.2))
        s.box('columnCap',(5.5,y,3.72),(.7,.7,.2))
    s.box('entryEntablature',(5.5,0,3.95),(1.5,6.7,.4))
    s.prism('entryPediment',[(-3.35,4.15),(3.35,4.15),(0,5.5)],4.9,6.2,'picketWhite')
    s.prism('pedimentInset',[(-2.55,4.35),(2.55,4.35),(0,5.15)],6.2,6.23,'brick')
    for i in range(2):s.box('wideStep',(6.375+i*.35,0,(.4-.2*i)/2),(.35,6.2-i*.0+i*.3,.4-.2*i))
    s.doorpanel('woodWarm');s.lantern(5.06,-1.8,2.9)
    r=hip_y(s,'hipRoof',0,0,10.3,16,7.85,2.7,'denim')
    if s.lod<2:
        m=14 if s.lod==0 else 7
        for i in range(1,m):
            f=i/m;z=7.85+2.7*f+.02
            for sign in (-1,1):
                s.box('slateCourse',(sign*5.15*(1-f),0,z),(.1,16-2*f*(8-r),.07),'denim',s.roof)
                s.box('slateCourse',(0,sign*(8-f*(8-r)),z),(10.3*(1-f)+.06,.1,.07),'denim',s.roof)
    # Clock cupola: the landmark. Large square drum, four big clock faces.
    zc=10.9
    s.box('clockTower',(0,0,zc),(4.4,4.4,3.7),'brick')
    for sx in (-1,1):
        for sy in (-1,1):s.box('cupolaQuoin',(sx*2.22,sy*2.22,zc),(.42,.42,3.6))
    for z in (9.05,12.82):s.box('towerStoneBand',(0,0,z),(4.8,4.8,.3))
    s.box('cupolaCornice',(0,0,12.98),(5.1,5.1,.22))
    pyramid(s,'towerRoof',0,0,5.0,5.0,13.09,1.7,'denim')
    s.box('towerFinial',(0,0,15.0),(.14,.14,.7),'denim',s.roof)
    for k in range(4):
        th=k*math.pi/2;c,sn=math.cos(th),math.sin(th)
        parts=[]
        seg=[28,20,16][s.lod]
        disc=lambda r:[(math.cos(i*math.tau/seg)*r,zc+math.sin(i*math.tau/seg)*r) for i in range(seg)]
        o=s.prism('clockRim',disc(1.52),2.2,2.31,'uiDark')
        o2=s.prism('clockFace',disc(1.34),2.3,2.36,'picketWhite')
        parts=[o,o2]
        for a,l in ((-.6,1.0),(.85,.78)):
            obj=s.box('clockHand',(2.38,math.sin(a)*l/2,zc+math.cos(a)*l/2),(.05,.12,l),'uiDark');obj.rotation_euler.x=-a;parts.append(obj)
        if s.lod<2:
            for i in range(12):
                a=i*math.tau/12;big=i%3==0
                obj=s.box('clockTick',(2.37,math.sin(a)*1.12,zc+math.cos(a)*1.12),(.04,.08 if big else .05,.26 if big else .16),'uiDark');obj.rotation_euler.x=-a;parts.append(obj)
        else:
            for i in range(4):
                a=i*math.pi/2
                obj=s.box('clockTick',(2.37,math.sin(a)*1.12,zc+math.cos(a)*1.12),(.04,.14,.26),'uiDark');obj.rotation_euler.x=-a;parts.append(obj)
        for obj in parts:
            if obj.name.startswith(('clockRim','clockFace')):
                for v in obj.data.vertices:v.co.x,v.co.y=v.co.x*c-v.co.y*sn,v.co.x*sn+v.co.y*c
                continue
            x,y,z=obj.location
            obj.location=(x*c-y*sn,x*sn+y*c,z);obj.rotation_euler.z+=th
    if s.lod<2:
        for y in range(-7,8):s.box('corniceDentil',(4.88,y,7.42),(.36,.30,.26))


def church(s):
    DZ=1.6;SH=2.7  # extra tower height over the first delivery; footprint and anchors unchanged
    zf=9.35+DZ+.125  # belfry floor
    s.shell(15.6,10,5.5,'picketWhite',2.3)
    # Foundation keeps the documented 18 x 10.6 footprint; the front is cut into entry steps.
    s.box('foundation',(-.3,0,.20),(17.4,10.6,.4),'khaki')
    for sign in (-1,1):s.box('foundation',(8.7,sign*3.525,.20),(.6,3.55,.4),'khaki')
    for i in range(3):
        top=.4-.13*i
        s.box('entryStep',(8.5+.2*i,0,top/2),(.2,3.5,top),'khaki')
    # Nave gables and solid paired roof slopes, ridge parallel to +X.
    for x in (-7.8,7.8):s.prism('gable',[(-5,5.45),(5,5.45),(0,8.2)],x-.15,x+.15,'picketWhite')
    s.prism('naveRoof',[(-5.3,5.4),(0,8.35),(5.3,5.4),(5.3,5.2),(0,8.15),(-5.3,5.2)],-8.1,8.1,'brick',s.roof)
    s.box('ridge',(0,0,8.33),(16.3,.18,.18),'brick',s.roof)
    from mathutils import Vector
    xs={0:[-7.8+i*.65 for i in range(25)],1:[-7.5+i*1.0 for i in range(16)],2:[-7.2+i*1.9 for i in range(8)]}[s.lod]
    for x in xs:
        for sign in (-1,1):
            a_=Vector((x,0,8.35));b_=Vector((x,sign*5.25,5.43))
            obj=s.tube('clayTileRoll',(a_+b_)/2,.09 if s.lod else .07,(b_-a_).length,'brick',parent=s.roof)
            obj.rotation_euler=(b_-a_).to_track_quat('Z','Y').to_euler()
    # Stone coursing: staggered khaki ashlar blocks on the faces the game camera sees
    # (LOD2 keeps plain horizontal courses).
    def ashlar(axis,fixed,lo,hi,z0,z1,bw,bh,skip=lambda a,z:False):
        row=0;z=z0
        while z+bh<=z1:
            a_=lo+(bw/2 if row%2 else 0)
            while a_+bw<=hi+1e-6:
                if not skip(a_+bw/2,z+bh/2):
                    if axis=='y':s.box('stoneBlock',(a_+bw/2,fixed,z+bh/2),(bw-.08,.06,bh-.08),'khaki')
                    else:s.box('stoneBlock',(fixed,a_+bw/2,z+bh/2),(.06,bw-.08,bh-.08),'khaki')
                a_+=bw
            z+=bh;row+=1
    if s.lod<2:
        bw,bh=(1.0,.56) if s.lod==0 else (1.9,.95)
        win=lambda cs:(lambda a,z:any(abs(a-c)<.95 and 1.5<z<4.9 for c in cs) or (abs(a+5.9)<1.0 and z<2.9))
        ashlar('y',-5.03,-7.7,7.7,.45,5.4,bw,bh,win((-5,-1,2.9)))
        ashlar('y',-1.73,5.3,8.4,.45,zf-.1,.8 if s.lod==0 else 1.55,bh,lambda a,z:abs(a-6.85)<.7 and 5.8<z<8.6)
        ashlar('x',8.53,-1.6,1.6,2.9,zf-.1,.8 if s.lod==0 else 1.6,bh,lambda a,z:abs(a)<.7 and 5.8<z<8.6)
        ashlar('x',-7.83,-4.9,4.9,.45,5.4,bw,bh,lambda a,z:abs(a)<.9 and 1.5<z<4.9)
    else:
        for z in [.9+i*1.2 for i in range(4)]:
            for sign in (-1,1):s.box('stoneCourse',(0,sign*5.025,z),(15.6,.06,.13),'khaki')
            s.box('stoneCourse',(-7.83,0,z),(.06,9.9,.13),'khaki')
        for z in [.9+i*1.5 for i in range(7)]:
            if z>zf-.2:continue
            s.box('stoneCourse',(8.52,0,z),(.06,3.4,.13),'khaki')
            s.box('stoneCourse',(6.85,-1.72,z),(3.2,.06,.13),'khaki')
    # Tall tower: a real entrance runs through front and rear walls (navigation aperture kept).
    for x in (5.34,8.36):
        for sign in (-1,1):s.box('towerEntryPier',(x,sign*1.30,4.98+DZ/2),(.28,.70,9.45+DZ))
        s.box('towerEntryLintel',(x,0,6.03+DZ/2),(.28,1.90,6.7+DZ))
    for y in (-1.58,1.58):s.box('towerShaftSide',(6.85,y,5.0+DZ/2),(3.3,.24,9.5+DZ))
    # Quoin-like corner strips up the full tower.
    for x in (5.2,8.5):
        for y in (-1.7,1.7):s.box('towerCorner',(x,y,(zf+.1)/2),(.34,.34,zf+.1),'khaki')
    # Belfry: open arched sound openings on all four faces, dark inner shade, bell inside.
    s.box('belfryFloor',(6.85,0,zf-.05),(3.0,3.0,.3),'blueTrim')
    for z in (zf-.12,zf+3.06):s.box('towerBand',(6.85,0,z),(3.75,3.85,.28),'khaki')
    s.box('towerBand',(6.85,0,9.35),(3.6,3.7,.25),'khaki')
    for x in (5.27,8.43):
        for y in (-1.62,1.62):s.box('bellPier',(x,y,zf+1.6),(.34,.34,3.0))
    s.box('belfryShade',(5.50,0,zf+1.55),(.05,1.8,2.1),'blueTrim')
    s.box('belfryShade',(6.85,1.38,zf+1.55),(1.8,.05,2.1),'blueTrim')
    def belfry_profile():
        zs=zf+1.72;rad=.9;seg=[10,8,6][s.lod]
        pts=[(-1.45,zf+.3),(-1.45,zf+3.0),(1.45,zf+3.0),(1.45,zf+.3),(rad,zf+.3),(rad,zs)]
        pts+=[(rad*math.cos(i*math.pi/seg),zs+rad*math.sin(i*math.pi/seg)) for i in range(1,seg)]
        pts+=[(-rad,zs),(-rad,zf+.3)]
        return pts
    for x in (5.30,8.40):
        s.prism('bellArch',belfry_profile(),x-.13,x+.13,'picketWhite')
    for y in (-1.56,1.56):
        o=s.prism('bellSideArch',belfry_profile(),y-.13,y+.13,'picketWhite')
        for v in o.data.vertices:v.co.x,v.co.y=v.co.y+6.85,v.co.x
    # Lathed flared bell profile, closed at top and bottom, all tiers.
    sides=[20,12,8][s.lod];bz=zf+.2
    profile=[(.19,bz+2.0),(.3,bz+1.77),(.34,bz+1.22),(.55,bz+1.0),(.57,bz+.91)]
    vs=[(6.85+r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),z) for r,z in profile for i in range(sides)]
    fs=[tuple(range(sides-1,-1,-1)),tuple(range((len(profile)-1)*sides,len(profile)*sides))]
    for row in range(len(profile)-1):
        for i in range(sides):fs.append((row*sides+i,row*sides+(i+1)%sides,(row+1)*sides+(i+1)%sides,(row+1)*sides+i))
    s.mesh('bell',vs,fs,'woodWarm');s.tube('bellClapper',(6.85,0,bz+.85),.10,.30,'woodWarm')
    # Tall slender spire with a cross; red tile like the nave.
    top=zf+3.2
    pyramid(s,'bellTowerRoof',6.85,0,4.3,4.3,top,SH,'brick')
    if s.lod<2:
        for i in range(1,5):
            f=i/5;w=4.3*(1-f);z=top+SH*f+.02
            for sign in (-1,1):
                s.box('spireCourse',(6.85+sign*w/2,0,z),(.08,w,.09),'brick',s.roof)
                s.box('spireCourse',(6.85,sign*w/2,z),(w,.08,.09),'brick',s.roof)
    s.box('crossUpright',(6.85,0,top+SH+.5),(.16,.16,1.2),'khaki')
    s.box('crossArms',(6.85,0,top+SH+.75),(.16,.8,.16),'khaki')
    # Tall arched windows: lit warm, nave sides, tower faces, rear.
    for sign in (-1,1):
        for x in (-5,-1,2.9):s.window(sign*5.015,x,3.1,1.15,2.8,True,True,glow=True,far=sign>0)
    s.window(-7.83,0,3.25,1.35,2.9,False,True,glow=True,far=True)
    s.window(8.53,0,7.2,.95,2.6,False,True,glow=True)
    s.window(-1.73,6.85,7.2,.95,2.6,True,True,glow=True)
    s.window(1.73,6.85,7.2,.95,2.6,True,True,glow=True,far=True)
    # Arched wooden door in a stone arch at the foot of the tower.
    s.window(8.55,0,1.6,1.9,2.7,False,True)
    s.door.location=(8.60,-.8,.25)
    s.doorpanel('woodWarm')
    bpy.data.objects['doorway'].location=(8.72,0,.25)
    anchor=sockets.empty('light:nave',(8.0,-4.95,3.1),s.root)
    anchor['ss_light']=json.dumps(dict(type='point',color='light_window_warm',intensity=1.5,range=5,pool=True,beam='none',reflect=True,shadow='none',heroPriority=1,flicker='none',powerGroup='fairhaven-civic',breakable=True,emissiveNodes=['body_emi_windowGlow']))
    # Side vestry access: named visible door and cue attachment, no mission logic.
    s.box('vestryLeaf',(-5.9,-5.18,1.3),(1.25,.14,2.2),'woodWarm')
    for x in (-6.61,-5.19):s.box('vestryJamb',(x,-5.24,1.4),(.16,.22,2.55),'khaki')
    s.box('vestryHead',(-5.9,-5.24,2.67),(1.6,.22,.18),'khaki')
    sockets.empty('vestry_door',(-5.9,-5.35,.25),s.root)
    sockets.empty('vestry_hide',(-5.9,-3.5,.25),s.root)
    sockets.empty('sign_of_life',(-5.9,-5.35,1.7),s.root)
    if s.lod<2:
        for sign in (-1,1):
            for x in (-7.5,-3,1.1,6.0):
                s.box('buttress',(x,sign*5.04,2.6),(.4,.46,5.1),'khaki')


def main(asset, directory):
    parser=argparse.ArgumentParser();parser.add_argument('--glb',required=True);parser.add_argument('--quality',default='high');parser.add_argument('--distance-tier',type=int,choices=[0,1,2]);args=parser.parse_args(__import__('sys').argv[__import__('sys').argv.index('--')+1:])
    directory=Path(directory);stats={}
    for lod in ([args.distance_tier] if args.distance_tier is not None else [0,1,2]):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        s=Civic(asset,lod)
        if 'apartment' in asset:apartments(s)
        elif asset.endswith('town-hall'):town_hall(s)
        else:church(s)
        # Closed profile meshes (arches, rings, roofs, bell) use explicit faces;
        # orient their normals outwards before batching alongside Blender cubes.
        for obj in s.root.children_recursive:
            if obj.type!='MESH':continue
            bm=bmesh.new();bm.from_mesh(obj.data)
            bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
            bm.to_mesh(obj.data);bm.free()
        export.merge_by_material(s.root,s.protected)
        ao.bake_all(s.root.children_recursive,16)
        # Large shell vertices meet adjacent walls: bound baked occlusion so
        # interpolation cannot turn a complete facade black at game distance.
        for obj in s.root.children_recursive:
            if obj.type!='MESH':continue
            for color in obj.data.color_attributes['ao'].data:
                r,g,b,a=color.color;color.color=(.65+.35*r,.65+.35*g,.65+.35*b,a)
        meshes=[o for o in s.root.children_recursive if o.type=='MESH']
        for o in meshes:o.data.calc_loop_triangles()
        triangles=sum(len(o.data.loop_triangles) for o in meshes);draws=sum(len(o.data.materials) for o in meshes)
        if triangles>[30000,12000,4000][lod] or draws>8:raise ValueError(f'{asset} LOD{lod}: {triangles} triangles, {draws} draws')
        path=directory/('model'+('' if lod==0 else f'.lod{lod}')+'.glb');export.glb(s.root,path)
        stats[f'lod{lod}']={'triangles':triangles,'drawCalls':draws,'bytes':path.stat().st_size,'materials':sorted({m.name for o in meshes for m in o.data.materials})}
    (directory/'geometry.json').write_text(json.dumps(stats,indent=2)+'\n')
    source=directory/('model'+(f'.lod{args.distance_tier}' if args.distance_tier else '')+'.glb')
    output=Path(args.glb).resolve();output.parent.mkdir(parents=True,exist_ok=True)
    if source.resolve()!=output:shutil.copyfile(source,output)
