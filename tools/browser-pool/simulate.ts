/** Four-lane scheduling model isolates the idle-reservation effect from Chrome startup. */
const clients = 4, stepMs = 200, remoteJudgeMs = 2000;
function wholeScript(slots: number) {
  const available = Array(slots).fill(0) as number[], waits: number[] = [];
  for (let job = 0; job < clients; job++) {
    const slot = available.indexOf(Math.min(...available));
    waits.push(available[slot]); available[slot] += 2 * stepMs + remoteJudgeMs;
  }
  return { slots, wallMs: Math.max(...available), waitPerJobMs: waits, meanWaitMs: waits.reduce((a, b) => a + b) / clients };
}
function perStep(contexts: number) {
  const available = Array(contexts).fill(0) as number[], waits = Array(clients).fill(0) as number[];
  const queue = Array.from({ length: clients }, (_, job) => ({ job, step: 0, ready: 0 }));
  while (queue.length) {
    queue.sort((a, b) => a.ready - b.ready || a.job - b.job);
    const task = queue.shift()!, slot = available.indexOf(Math.min(...available));
    const start = Math.max(task.ready, available[slot]); waits[task.job] += start - task.ready;
    available[slot] = start + stepMs;
    if (!task.step) queue.push({ job: task.job, step: 1, ready: available[slot] + remoteJudgeMs });
  }
  return { contexts, wallMs: Math.max(...available), waitPerJobMs: waits, meanWaitMs: waits.reduce((a, b) => a + b) / clients };
}
console.log(JSON.stringify({ model: 'four lanes, two 200 ms job steps with 2 s remote judging; no browser startup/guard cost', beforeTwoSlots: wholeScript(2), pooledTwoContexts: perStep(2), pooledFourContexts: perStep(4) }, null, 2));
