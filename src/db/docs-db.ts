import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DB_FILENAME = "runai-docs.db";
const DEFAULT_DOCSET = "self-hosted";
const DEFAULT_VERSION = "2.24";

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
  docset?: string;
  version?: string;
}

export interface DocMeta {
  url: string;
  category: string;
  subcategory: string;
  title: string;
  fetched_at: string;
  docset?: string;
  version?: string;
}

export interface SearchResult {
  url: string;
  category: string;
  subcategory: string;
  title: string;
  snippet: string;
  rank: number;
  fetched_at: string;
  docset?: string;
  version?: string;
}

export interface DocsetInfo {
  id: string;
  label: string;
  base_url: string;
  versioned: number;
}

export interface DocsetVersionInfo {
  docset: string;
  version: string;
  is_latest: number;
  release_date: string | null;
  source: string | null;
}

export interface DocFilters {
  docset?: string;
  version?: string;
}

function normalizePath(p: string): string {
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

function resolveDbPath(explicit?: string): { path: string; source: string } {
  const candidates: { path: string; source: string }[] = [];

  if (explicit) {
    candidates.push({ path: normalizePath(explicit), source: "RUNAI_DOCS_DB" });
  }

  const repoSrcPath = path.resolve(MODULE_DIR, "..", "..", "src", "data", DEFAULT_DB_FILENAME);
  const distOrSrcDataPath = path.resolve(MODULE_DIR, "..", "data", DEFAULT_DB_FILENAME);

  candidates.push({ path: repoSrcPath, source: "repo:src" });
  if (distOrSrcDataPath !== repoSrcPath) {
    candidates.push({ path: distOrSrcDataPath, source: "module:data" });
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
  private hasDocsetColumn: boolean;
  private hasVersionColumn: boolean;
  private hasDocsetsTable: boolean;
  private hasDocsetVersionsTable: boolean;
  private legacyDocset: string;
  private legacyVersion: string;

  constructor(dbPath?: string) {
    const resolved = resolveDbPath(dbPath || process.env.RUNAI_DOCS_DB);
    this.dbPath = resolved.path;
    this.db = new Database(this.dbPath, { readonly: true });
    this.hasDocsetColumn = this.tableHasColumn("pages", "docset");
    this.hasVersionColumn = this.tableHasColumn("pages", "version");
    this.hasDocsetsTable = this.tableExists("docsets");
    this.hasDocsetVersionsTable = this.tableExists("docset_versions");
    this.legacyDocset = (process.env.RUNAI_DOCS_DOCSET || DEFAULT_DOCSET).trim() || DEFAULT_DOCSET;
    const envVersion = (process.env.RUNAI_DOCS_VERSION || DEFAULT_VERSION).trim();
    this.legacyVersion = envVersion.toLowerCase() === "latest" ? DEFAULT_VERSION : envVersion;
  }

  private tableExists(table: string): boolean {
    const row = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table) as { name?: string } | undefined;
    return Boolean(row && row.name);
  }

  private tableHasColumn(table: string, column: string): boolean {
    const rows = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    return rows.some((row) => row.name === column);
  }

  private withDefaults<T extends DocRow | DocMeta | SearchResult>(row: T): T {
    if (!row.docset) {
      row.docset = this.legacyDocset;
    }
    if (!row.version) {
      row.version = this.legacyVersion;
    }
    return row;
  }

  private buildFilterClause(filters: DocFilters, params: unknown[], alias: string): string {
    const clauses: string[] = [];
    if (filters.docset && this.hasDocsetColumn) {
      clauses.push(`${alias}.docset = ?`);
      params.push(filters.docset);
    }
    if (filters.version && this.hasVersionColumn) {
      clauses.push(`${alias}.version = ?`);
      params.push(filters.version);
    }
    return clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
  }

  search(
    query: string,
    options: { limit?: number; offset?: number } & DocFilters = {}
  ): SearchResult[] {
    const { limit = 10, offset = 0, docset, version } = options;
    const sanitized = this.sanitizeFts5Query(query);
    const params: unknown[] = [sanitized];
    const filterClause = this.buildFilterClause({ docset, version }, params, "p");
    const sql = `
      SELECT
        p.url,
        p.category,
        p.subcategory,
        p.title,
        p.fetched_at,
        ${this.hasDocsetColumn ? "p.docset" : "NULL as docset"},
        ${this.hasVersionColumn ? "p.version" : "NULL as version"},
        snippet(pages_fts, 1, '>>>>', '<<<<', '...', 64) as snippet,
        rank
      FROM pages_fts
      JOIN pages p ON pages_fts.rowid = p.rowid
      WHERE pages_fts MATCH ?${filterClause}
      ORDER BY rank
      LIMIT ?
      OFFSET ?
    `;
    params.push(limit, offset);
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as SearchResult[];
    return rows.map((row) => this.withDefaults(row));
  }

  private sanitizeFts5Query(query: string): string {
    const trimmed = query.trim();
    if (!trimmed) {
      return trimmed;
    }

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

  getPage(url: string, filters: DocFilters = {}): DocRow | null {
    const params: unknown[] = [url];
    const filterClause = this.buildFilterClause(filters, params, "p");
    const stmt = this.db.prepare(`SELECT * FROM pages p WHERE url = ?${filterClause} LIMIT 1`);
    const row = stmt.get(...params) as DocRow | undefined;
    return row ? this.withDefaults(row) : null;
  }

  findPagesByTitle(title: string, limit: number = 5, filters: DocFilters = {}): DocMeta[] {
    const params: unknown[] = [`%${title}%`];
    const filterClause = this.buildFilterClause(filters, params, "p");
    const stmt = this.db.prepare(
      `SELECT url, title, category, subcategory, fetched_at,
        ${this.hasDocsetColumn ? "docset" : "NULL as docset"},
        ${this.hasVersionColumn ? "version" : "NULL as version"}
       FROM pages p
       WHERE title LIKE ?${filterClause}
       ORDER BY CASE WHEN title = ? THEN 0 ELSE 1 END, length(title)
       LIMIT ?`
    );
    params.push(title, limit);
    const rows = stmt.all(...params) as DocMeta[];
    return rows.map((row) => this.withDefaults(row));
  }

  findPagesByUrlFragment(fragment: string, limit: number = 5, filters: DocFilters = {}): DocMeta[] {
    const params: unknown[] = [`%${fragment}%`];
    const filterClause = this.buildFilterClause(filters, params, "p");
    const stmt = this.db.prepare(
      `SELECT url, title, category, subcategory, fetched_at,
        ${this.hasDocsetColumn ? "docset" : "NULL as docset"},
        ${this.hasVersionColumn ? "version" : "NULL as version"}
       FROM pages p
       WHERE url LIKE ?${filterClause}
       ORDER BY length(url)
       LIMIT ?`
    );
    params.push(limit);
    const rows = stmt.all(...params) as DocMeta[];
    return rows.map((row) => this.withDefaults(row));
  }

  countByCategory(category: string, subcategory?: string, filters: DocFilters = {}): number {
    const params: unknown[] = [category];
    let sql = "SELECT COUNT(*) as count FROM pages p WHERE category = ?";
    if (subcategory) {
      sql += " AND subcategory = ?";
      params.push(subcategory);
    }
    sql += this.buildFilterClause(filters, params, "p");
    const stmt = this.db.prepare(sql);
    const row = stmt.get(...params) as { count: number };
    return row.count;
  }

  listByCategory(
    category: string,
    options: { limit?: number; offset?: number; subcategory?: string } & DocFilters = {}
  ): DocMeta[] {
    const { limit, offset, subcategory, docset, version } = options;
    const hasPaging = typeof limit === "number";
    const params: unknown[] = [category];
    let sql = `SELECT url, title, category, subcategory, fetched_at,
      ${this.hasDocsetColumn ? "docset" : "NULL as docset"},
      ${this.hasVersionColumn ? "version" : "NULL as version"}
      FROM pages p WHERE category = ?`;
    if (subcategory) {
      sql += " AND subcategory = ?";
      params.push(subcategory);
    }
    sql += this.buildFilterClause({ docset, version }, params, "p");
    sql += subcategory ? " ORDER BY title" : " ORDER BY subcategory, title";
    if (hasPaging) {
      sql += " LIMIT ? OFFSET ?";
      params.push(limit as number, offset ?? 0);
    }
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as DocMeta[];
    return rows.map((row) => this.withDefaults(row));
  }

  countAllPages(filters: DocFilters = {}): number {
    const params: unknown[] = [];
    let sql = "SELECT COUNT(*) as count FROM pages p WHERE 1 = 1";
    sql += this.buildFilterClause(filters, params, "p");
    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row.count;
  }

  listAllPages(options: { limit?: number; offset?: number } & DocFilters = {}): DocMeta[] {
    const { limit, offset, docset, version } = options;
    const hasPaging = typeof limit === "number";
    const params: unknown[] = [];
    let sql = `SELECT url, title, category, subcategory, fetched_at,
      ${this.hasDocsetColumn ? "docset" : "NULL as docset"},
      ${this.hasVersionColumn ? "version" : "NULL as version"}
      FROM pages p WHERE 1 = 1`;
    sql += this.buildFilterClause({ docset, version }, params, "p");
    sql += " ORDER BY category, subcategory, title";
    if (hasPaging) {
      sql += " LIMIT ? OFFSET ?";
      params.push(limit as number, offset ?? 0);
    }
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as DocMeta[];
    return rows.map((row) => this.withDefaults(row));
  }

  listCategories(filters: DocFilters = {}): { category: string; subcategory: string; count: number; docset?: string; version?: string }[] {
    const params: unknown[] = [];
    let sql =
      "SELECT category, subcategory, COUNT(*) as count" +
      (this.hasDocsetColumn ? ", docset" : "") +
      (this.hasVersionColumn ? ", version" : "") +
      " FROM pages p WHERE 1 = 1";
    sql += this.buildFilterClause(filters, params, "p");
    sql += " GROUP BY category, subcategory";
    if (this.hasDocsetColumn) sql += ", docset";
    if (this.hasVersionColumn) sql += ", version";
    sql += " ORDER BY category, subcategory";
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as { category: string; subcategory: string; count: number; docset?: string; version?: string }[];
    return rows.map((row) => ({
      ...row,
      docset: row.docset ?? this.legacyDocset,
      version: row.version ?? this.legacyVersion,
    }));
  }

  getStats(filters: DocFilters = {}): { pages: number; lastFetchedAt: string | null } {
    const params: unknown[] = [];
    let sql = "SELECT COUNT(*) as pages, MAX(fetched_at) as lastFetchedAt FROM pages p WHERE 1 = 1";
    sql += this.buildFilterClause(filters, params, "p");
    const row = this.db.prepare(sql).get(...params) as { pages: number; lastFetchedAt: string | null };
    return row;
  }

  listDocsets(): DocsetInfo[] {
    if (!this.hasDocsetsTable) {
      return [
        {
          id: this.legacyDocset,
          label: this.legacyDocset,
          base_url: "",
          versioned: 1,
        },
      ];
    }
    const stmt = this.db.prepare("SELECT id, label, base_url, versioned FROM docsets ORDER BY id");
    return stmt.all() as DocsetInfo[];
  }

  listVersions(docset?: string): DocsetVersionInfo[] {
    if (!this.hasDocsetVersionsTable) {
      const inferred = {
        docset: docset ?? this.legacyDocset,
        version: this.legacyVersion,
        is_latest: 1,
        release_date: null,
        source: "legacy",
      };
      return [inferred];
    }
    const stmt = docset
      ? this.db.prepare(
          "SELECT docset, version, is_latest, release_date, source FROM docset_versions WHERE docset = ? ORDER BY version"
        )
      : this.db.prepare(
          "SELECT docset, version, is_latest, release_date, source FROM docset_versions ORDER BY docset, version"
        );
    return (docset ? stmt.all(docset) : stmt.all()) as DocsetVersionInfo[];
  }

  getLatestVersion(docset: string): string | null {
    if (this.hasDocsetVersionsTable) {
      const row = this.db
        .prepare(
          "SELECT version FROM docset_versions WHERE docset = ? AND is_latest = 1 ORDER BY version DESC LIMIT 1"
        )
        .get(docset) as { version?: string } | undefined;
      return row?.version ?? null;
    }
    if (docset === this.legacyDocset) {
      return this.legacyVersion;
    }
    return null;
  }

  close(): void {
    this.db.close();
  }
}
