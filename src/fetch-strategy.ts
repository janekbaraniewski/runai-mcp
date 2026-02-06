import { JSDOM } from "jsdom";
import { NodeHtmlMarkdown } from "node-html-markdown";
import type { DocsDatabase, DocRow } from "./db/docs-db.js";
import { PageCache } from "./cache.js";

export type FetchStrategy = "cache-first" | "live-first" | "cache-only";

export interface PageFetcherOptions {
  db: DocsDatabase;
  cache: PageCache;
  strategy?: FetchStrategy;
  timeoutMs?: number;
  allowedHosts?: Set<string>;
  liveLookupEnabled?: boolean;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_ALLOWED_HOSTS = new Set(["run-ai-docs.nvidia.com", "docs.run.ai"]);

export function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

export function buildUrlCandidates(url: string, context: { docset?: string; version?: string }): string[] {
  const candidates = [url];
  if (context.version) {
    if (context.docset === "self-hosted") {
      candidates.push(
        url.replace("/self-hosted/", `/self-hosted/${context.version}/`),
        url.replace(`/self-hosted/${context.version}/`, "/self-hosted/"),
      );
    }
    if (context.docset === "api") {
      candidates.push(
        url.replace("/api/2.24/", `/api/${context.version}/`),
        url.replace(`/api/${context.version}/`, "/api/2.24/"),
      );
    }
    if (context.docset === "multi-tenant") {
      candidates.push(
        url.replace("/multi-tenant/", `/multi-tenant/${context.version}/`),
        url.replace(`/multi-tenant/${context.version}/`, "/multi-tenant/"),
      );
    }
  }
  return uniqueStrings(candidates);
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (match) => match)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#*_~`]/g, "")
    .replace(/\n{3,}/g, "\n\n");
}

export function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split("/").filter(Boolean).at(-1) ?? "page";
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  } catch {
    return url;
  }
}

export function inferCategoryFromUrl(url: string, docset?: string): { category: string; subcategory: string } {
  try {
    const pathParts = new URL(url).pathname.split("/").filter(Boolean);
    if (docset === "self-hosted") {
      const idx = pathParts[0] === "self-hosted" ? 1 : 0;
      const afterVersion = /^\d+\.\d+$/.test(pathParts[idx] ?? "") ? pathParts.slice(idx + 1) : pathParts.slice(idx);
      const first = afterVersion[0] ?? "general";
      if (first === "getting-started") return { category: "installation", subcategory: afterVersion[1] ?? "general" };
      if (first === "infrastructure-setup")
        return { category: "infrastructure", subcategory: afterVersion[1] ?? "general" };
      if (first === "platform-management") return { category: "platform", subcategory: afterVersion[1] ?? "general" };
      if (first === "workloads-in-nvidia-run-ai" || first === "ai-applications")
        return { category: "workloads", subcategory: afterVersion[1] ?? "general" };
      if (first === "reference" && afterVersion[1] === "cli") return { category: "cli", subcategory: "overview" };
      return { category: "self-hosted", subcategory: first };
    }
    if (docset === "api") {
      const idx = pathParts[0] === "api" ? 1 : 0;
      const afterVersion = /^\d+\.\d+$/.test(pathParts[idx] ?? "") ? pathParts.slice(idx + 1) : pathParts.slice(idx);
      return { category: "api", subcategory: afterVersion[0] ?? "general" };
    }
    if (docset === "saas") {
      return { category: "saas", subcategory: pathParts[1] ?? "general" };
    }
    if (docset === "multi-tenant") {
      const idx = pathParts[0] === "multi-tenant" ? 1 : 0;
      const afterVersion = /^\d+\.\d+$/.test(pathParts[idx] ?? "") ? pathParts.slice(idx + 1) : pathParts.slice(idx);
      return { category: "multi-tenant", subcategory: afterVersion[0] ?? "general" };
    }
    return { category: pathParts[0] ?? "live", subcategory: pathParts[1] ?? "general" };
  } catch {
    return { category: "live", subcategory: docset ?? "general" };
  }
}

async function fetchLivePage(
  url: string,
  context: { docset?: string; version?: string },
  timeoutMs: number,
  allowedHosts: Set<string>,
): Promise<DocRow | null> {
  for (const candidate of buildUrlCandidates(url, context)) {
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      continue;
    }
    if (!allowedHosts.has(parsed.hostname)) {
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(candidate, {
        headers: {
          "User-Agent": "RunAI-MCP-LiveLookup/1.0",
          Accept: "text/html",
        },
        signal: controller.signal,
      });
      if (!resp.ok) {
        continue;
      }

      const html = await resp.text();
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const main =
        doc.querySelector("main") ||
        doc.querySelector('[role="main"]') ||
        doc.querySelector(".gitbook-root") ||
        doc.querySelector("article") ||
        doc.body;

      for (const selector of ["nav", "header", "footer", '[role="navigation"]', ".sidebar"]) {
        main.querySelectorAll(selector).forEach((el) => el.remove());
      }

      const md = new NodeHtmlMarkdown().translate(main.innerHTML);
      const plain = stripMarkdown(md);
      const title = doc.querySelector("h1")?.textContent?.trim() || doc.title?.trim() || titleFromUrl(candidate);
      const { category, subcategory } = inferCategoryFromUrl(candidate, context.docset);
      return {
        url: candidate,
        category,
        subcategory,
        title,
        content_md: md,
        content_plain: plain,
        fetched_at: new Date().toISOString(),
        docset: context.docset,
        version: context.version,
      };
    } catch {
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function getPageFromDbWithUrlFallback(
  db: DocsDatabase,
  url: string,
  context: { docset?: string; version?: string },
): DocRow | null {
  for (const candidate of buildUrlCandidates(url, context)) {
    const page = db.getPage(candidate, context);
    if (page) return page;
  }
  return null;
}

export class PageFetcher {
  private db: DocsDatabase;
  private cache: PageCache;
  private strategy: FetchStrategy;
  private timeoutMs: number;
  private allowedHosts: Set<string>;
  private networkEnabled: boolean;

  constructor(opts: PageFetcherOptions) {
    this.db = opts.db;
    this.cache = opts.cache;
    this.strategy = opts.strategy ?? "cache-first";
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.allowedHosts = opts.allowedHosts ?? DEFAULT_ALLOWED_HOSTS;

    const liveLookup = opts.liveLookupEnabled ?? true;
    if (!liveLookup) {
      this.strategy = "cache-only";
    }
    this.networkEnabled = this.strategy !== "cache-only";
  }

  async getPage(url: string, context: { docset?: string; version?: string }): Promise<DocRow | null> {
    switch (this.strategy) {
      case "cache-first":
        return this.cacheFirst(url, context);
      case "live-first":
        return this.liveFirst(url, context);
      case "cache-only":
        return this.cacheOnly(url, context);
      default:
        return this.cacheFirst(url, context);
    }
  }

  /** DB -> in-memory cache -> live fetch (current default behavior) */
  private async cacheFirst(url: string, context: { docset?: string; version?: string }): Promise<DocRow | null> {
    const dbPage = getPageFromDbWithUrlFallback(this.db, url, context);
    if (dbPage) return dbPage;

    const memKey = PageCache.key(context.docset, context.version, url);
    const cached = this.cache.get(memKey);
    if (cached) return cached;

    if (!this.networkEnabled) return null;

    const live = await fetchLivePage(url, context, this.timeoutMs, this.allowedHosts);
    if (live) {
      this.cache.set(memKey, live);
    }
    return live;
  }

  /** in-memory cache -> live fetch -> DB fallback */
  private async liveFirst(url: string, context: { docset?: string; version?: string }): Promise<DocRow | null> {
    const memKey = PageCache.key(context.docset, context.version, url);
    const cached = this.cache.get(memKey);
    if (cached) return cached;

    const live = await fetchLivePage(url, context, this.timeoutMs, this.allowedHosts);
    if (live) {
      this.cache.set(memKey, live);
      return live;
    }

    return getPageFromDbWithUrlFallback(this.db, url, context);
  }

  /** DB -> in-memory cache only, no network */
  private async cacheOnly(url: string, context: { docset?: string; version?: string }): Promise<DocRow | null> {
    const dbPage = getPageFromDbWithUrlFallback(this.db, url, context);
    if (dbPage) return dbPage;

    const memKey = PageCache.key(context.docset, context.version, url);
    return this.cache.get(memKey);
  }

  /** Sync DB-only lookup (used by resource handler which cannot be async) */
  getPageFromDb(url: string, context: { docset?: string; version?: string }): DocRow | null {
    return getPageFromDbWithUrlFallback(this.db, url, context);
  }
}
