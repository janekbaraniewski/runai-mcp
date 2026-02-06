import type { DocRow } from "./db/docs-db.js";

const DEFAULT_TTL_MS = 900_000; // 15 minutes

interface CacheEntry {
  page: DocRow;
  expiresAt: number;
}

export class PageCache {
  private store = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs ?? Number(process.env.RUNAI_DOCS_CACHE_TTL_MS || DEFAULT_TTL_MS);
    if (!Number.isFinite(this.ttlMs) || this.ttlMs < 0) {
      this.ttlMs = DEFAULT_TTL_MS;
    }
  }

  static key(docset: string | undefined, version: string | undefined, url: string): string {
    return `${docset ?? "*"}::${version ?? "*"}::${url}`;
  }

  get(key: string): DocRow | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.page;
  }

  set(key: string, page: DocRow): void {
    this.store.set(key, { page, expiresAt: Date.now() + this.ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
