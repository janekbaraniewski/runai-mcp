import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { DocsDatabase } from "../dist/db/docs-db.js";

function initDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      url TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      title TEXT NOT NULL,
      content_md TEXT NOT NULL,
      content_plain TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
      title, content_plain, content='pages', content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
      INSERT INTO pages_fts(rowid, title, content_plain)
      VALUES (new.rowid, new.title, new.content_plain);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, content_plain)
      VALUES ('delete', old.rowid, old.title, old.content_plain);
    END;

    CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
      INSERT INTO pages_fts(pages_fts, rowid, title, content_plain)
      VALUES ('delete', old.rowid, old.title, old.content_plain);
      INSERT INTO pages_fts(rowid, title, content_plain)
      VALUES (new.rowid, new.title, new.content_plain);
    END;
  `);
  return db;
}

test("DocsDatabase reads and searches", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "runai-mcp-test-"));
  const dbPath = path.join(tmpDir, "docs.db");
  const db = initDb(dbPath);

  const now = new Date().toISOString();
  const url = "https://run-ai-docs.nvidia.com/test/page";
  db.prepare(
    "INSERT OR REPLACE INTO pages (url, category, subcategory, title, content_md, content_plain, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(url, "installation", "requirements", "Sample Page", "Hello **World**", "hello world", now);
  db.prepare(
    "INSERT OR REPLACE INTO pages (url, category, subcategory, title, content_md, content_plain, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    "https://run-ai-docs.nvidia.com/test/another",
    "installation",
    "requirements",
    "Another Page",
    "Content",
    "content",
    now
  );
  db.close();

  const docs = new DocsDatabase(dbPath);
  const page = docs.getPage(url);
  assert.ok(page);
  assert.equal(page.title, "Sample Page");

  const results = docs.search("hello", 10, 0);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, url);

  const sections = docs.listCategories();
  assert.equal(sections.length, 1);
  assert.equal(sections[0].category, "installation");
  assert.equal(sections[0].subcategory, "requirements");
  assert.equal(sections[0].count, 2);

  const total = docs.countByCategory("installation");
  assert.equal(total, 2);

  const paged = docs.listByCategory("installation", 1, 0);
  assert.equal(paged.length, 1);

  const matches = docs.findPagesByTitle("Sample", 5);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].title, "Sample Page");

  const stats = docs.getStats();
  assert.equal(stats.pages, 2);

  docs.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
