import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1Database, D1Result, D1Statement, Env, R2Bucket } from '../../../functions/_lib/types';

/** Local D1 stand-in on node:sqlite with the real migration applied, plus an in-memory R2. */
export function localEnv(token = 'test-token-0123456789abcdef'): Env & { sqlite: DatabaseSync; objects: Map<string, Uint8Array> } {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0002_debug.sql', 'utf8'));
  const statement = (sql: string, values: unknown[] = []): D1Statement => ({
    bind: (...next: unknown[]) => statement(sql, next),
    run: async (): Promise<D1Result> => { const r = sqlite.prepare(sql).run(...(values as SQLInputValue[])); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
    first: async <T>() => (sqlite.prepare(sql).get(...(values as SQLInputValue[])) as T | undefined) ?? null,
    all: async <T>() => ({ results: sqlite.prepare(sql).all(...(values as SQLInputValue[])) as T[] }),
  });
  const DB: D1Database = {
    prepare: sql => statement(sql),
    batch: async statements => { const out: D1Result[] = []; for (const s of statements) out.push(await s.run()); return out; },
  };
  const objects = new Map<string, Uint8Array>();
  const REPLAYS: R2Bucket = {
    put: async (key, value) => { objects.set(key, new Uint8Array(value as Uint8Array)); },
    head: async key => objects.has(key) ? { size: objects.get(key)!.length } : null,
    get: async key => { const v = objects.get(key); return v ? { size: v.length, arrayBuffer: async () => v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) as ArrayBuffer } : null; },
    list: async ({ prefix }) => ({ objects: [...objects].filter(([k]) => k.startsWith(prefix)).map(([key, v]) => ({ key, size: v.length })) }),
  };
  return { DB, REPLAYS, TELEMETRY_READ_TOKEN: token, sqlite, objects };
}
