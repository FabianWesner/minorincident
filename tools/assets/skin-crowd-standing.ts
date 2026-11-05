import type { Document } from '@gltf-transform/core';

/** Preserve the chosen template's bind frame when importing a legacy story contract. */
export function adoptStandingBind(document: Document): void {
  const nodes = document.getRoot().listNodes();
  for (const node of nodes) {
    const extras = node.getExtras();
    if (typeof extras.ss_standingPose !== 'string') continue;
    const previous = JSON.parse(extras.ss_standingPose) as Record<string, unknown>;
    const actual = Object.fromEntries(Object.keys(previous).flatMap(name => {
      const joint = nodes.find(candidate => candidate.getName() === name);
      return joint ? [[name, { translation: joint.getTranslation(), rotation: joint.getRotation(), scale: joint.getScale() }]] : [];
    }));
    node.setExtras({ ...extras, ss_standingPose: JSON.stringify(actual) });
  }
}
