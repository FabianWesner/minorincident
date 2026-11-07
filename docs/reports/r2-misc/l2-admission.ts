import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadL2, runL2 } from '../../../tools/sim-runner/l2Bots';
import { ThreatObserver } from '../../../tools/qa/threat/observer';
const rows = [];
for (const tier of ['low', 'high'] as const)
    for (const profile of ['no-axe', 'complete'] as const) {
        const { world, mission } = await loadL2(1, tier);
        const threat = new ThreatObserver(world, 'L2');
        let peak = 0;
        world.events.on('sim.tick', () => { peak = Math.max(peak, world.infected!.active.filter(e => e.health.current > 0).length); });
        try {
            const report = runL2(world, mission, profile, { maxSeconds: 600 });
            const bridge = threat.finish().phases.find(p => p.key === 'step/bridge');
            const row = { tier, profile, peak, cap: world.infected!.director.cap, outcome: report.outcome, radio: report.radio, singles: report.scatteredSingleAdmissions, cluster: report.cluster, bridgeAttacksPerMinute: bridge?.attacksPerMinute };
            rows.push(row);
            console.log(JSON.stringify(row));
            assert.equal(report.outcome, 'complete');
            assert(report.radio && report.radio.escapeArea >= 25 && report.radio.groupsOf4 >= 3 && report.radio.chasingFraction <= .2);
            assert(report.scatteredSingleAdmissions.length >= (tier === 'low' ? 4 : 6));
            assert(peak <= (tier === 'low' ? 30 : 60));
            assert(report.cluster && report.cluster.size >= 12 && report.cluster.size <= 16 && report.cluster.atApproach >= 12 && report.cluster.atApproach <= 16);
            if (profile === 'complete')
                assert(bridge && bridge.attacksPerMinute >= 2 && bridge.attacksPerMinute <= 20);
        }
        finally {
            world.dispose();
        }
    }
writeFileSync('docs/reports/r2-misc/L2-admission.json', JSON.stringify({ sourceSha256: createHash('sha256').update(readFileSync('src/sim/missions/LevelTwoRescue.ts')).digest('hex'), rows }, null, 2) + '\n');
