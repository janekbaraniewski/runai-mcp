#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const sourceDbPath = path.resolve("src/data/runai-docs.db");
const targetDbPath = path.resolve("dist/data/runai-docs.db");

if (!fs.existsSync(sourceDbPath)) {
  console.error(
    `Missing source database at ${sourceDbPath}. Run "npm run scrape" before staging release assets.`
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
fs.copyFileSync(sourceDbPath, targetDbPath);

const sizeBytes = fs.statSync(targetDbPath).size;
console.log(`Staged docs database: ${targetDbPath} (${sizeBytes} bytes)`);
