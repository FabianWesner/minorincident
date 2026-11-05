/** Minimal structural types for the Cloudflare bindings used here (no @cloudflare/workers-types dependency). */
export interface D1Result { success?: boolean; meta?: { changes?: number; last_row_id?: number } }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<D1Result>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}
export interface D1Database { prepare(sql: string): D1Statement; batch(statements: D1Statement[]): Promise<D1Result[]> }
export interface R2ObjectBody { size: number; arrayBuffer(): Promise<ArrayBuffer> }
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { customMetadata?: Record<string, string> }): Promise<unknown>;
  head(key: string): Promise<{ size: number } | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options: { prefix: string; limit?: number }): Promise<{ objects: { key: string; size: number }[] }>;
}
export interface Env { DB: D1Database; REPLAYS: R2Bucket; TELEMETRY_READ_TOKEN?: string }
