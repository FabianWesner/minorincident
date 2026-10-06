export interface HordePoint {
    id: number;
    x: number;
    z: number;
}
export interface HordeCluster {
    id: number;
    x: number;
    z: number;
    count: number;
}
/** Six bounded Lloyd iterations at 5 Hz; called with reused sim records, never from render frames. */
export class HordeClusters {
    readonly clusters: HordeCluster[] = [];
    readonly nearby: HordePoint[] = [];
    private readonly points: HordePoint[] = [];
    private readonly sums = Array.from({ length: 6 }, () => ({ x: 0, z: 0, count: 0 }));
    assignment(p: {
        x: number;
        z: number;
    }): number {
        let best = 0, distance = Infinity;
        for (const c of this.clusters) {
            const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
            if (d < distance) {
                distance = d;
                best = c.id;
            }
        }
        return best;
    }
    gain(count: number): number { return 0.08 + Math.min(1, Math.log2(count + 1) / 8) * 0.42; }
    update(input: Iterable<HordePoint>, listener: {
        x: number;
        z: number;
    }): void {
        this.points.length = 0;
        this.nearby.length = 0;
        for (const p of input) {
            const d = (p.x - listener.x) ** 2 + (p.z - listener.z) ** 2;
            if (d <= 900)
                this.points.push(p);
            if (d <= 36 && this.nearby.length < 4)
                this.nearby.push(p);
        }
        const k = this.points.length ? Math.min(this.points.length, Math.max(3, Math.min(6, Math.ceil(this.points.length / 30)))) : 0;
        this.clusters.length = 0;
        if (!k)
            return;
        // Farthest-point seeding prevents coincident initial centroids in ordered horde records.
        this.clusters.push({ id: 0, x: this.points[0].x, z: this.points[0].z, count: 0 });
        for (let i = 1; i < k; i++) {
            let best = this.points[0], far = -1;
            for (const p of this.points) {
                const c = this.clusters[this.assignment(p)], d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2;
                if (d > far) {
                    far = d;
                    best = p;
                }
            }
            this.clusters.push({ id: i, x: best.x, z: best.z, count: 0 });
        }
        for (let step = 0; step < 6; step++) {
            for (const s of this.sums) {
                s.x = 0;
                s.z = 0;
                s.count = 0;
            }
            for (const p of this.points) {
                const s = this.sums[this.assignment(p)];
                s.x += p.x;
                s.z += p.z;
                s.count++;
            }
            for (const c of this.clusters) {
                const s = this.sums[c.id];
                if (s.count) {
                    c.x = s.x / s.count;
                    c.z = s.z / s.count;
                }
                c.count = s.count;
            }
        }
        for (let i = this.clusters.length - 1; i >= 0; i--)
            if (!this.clusters[i].count)
                this.clusters.splice(i, 1);
        // IDs index sums; empty clusters are rare but assignment is always a stable cluster ID.
    }
}
