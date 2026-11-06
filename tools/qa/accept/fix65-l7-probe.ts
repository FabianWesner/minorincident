import { probeLevel, provenance } from './probe';
import { atomicJson } from './report';
const label = process.argv[2] ?? 'trial';
const identity = provenance();
for (const tier of ['low', 'high'] as const) for (const policy of ['complete', 'stationary'] as const) {
  const receipt = await probeLevel('L7', tier, policy, identity);
  atomicJson(`docs/reports/fix65-c/L7-${label}-${tier}-${policy}.json`, receipt);
  console.log(label, tier, policy, JSON.stringify(receipt.threat?.phases.filter(phase => phase.key === 'step/corridor')));
}
