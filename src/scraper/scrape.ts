#!/usr/bin/env tsx
import { JSDOM } from "jsdom";
import { NodeHtmlMarkdown } from "node-html-markdown";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { buildDocEntries, type DocEntry, type DocsetMeta } from "./docsets.js";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);

const DB_PATH = path.join(SCRIPT_DIR, "..", "data", "runai-docs.db");
const DOCS_DIR = path.join(SCRIPT_DIR, "..", "data", "docs");
const CONCURRENCY = 5;
const DELAY_MS = 500;
const ENABLE_LINK_DISCOVERY = (process.env.RUNAI_DOCS_DISCOVER_LINKS ?? "1") !== "0";
const MAX_DISCOVERED_PAGES = Number(process.env.RUNAI_DOCS_MAX_PAGES ?? "2000");
const MAX_DISCOVERED_LINKS_PER_PAGE = Number(process.env.RUNAI_DOCS_MAX_LINKS_PER_PAGE ?? "200");

const ALLOWED_HOSTS = new Set(["run-ai-docs.nvidia.com", "docs.run.ai"]);
const VERSION_RE = /^v?\d+\.\d+$/;

function initDb(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  db.exec(`
    DROP TABLE IF EXISTS pages;
    DROP TABLE IF EXISTS pages_fts;
    DROP TABLE IF EXISTS docsets;
    DROP TABLE IF EXISTS docset_versions;
    DROP TRIGGER IF EXISTS pages_ai;
    DROP TRIGGER IF EXISTS pages_ad;
    DROP TRIGGER IF EXISTS pages_au;
  `);

  db.exec(`
    CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      docset TEXT NOT NULL,
      version TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      content_plain TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      UNIQUE(docset, version, url)
    );

    CREATE VIRTUAL TABLE pages_fts USING fts5(
      title, content_plain, content='pages', content_rowid='id'
    );

    CREATE TRIGGER pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, content_plain)
      VALUES (new.id, new.title, new.content_plain);
    END;

    CREATE TRIGGER pages_ad AFTER DELETE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, content_plain)
      VALUES ('delete', old.id, old.title, old.content_plain);
    END;

    CREATE TRIGGER pages_au AFTER UPDATE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, content_plain)
      VALUES ('delete', old.id, old.title, old.content_plain);
      INSERT INTO pages_fts(rowid, title, content_plain)
      VALUES (new.id, new.title, new.content_plain);
    END;

    CREATE TABLE docsets (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      base_url TEXT NOT NULL,
      versioned INTEGER NOT NULL
    );

    CREATE TABLE docset_versions (
      docset TEXT NOT NULL,
      version TEXT NOT NULL,
      is_latest INTEGER NOT NULL DEFAULT 0,
      release_date TEXT NULL,
      source TEXT NULL,
      PRIMARY KEY (docset, version)
    );
  `);

  return db;
}

function compareVersions(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "latest") return 1;
  if (b === "latest") return -1;
  const [aMajor, aMinor] = a.split(".").map((n) => Number(n));
  const [bMajor, bMinor] = b.split(".").map((n) => Number(n));
  if (aMajor !== bMajor) return aMajor - bMajor;
  return (aMinor ?? 0) - (bMinor ?? 0);
}

function latestVersion(versions: string[]): string {
  if (versions.length === 0) return "latest";
  return versions.slice().sort(compareVersions).at(-1) ?? "latest";
}

function seedMetadata(db: Database.Database, docsets: DocsetMeta[], docsetVersions: Map<string, string[]>): void {
  const insertDocset = db.prepare(
    "INSERT OR REPLACE INTO docsets (id, label, base_url, versioned) VALUES (?, ?, ?, ?)"
  );
  for (const docset of docsets) {
    insertDocset.run(docset.id, docset.label, docset.baseUrl, docset.versioned ? 1 : 0);
  }

  const insertVersion = db.prepare(
    "INSERT OR REPLACE INTO docset_versions (docset, version, is_latest, release_date, source) VALUES (?, ?, ?, ?, ?)"
  );

  for (const [docset, versions] of docsetVersions.entries()) {
    const latest = latestVersion(versions);
    for (const version of versions) {
      insertVersion.run(docset, version, version === latest ? 1 : 0, null, "scrape");
    }
  }
}

async function fetchPage(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "RunAI-MCP-Scraper/1.0",
      Accept: "text/html",
    },
  });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}

function canonicalizeUrlForEntry(url: string, docset: string, version: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  parsed.search = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  const parts = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  if (docset === "self-hosted" && parts[0] === "self-hosted" && VERSION_RE.test(parts[1] ?? "")) {
    parts.splice(1, 1);
  }

  if (docset === "api" && parts[0] === "api") {
    if (VERSION_RE.test(parts[1] ?? "")) {
      parts[1] = version;
    } else {
      parts.splice(1, 0, version);
    }
  }

  if (docset === "multi-tenant" && parts[0] === "multi-tenant") {
    if (VERSION_RE.test(parts[1] ?? "")) {
      parts[1] = version;
    } else {
      parts.splice(1, 0, version);
    }
  }

  parsed.pathname = `/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
  return parsed.toString().replace(/\/+$/, "");
}

function buildFetchCandidates(page: DocEntry): string[] {
  const canonical = canonicalizeUrlForEntry(page.url, page.docset, page.version);
  const candidates = [canonical];

  if (page.docset === "self-hosted") {
    const withVersion = page.url.replace("/self-hosted/", `/self-hosted/${page.version}/`);
    const withoutVersion = page.url.replace(`/self-hosted/${page.version}/`, "/self-hosted/");
    candidates.push(withVersion, withoutVersion);
  }

  if (page.docset === "api") {
    candidates.push(page.url.replace(`/api/${page.version}/`, "/api/2.24/"));
  }

  const deduped = new Set<string>();
  return candidates.filter((candidate) => {
    if (deduped.has(candidate)) return false;
    deduped.add(candidate);
    return true;
  });
}

async function fetchPageWithFallback(page: DocEntry): Promise<{ fetchedUrl: string; html: string }> {
  let lastError: Error | null = null;
  for (const candidate of buildFetchCandidates(page)) {
    try {
      const html = await fetchPage(candidate);
      return { fetchedUrl: candidate, html };
    } catch (err) {
      lastError = err as Error;
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${page.url}`);
}

function htmlToMarkdown(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const main =
    doc.querySelector("main") ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector(".gitbook-root") ||
    doc.querySelector("article") ||
    doc.body;

  for (const sel of ["nav", "header", "footer", '[role="navigation"]', ".sidebar"]) {
    main.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const nhm = new NodeHtmlMarkdown();
  return nhm.translate(main.innerHTML);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (match) => match)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~`]/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeDocsUrl(href: string, baseUrl: string): string | null {
  try {
    const absolute = new URL(href, baseUrl);
    absolute.hash = "";
    absolute.search = "";
    if (!ALLOWED_HOSTS.has(absolute.hostname)) return null;
    if (!absolute.pathname || absolute.pathname === "/") return null;
    return absolute.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function extractInternalDocLinks(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const links = new Set<string>();
  for (const anchor of doc.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href");
    if (!href) continue;
    const normalized = normalizeDocsUrl(href, baseUrl);
    if (!normalized) continue;
    links.add(normalized);
    if (links.size >= MAX_DISCOVERED_LINKS_PER_PAGE) break;
  }
  return Array.from(links);
}

function titleFromUrl(url: string): string {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts.at(-1) ?? "page";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toSubcategory(parts: string[], fallback = "discovered"): string {
  if (parts.length === 0) return fallback;
  return parts[0].replace(/[^a-z0-9-]/gi, "").toLowerCase() || fallback;
}

function inferFromPath(docset: string, pathnameParts: string[]): { category: string; subcategory: string } {
  if (docset === "api") {
    const afterVersion = VERSION_RE.test(pathnameParts[1] ?? "") ? pathnameParts.slice(2) : pathnameParts.slice(1);
    return {
      category: "api",
      subcategory: toSubcategory(afterVersion, "general"),
    };
  }

  if (docset === "self-hosted") {
    const afterVersion = VERSION_RE.test(pathnameParts[1] ?? "") ? pathnameParts.slice(2) : pathnameParts.slice(1);
    const first = afterVersion[0] ?? "";
    if (first === "getting-started") return { category: "installation", subcategory: toSubcategory(afterVersion.slice(1), "general") };
    if (first === "infrastructure-setup") return { category: "infrastructure", subcategory: toSubcategory(afterVersion.slice(1), "general") };
    if (first === "platform-management") {
      if (afterVersion[1] === "runai-scheduler") return { category: "scheduler", subcategory: toSubcategory(afterVersion.slice(2), "general") };
      if (afterVersion[1] === "policies") return { category: "policies", subcategory: toSubcategory(afterVersion.slice(2), "general") };
      return { category: "platform", subcategory: toSubcategory(afterVersion.slice(1), "general") };
    }
    if (first === "reference" && afterVersion[1] === "cli") return { category: "cli", subcategory: toSubcategory(afterVersion.slice(2), "general") };
    if (first === "workloads-in-nvidia-run-ai" || first === "ai-applications") return { category: "workloads", subcategory: toSubcategory(afterVersion.slice(1), "general") };
    if (first === "settings") return { category: "platform", subcategory: "settings" };
    return { category: "self-hosted", subcategory: toSubcategory(afterVersion) };
  }

  if (docset === "saas") {
    return { category: "saas", subcategory: toSubcategory(pathnameParts.slice(1)) };
  }
  if (docset === "multi-tenant") {
    const afterVersion = VERSION_RE.test(pathnameParts[1] ?? "") ? pathnameParts.slice(2) : pathnameParts.slice(1);
    return { category: "multi-tenant", subcategory: toSubcategory(afterVersion) };
  }
  return { category: "legacy", subcategory: toSubcategory(pathnameParts.slice(1)) };
}

function inferDocEntryFromUrl(url: string, parent: DocEntry): DocEntry | null {
  const parsed = new URL(url);
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  let docset = parent.docset;
  let version = parent.version;

  if (parsed.hostname === "docs.run.ai") {
    docset = "legacy";
    const maybeVersion = parts[0] ?? "";
    if (VERSION_RE.test(maybeVersion)) {
      version = maybeVersion.replace(/^v/i, "");
    }
  } else if (parts[0] === "api") {
    docset = "api";
    const maybeVersion = parts[1] ?? "";
    if (VERSION_RE.test(maybeVersion)) {
      version = maybeVersion.replace(/^v/i, "");
    }
  } else if (parts[0] === "self-hosted") {
    docset = "self-hosted";
    const maybeVersion = parts[1] ?? "";
    if (VERSION_RE.test(maybeVersion)) {
      version = maybeVersion.replace(/^v/i, "");
    }
  } else if (parts[0] === "saas") {
    docset = "saas";
    version = "latest";
  } else if (parts[0] === "multi-tenant") {
    docset = "multi-tenant";
    const maybeVersion = parts[1] ?? "";
    if (VERSION_RE.test(maybeVersion)) {
      version = maybeVersion.replace(/^v/i, "");
    }
  } else {
    return null;
  }

  const { category, subcategory } = inferFromPath(docset, parts);
  const canonical = canonicalizeUrlForEntry(url, docset, version);
  return {
    url: canonical,
    docset,
    version,
    category,
    subcategory,
    title: titleFromUrl(url),
  };
}

function entryKey(entry: DocEntry): string {
  return `${entry.docset}|${entry.version}|${canonicalizeUrlForEntry(entry.url, entry.docset, entry.version)}`;
}

function isEntryAllowed(entry: DocEntry, allowedByDocset: Map<string, Set<string>>): boolean {
  const allowedVersions = allowedByDocset.get(entry.docset);
  if (!allowedVersions) {
    return false;
  }
  return allowedVersions.has(entry.version);
}

function writePageMarkdown(entry: DocEntry, markdown: string): void {
  const filePath = path.join(
    DOCS_DIR,
    entry.docset,
    entry.version,
    entry.category,
    entry.subcategory,
    `${slugify(entry.title)}.md`
  );
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `# ${entry.title}\n\nSource: ${entry.url}\nDocset: ${entry.docset}\nVersion: ${entry.version}\n\n${markdown}`
  );
}

async function scrapeAll(
  seedPages: DocEntry[],
  allowedByDocset: Map<string, Set<string>>,
  db: Database.Database
): Promise<void> {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO pages (docset, version, url, category, subcategory, title, content_md, content_plain, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const queue: DocEntry[] = [];
  const scheduled = new Set<string>();

  for (const page of seedPages) {
    const key = entryKey(page);
    if (scheduled.has(key)) continue;
    scheduled.add(key);
    queue.push(page);
  }

  let cursor = 0;
  while (cursor < queue.length && cursor < MAX_DISCOVERED_PAGES) {
    const batch = queue.slice(cursor, Math.min(cursor + CONCURRENCY, MAX_DISCOVERED_PAGES));
    cursor += batch.length;

    const results = await Promise.allSettled(
      batch.map(async (page) => {
        const { fetchedUrl, html } = await fetchPageWithFallback(page);
        const md = htmlToMarkdown(html);
        const plain = stripMarkdown(md);
        const links = ENABLE_LINK_DISCOVERY ? extractInternalDocLinks(html, fetchedUrl) : [];
        return { page, md, plain, links };
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") {
        console.error(`FAIL: ${(result.reason as Error).message}`);
        continue;
      }

      const { page, md, plain, links } = result.value;
      insert.run(
        page.docset,
        page.version,
        page.url,
        page.category,
        page.subcategory,
        page.title,
        md,
        plain,
        new Date().toISOString()
      );
      writePageMarkdown(page, md);
      console.log(`OK: [${page.docset} ${page.version}] ${page.title}`);

      if (!ENABLE_LINK_DISCOVERY) continue;

      for (const link of links) {
        if (queue.length >= MAX_DISCOVERED_PAGES) break;
        const discovered = inferDocEntryFromUrl(link, page);
        if (!discovered) continue;
        if (discovered.docset !== page.docset) continue;
        if (!isEntryAllowed(discovered, allowedByDocset)) {
          continue;
        }
        const key = entryKey(discovered);
        if (scheduled.has(key)) continue;
        scheduled.add(key);
        queue.push(discovered);
      }
    }

    if (cursor < queue.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  if (queue.length >= MAX_DISCOVERED_PAGES) {
    console.warn(`WARN: discovery capped at RUNAI_DOCS_MAX_PAGES=${MAX_DISCOVERED_PAGES}`);
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const { docsets, docsetVersions, entries } = buildDocEntries();
  const allowedByDocset = new Map<string, Set<string>>();
  for (const [docset, versions] of docsetVersions.entries()) {
    allowedByDocset.set(docset, new Set(versions));
  }
  console.log(`Scraping ${entries.length} seed pages across ${docsets.length} docsets...`);
  console.log(`Link discovery: ${ENABLE_LINK_DISCOVERY ? "enabled" : "disabled"} (max pages ${MAX_DISCOVERED_PAGES})`);

  const db = initDb(DB_PATH);

  try {
    seedMetadata(db, docsets, docsetVersions);
    await scrapeAll(entries, allowedByDocset, db);
    const count = db.prepare("SELECT COUNT(*) as n FROM pages").get() as { n: number };
    console.log(`\nDone. ${count.n} pages stored in ${DB_PATH}`);
  } finally {
    db.close();
  }
}

main().catch(console.error);
