import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DB_FILENAME = "runai-docs.db";

const __filename = fileURLToPath(import.meta.url);
const MODULE_DIR = path.dirname(__filename);

export interface DocRow {
  url: string;
  category: string;
  subcategory: string;
  title: string;
  content_md: string;
  content_plain: string;
  fetched_at: string;
}

export interface DocMeta {
  url: string;
  category: string;
  subcategory: string;
  title: string;
  fetched_at: string;
}

export interface SearchResult {
  url: string;
  category: string;
  subcategory: string;
  title: string;
  snippet: string;
  rank: number;
  fetched_at: string;
}

function normalizePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function resolveDbPath(explicit?: string): { path: string; source: string } {
  const candidates: { path: string; source: string }[] = [];

  if (explicit) {
    candidates.push({ path: normalizePath(explicit), source: "RUNAI_DOCS_DB" });
  }

  const distOrSrcDataPath = path.resolve(MODULE_DIR, "..", "data", DEFAULT_DB_FILENAME);
  candidates.push({ path: distOrSrcDataPath, source: "module:data" });

  const repoSrcPath = path.resolve(MODULE_DIR, "..", "..", "src", "data", DEFAULT_DB_FILENAME);
  if (repoSrcPath !== distOrSrcDataPath) {
    candidates.push({ path: repoSrcPath, source: "repo:src" });
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate.path)) {
      return candidate;
    }
  }

  const attempted = candidates.map((candidate) => `- ${candidate.source}: ${candidate.path}`).join("\n");
  throw new Error(
    `Run:ai docs database not found. Tried:\n${attempted}\nSet RUNAI_DOCS_DB or run \"npm run scrape\" to generate the database.`
  );
}

export class DocsDatabase {
  private db: Database.Database;
  readonly dbPath: string;

  constructor(dbPath?: string) {
    const resolved = resolveDbPath(dbPath || process.env.RUNAI_DOCS_DB);
    this.dbPath = resolved.path;
    this.db = new Database(this.dbPath, { readonly: true });
  }

  search(query: string, limit: number = 10, offset: number = 0): SearchResult[] {
    const sanitized = this.sanitizeFts5Query(query);
    const stmt = this.db.prepare(`
      SELECT
        p.url,
        p.category,
        p.subcategory,
        p.title,
        p.fetched_at,
        snippet(pages_fts, 1, '>>>>', '<<<<', '...', 64) as snippet,
        rank
      FROM pages_fts
      JOIN pages p ON pages_fts.rowid = p.rowid
      WHERE pages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
      OFFSET ?
    `);
    return stmt.all(sanitized, limit, offset) as SearchResult[];
  }

  /**
   * Sanitize a user query for FTS5 MATCH.
   * Wraps tokens containing special characters (dots, hyphens, etc.) in double quotes
   * so FTS5 treats them as literal phrases rather than operator syntax.
   */
  private sanitizeFts5Query(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
      return trimmed;
    }

    // If the user already wrapped the whole query in quotes, pass through
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed;
    }

    const specialChars = /[.\-:/\\(){}[\]^~@#$%&+=|<>!]/;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const safe = tokens.map((token) => {
      const escaped = token.replace(/"/g, '""');
      if (token.startsWith('"') && token.endsWith('"')) return escaped;
      if (specialChars.test(token)) return `"${escaped}"`;
      return escaped;
    });
    return safe.join(" ");
  }

  getPage(url: string): DocRow | null {
    const stmt = this.db.prepare("SELECT * FROM pages WHERE url = ?");
    return (stmt.get(url) as DocRow) || null;
  }

  findPagesByTitle(title: string, limit: number = 5): DocMeta[] {
    const stmt = this.db.prepare(
      `SELECT url, title, category, subcategory, fetched_at
       FROM pages
       WHERE title LIKE ?
       ORDER BY CASE WHEN title = ? THEN 0 ELSE 1 END, length(title)
       LIMIT ?`
    );
    return stmt.all(`%${title}%`, title, limit) as DocMeta[];
  }

  countByCategory(category: string, subcategory?: string): number {
    const stmt = subcategory
      ? this.db.prepare("SELECT COUNT(*) as count FROM pages WHERE category = ? AND subcategory = ?")
      : this.db.prepare("SELECT COUNT(*) as count FROM pages WHERE category = ?");
    const row = subcategory ? stmt.get(category, subcategory) : stmt.get(category);
    return (row as { count: number }).count;
  }

  listByCategory(category: string, limit?: number, offset?: number, subcategory?: string): DocMeta[] {
    const hasPaging = typeof limit === "number";
    const base = subcategory
      ? "SELECT url, title, category, subcategory, fetched_at FROM pages WHERE category = ? AND subcategory = ? ORDER BY title"
      : "SELECT url, title, category, subcategory, fetched_at FROM pages WHERE category = ? ORDER BY subcategory, title";
    const sql = hasPaging ? `${base} LIMIT ? OFFSET ?` : base;
    const stmt = this.db.prepare(sql);
    if (subcategory) {
      return hasPaging
        ? (stmt.all(category, subcategory, limit, offset ?? 0) as DocMeta[])
        : (stmt.all(category, subcategory) as DocMeta[]);
    }
    return hasPaging
      ? (stmt.all(category, limit, offset ?? 0) as DocMeta[])
      : (stmt.all(category) as DocMeta[]);
  }

  countAllPages(): number {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM pages").get() as { count: number };
    return row.count;
  }

  listAllPages(limit?: number, offset?: number): DocMeta[] {
    const hasPaging = typeof limit === "number";
    const base =
      "SELECT url, title, category, subcategory, fetched_at FROM pages ORDER BY category, subcategory, title";
    const sql = hasPaging ? `${base} LIMIT ? OFFSET ?` : base;
    const stmt = this.db.prepare(sql);
    return hasPaging ? (stmt.all(limit, offset ?? 0) as DocMeta[]) : (stmt.all() as DocMeta[]);
  }

  listCategories(): { category: string; subcategory: string; count: number }[] {
    const stmt = this.db.prepare(
      "SELECT category, subcategory, COUNT(*) as count FROM pages GROUP BY category, subcategory ORDER BY category, subcategory"
    );
    return stmt.all() as { category: string; subcategory: string; count: number }[];
  }

  getStats(): { pages: number; lastFetchedAt: string | null } {
    const row = this.db
      .prepare("SELECT COUNT(*) as pages, MAX(fetched_at) as lastFetchedAt FROM pages")
      .get() as { pages: number; lastFetchedAt: string | null };
    return row;
  }

  close(): void {
    this.db.close();
  }
}
