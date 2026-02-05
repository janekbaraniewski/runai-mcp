#!/usr/bin/env tsx
/**
 * URL verification script for Run:ai documentation.
 * HEAD-requests all URLs in ALL_PAGES and reports failures.
 */

import { ALL_PAGES, type DocPage } from "./urls.js";

const CONCURRENCY = 10;

async function checkUrl(page: DocPage): Promise<{ page: DocPage; status: number; ok: boolean }> {
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
  console.log(`Verifying ${ALL_PAGES.length} URLs...\n`);

  const results: { page: DocPage; status: number; ok: boolean }[] = [];

  for (let i = 0; i < ALL_PAGES.length; i += CONCURRENCY) {
    const batch = ALL_PAGES.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(checkUrl));
    results.push(...batchResults);

    // Progress indicator
    const done = Math.min(i + CONCURRENCY, ALL_PAGES.length);
    process.stderr.write(`\r  ${done}/${ALL_PAGES.length} checked`);
  }

  console.log("\n");

  const failures = results.filter((r) => !r.ok);
  const successes = results.filter((r) => r.ok);

  if (failures.length > 0) {
    console.log(`FAILURES (${failures.length}):`);
    for (const f of failures) {
      console.log(`  ${f.status} ${f.page.url} [${f.page.category}/${f.page.subcategory}] "${f.page.title}"`);
    }
    console.log();
  }

  console.log(`OK: ${successes.length}/${ALL_PAGES.length}`);
  console.log(`FAIL: ${failures.length}/${ALL_PAGES.length}`);

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
