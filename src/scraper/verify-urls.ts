#!/usr/bin/env tsx
/**
 * URL verification script for Run:ai documentation.
 * HEAD-requests all configured URLs across docsets/versions and reports failures.
 */

import { buildDocEntries, type DocEntry } from "./docsets.js";

const CONCURRENCY = 10;

async function checkUrl(page: DocEntry): Promise<{ page: DocEntry; status: number; ok: boolean }> {
  try {
    const resp = await fetch(page.url, {
      method: "HEAD",
      headers: { "User-Agent": "RunAI-MCP-Scraper/1.0" },
      redirect: "follow",
    });
    return { page, status: resp.status, ok: resp.ok };
  } catch (err) {
    return { page, status: 0, ok: false };
  }
}

async function main() {
  const { entries } = buildDocEntries();
  console.log(`Verifying ${entries.length} URLs...\n`);

  const results: { page: DocEntry; status: number; ok: boolean }[] = [];

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(checkUrl));
    results.push(...batchResults);

    // Progress indicator
    const done = Math.min(i + CONCURRENCY, entries.length);
    process.stderr.write(`\r  ${done}/${entries.length} checked`);
  }

  console.log("\n");

  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok);

  if (failures.length > 0) {
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) {
      console.log(
        `  ${f.status} ${f.page.url} [${f.page.docset} ${f.page.version} ${f.page.category}/${f.page.subcategory}] "${f.page.title}"`
      );
    }
    console.log();
  }

  console.log(`OK: ${successes.length}/${entries.length}`);
  console.log(`FAIL: ${failures.length}/${entries.length}`);

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
