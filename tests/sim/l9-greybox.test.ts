import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { crossing } from '../../src/levels/L9/district';
import type { DistrictLayout } from '../../src/levels/districts/types';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json','utf8')) as DistrictLayout;
for (const route of crossing.routes) test(`T-E31-05-${route.id} @E31-AC05 existing E09 physics completes ${route.id} and its off-road detour`, async () => {
  const w = new SimWorld(); await w.init();
  try {
    for (const path of [route.points, route.detour]) {
      w.loadComposition(compositions['D-CROSSING'],[layout],31);
      // Keep the fixture observer clear of the departure hull and automatic door entry.
      Object.assign(w.entities.get(1)!.transform,{x:-570,z:20});
      w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform,true);
      const id=w.vehicles!.spawn('vehicle.sedan',{x:crossing.start[0],z:crossing.start[1]}), car=w.vehicles!.cars.get(id)!;
      let index=1, unsupported=0;
      // Same pure-pursuit steering as Scene Lab, exercising real Rapier suspension/contacts.
      w.vehicles!.autopilot.set(id,(intent,e)=>{
        while(index<path.length-1 && Math.hypot(path[index][0]-e.transform.x,path[index][1]-e.transform.z)<6) index++;
        const dx=path[index][0]-e.transform.x,dz=path[index][1]-e.transform.z;
        const delta=Math.atan2(Math.sin(-Math.atan2(dz,dx)-e.transform.yaw),Math.cos(-Math.atan2(dz,dx)-e.transform.yaw));
        intent.steer=Math.max(-1,Math.min(1,delta*2)); intent.throttle=.7; intent.brake=false;
      });
      let arrived=false;
      for(let tick=0;tick<60*300;tick++) {
        w.update();
        const p=car.entity.transform;
        if(p.y < -.1 || p.y > 2) unsupported++;
        if(index===path.length-1 && Math.hypot(p.x-crossing.outskirts[0],p.z-crossing.outskirts[1])<12){arrived=true;break;}
      }
      expect(arrived,`${route.id} arrived at ${car.entity.transform.x},${car.entity.transform.z}, waypoint ${index}`).toBe(true);
      expect(unsupported).toBe(0); expect(car.entity.health.current).toBe(car.entity.health.max);
    }
  } finally { w.dispose(); }
},60_000);
