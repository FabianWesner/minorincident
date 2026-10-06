import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, SphereGeometry } from 'three/webgpu';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
/** Scenario-only code placeholders while infected assets await integrated registry status (E17).
 * Gameplay never reads these objects; full weapon views and aim indicators are owned by E06. */
export class CombatView extends Group {
  private readonly dummies = new Map<number, Group>();
  private readonly bodyGeometry = new BoxGeometry(0.4, 0.7, 0.5);
  private readonly headGeometry = new SphereGeometry(0.2, 8, 6);
  private readonly eyeGeometry = new SphereGeometry(0.035, 6, 4);
  private readonly eyeMaterial = new MeshBasicNodeMaterial({ color: '#ff3b2f' });
  constructor(private readonly world: SimWorld, private readonly materials: Materials) { super(); }
  update(): void {
    for(const [id,dummy]of this.dummies)if(!this.world.entities.get(id)){this.remove(dummy);this.dummies.delete(id);}
    for (const entity of this.world.entities.iterate()) {
      if (entity.id === 1 || !entity.combat || entity.faction === 'environment') continue;
      let dummy = this.dummies.get(entity.id);
      if (!dummy) {
        dummy = new Group();
        const body = new Mesh(this.bodyGeometry, this.materials.get(entity.faction === 'infected' ? 'policeBlue' : 'backpackTeal'));
        body.position.y = 0.6; body.castShadow = true;
        const head = new Mesh(this.headGeometry, this.materials.get('infectedSkin')); head.position.y = 1.15; head.castShadow = true;
        dummy.add(body, head);
        for (const z of [-0.08, 0.08]) { const eye = new Mesh(this.eyeGeometry, this.eyeMaterial); eye.position.set(0.18, 1.18, z); dummy.add(eye); }
        if (entity.combat.shield) { const shield = new Mesh(this.bodyGeometry, this.materials.get('uiDark')); shield.scale.set(0.15, 1.3, 1.2); shield.position.set(0.3, 0.7, 0); dummy.add(shield); }
        this.dummies.set(entity.id, dummy); this.add(dummy);
      }
      dummy.position.set(entity.transform.x, 0, entity.transform.z); dummy.rotation.y = entity.transform.yaw;
      dummy.rotation.z = entity.health.current > 0 ? 0 : Math.PI / 2;
    }
  }
  dispose(): void { this.clear(); this.dummies.clear(); this.bodyGeometry.dispose(); this.headGeometry.dispose(); this.eyeGeometry.dispose(); this.eyeMaterial.dispose(); }
}
