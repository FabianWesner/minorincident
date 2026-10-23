// Exit status only: never print endpoints/tokens into shell evaluation.
if (process.env.BROWSER_POOL === 'off') process.exit(1);
try {
  const r = await fetch(`${process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329'}/health`, { signal: AbortSignal.timeout(700) });
  const h = await r.json(); process.exit(r.ok && h.protocol === 1 ? 0 : 1);
} catch { process.exit(1); }
