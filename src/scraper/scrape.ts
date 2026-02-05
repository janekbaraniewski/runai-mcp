#!/usr/bin/env tsx
/**
 * Scraper for Run:ai documentation.
 * Fetches all pages, converts to markdown, and stores in SQLite.
 */

import { JSDOM } from "jsdom";
import { NodeHtmlMarkdown } from "node-html-markdown";
import Database from "better-sqlite3";
import { ALL_PAGES, type DocPage } from "./urls.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);

const DB_PATH = path.join(SCRIPT_DIR, "..", "data", "runai-docs.db");
const DOCS_DIR = path.join(SCRIPT_DIR, "..", "data", "docs");
const CONCURRENCY = 5;
const DELAY_MS = 500;

function initDb(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
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

function htmlToMarkdown(html: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Try to extract just the main content area
  const main =
    doc.querySelector("main") ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector(".gitbook-root") ||
    doc.querySelector("article") ||
    doc.body;

  // Remove nav, sidebar, footer
  for (const sel of ["nav", "header", "footer", '[role="navigation"]', ".sidebar"]) {
    main.querySelectorAll(sel).forEach((el) => el.remove());
  }

  const nhm = new NodeHtmlMarkdown();
  return nhm.translate(main.innerHTML);
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (match) => match) // keep code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> text
    .replace(/[#*_~`]/g, "") // strip formatting chars
    .replace(/\n{3,}/g, "\n\n"); // collapse whitespace
}

async function scrapeBatch(pages: DocPage[], db: Database.Database): Promise<void> {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO pages (url, category, subcategory, title, content_md, content_plain, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (page) => {
        const html = await fetchPage(page.url);
        const md = htmlToMarkdown(html);
        const plain = stripMarkdown(md);
        return { page, md, plain };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { page, md, plain } = result.value;
        insert.run(
          page.url,
          page.category,
          page.subcategory,
          page.title,
          md,
          plain,
          new Date().toISOString()
        );

        // Also save markdown file
        const filePath = path.join(
          DOCS_DIR,
          page.category,
          page.subcategory,
          `${slugify(page.title)}.md`
        );
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, `# ${page.title}\n\nSource: ${page.url}\n\n${md}`);

        console.log(`OK: ${page.title}`);
      } else {
        console.error(`FAIL: ${(result.reason as Error).message}`);
      }
    }

    if (i + CONCURRENCY < pages.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  console.log(`Scraping ${ALL_PAGES.length} pages...`);
  const db = initDb(DB_PATH);

  try {
    await scrapeBatch(ALL_PAGES, db);
    const count = db.prepare("SELECT COUNT(*) as n FROM pages").get() as { n: number };
    console.log(`\nDone. ${count.n} pages stored in ${DB_PATH}`);
  } finally {
    db.close();
  }
}

main().catch(console.error);
