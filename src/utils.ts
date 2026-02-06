import { z } from "zod";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DocsDatabase, DocMeta, DocRow, SearchResult } from "./db/docs-db.js";
import { PageRefSchema, PageSchema, DEFAULT_MAX_CONTENT_CHARS } from "./schemas.js";

export const DEFAULT_DOCSET = process.env.RUNAI_DOCS_DOCSET ?? "self-hosted";
export const DEFAULT_VERSION = process.env.RUNAI_DOCS_VERSION ?? "latest";
export const DEFAULT_FALLBACK_VERSION = process.env.RUNAI_DOCS_LATEST_VERSION ?? "2.24";
export const MAX_MATCHES = 5;
export const MAX_COMPLETE_RESULTS = 25;

export function normalizeDocset(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["selfhosted", "self_hosted", "self-hosted"].includes(normalized)) return "self-hosted";
  if (["multitenant", "multi_tenant", "multi-tenant", "mt"].includes(normalized)) return "multi-tenant";
  if (["saas", "cloud"].includes(normalized)) return "saas";
  if (["api", "api-docs", "apidocs"].includes(normalized)) return "api";
  if (["legacy", "docs.run.ai", "docs-run-ai"].includes(normalized)) return "legacy";
  return normalized;
}

export function normalizeVersion(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "latest" || normalized === "current") return "latest";
  if (normalized === "all" || normalized === "*") return "all";
  return normalized.startsWith("v") ? normalized.slice(1) : normalized;
}

export function isAll(value?: string): boolean {
  return value === "all" || value === "*";
}

export function resolveContext(
  db: DocsDatabase,
  input: { docset?: string; version?: string }
): { docset?: string; version?: string; requestedDocset?: string; requestedVersion?: string } {
  const requestedDocset = normalizeDocset(input.docset);
  const requestedVersion = normalizeVersion(input.version);

  let docset: string | undefined = requestedDocset ?? DEFAULT_DOCSET;
  if (isAll(docset)) {
    docset = undefined;
  }

  let version: string | undefined = requestedVersion ?? DEFAULT_VERSION;
  if (isAll(version)) {
    version = undefined;
  }

  if (!docset && version === "latest") {
    version = undefined;
  }

  if (docset && version === "latest") {
    version = db.getLatestVersion(docset) ?? DEFAULT_FALLBACK_VERSION;
  }

  return { docset, version, requestedDocset, requestedVersion };
}

export function resolveFixedDocsetContext(
  db: DocsDatabase,
  docset: string,
  version?: string
): { docset: string; version: string } | null {
  const context = resolveContext(db, { docset, version });
  if (!context.docset || !context.version) {
    return null;
  }
  return { docset: context.docset, version: context.version };
}

export function toResourceUri(docset: string, version: string, url: string): string {
  return `runai-docs://${docset}/${version}/page/${encodeURIComponent(url)}`;
}

export function decodeResourceUrl(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    throw new McpError(ErrorCode.InvalidParams, "Invalid resource URL encoding");
  }
}

export function resolvePageContext(
  page: DocMeta | DocRow,
  fallback?: { docset?: string; version?: string }
): { docset: string; version: string } {
  const docset = page.docset ?? fallback?.docset ?? DEFAULT_DOCSET;
  const version = page.version ?? fallback?.version ?? DEFAULT_FALLBACK_VERSION;
  return { docset, version };
}

export function pageToRef(page: DocMeta | DocRow, fallback?: { docset?: string; version?: string }): z.infer<typeof PageRefSchema> {
  const { docset, version } = resolvePageContext(page, fallback);
  return {
    docset,
    version,
    url: page.url,
    title: page.title,
    category: page.category,
    subcategory: page.subcategory,
    fetched_at: page.fetched_at,
    resource_uri: toResourceUri(docset, version, page.url),
  };
}

export function buildPageMarkdown(page: DocRow, fallback?: { docset?: string; version?: string }): string {
  const { docset, version } = resolvePageContext(page, fallback);
  return `# ${page.title}\n\nSource: ${page.url}\nDocset: ${docset}\nVersion: ${version}\nCategory: ${page.category}/${page.subcategory}\nFetched: ${page.fetched_at}\n\n${page.content_md}`;
}

export function truncateContent(content: string, maxChars: number): { content: string; truncated: boolean } {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }
  return { content: `${content.slice(0, Math.max(0, maxChars - 3))}...`, truncated: true };
}

export function pageWithContent(
  page: DocRow,
  includeContent: boolean,
  maxChars: number,
  fallback?: { docset?: string; version?: string }
): z.infer<typeof PageSchema> {
  const base = pageToRef(page, fallback);
  if (!includeContent) {
    return base;
  }
  const markdown = buildPageMarkdown(page, fallback);
  const truncated = truncateContent(markdown, maxChars);
  return {
    ...base,
    content_md: truncated.content,
    content_truncated: truncated.truncated,
  };
}

export function toResourceLink(meta: DocMeta | SearchResult | DocRow, fallback?: { docset?: string; version?: string }) {
  const { docset, version } = resolvePageContext(meta, fallback);
  const annotations = meta.fetched_at ? { lastModified: meta.fetched_at } : undefined;
  return {
    type: "resource_link" as const,
    uri: toResourceUri(docset, version, meta.url),
    name: meta.title,
    title: meta.title,
    description: `${docset}/${version} - ${meta.category}/${meta.subcategory}`,
    mimeType: "text/markdown",
    annotations,
  };
}

export function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}
