import {
  ALL_PAGES,
  LEGACY_PAGES,
  MULTI_TENANT_PAGES,
  SAAS_PAGES,
  VERSION_TOKEN,
  type DocPage,
} from "./urls.js";

export interface DocEntry extends DocPage {
  docset: string;
  version: string;
}

export interface DocsetMeta {
  id: string;
  label: string;
  baseUrl: string;
  versioned: boolean;
}

const DEFAULT_VERSIONS = ["2.24"];
const DEFAULT_DOCSETS = ["self-hosted", "api", "saas", "multi-tenant"];

const DOCSETS: DocsetMeta[] = [
  { id: "self-hosted", label: "Self-hosted", baseUrl: "https://run-ai-docs.nvidia.com/self-hosted", versioned: true },
  { id: "api", label: "Run:ai Management API", baseUrl: "https://run-ai-docs.nvidia.com/api", versioned: true },
  { id: "saas", label: "SaaS", baseUrl: "https://run-ai-docs.nvidia.com/saas", versioned: false },
  { id: "multi-tenant", label: "Multi-tenant", baseUrl: "https://run-ai-docs.nvidia.com/multi-tenant", versioned: true },
  { id: "legacy", label: "Legacy (docs.run.ai)", baseUrl: "https://docs.run.ai", versioned: true },
];

export function resolveDocsetsFromEnv(): string[] {
  const raw = process.env.RUNAI_DOCS_DOCSETS;
  if (!raw) {
    return DEFAULT_DOCSETS;
  }
  const parsed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_DOCSETS;
}

export function resolveVersionsFromEnv(): string[] {
  const raw = process.env.RUNAI_DOCS_VERSIONS;
  if (!raw) {
    return DEFAULT_VERSIONS;
  }
  const parsed = raw
    .split(",")
    .map((value) => value.trim().replace(/^v/i, ""))
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_VERSIONS;
}

export function listDocsets(): DocsetMeta[] {
  return DOCSETS.slice();
}

export function buildDocEntries(): {
  docsets: DocsetMeta[];
  docsetVersions: Map<string, string[]>;
  entries: DocEntry[];
} {
  const selectedDocsets = new Set(resolveDocsetsFromEnv());
  const versions = resolveVersionsFromEnv();

  const docsetVersions = new Map<string, string[]>();
  const entries: DocEntry[] = [];

  const selfHostedPages = ALL_PAGES.filter((page) => page.url.includes("/self-hosted/"));
  const apiPages = ALL_PAGES.filter((page) => page.url.includes("/api/2.24/"));

  if (selectedDocsets.has("self-hosted")) {
    docsetVersions.set("self-hosted", versions);
    for (const version of versions) {
      for (const page of selfHostedPages) {
        entries.push({
          ...page,
          docset: "self-hosted",
          version,
          // Keep canonical self-hosted URL as-is. Some installations expose
          // unversioned paths, and runtime tools now handle both forms.
          url: page.url,
        });
      }
    }
  }

  if (selectedDocsets.has("api")) {
    docsetVersions.set("api", versions);
    for (const version of versions) {
      for (const page of apiPages) {
        entries.push({
          ...page,
          docset: "api",
          version,
          url: page.url.replace("/api/2.24/", `/api/${version}/`),
        });
      }
    }
  }

  if (selectedDocsets.has("saas")) {
    docsetVersions.set("saas", ["latest"]);
    for (const page of SAAS_PAGES) {
      entries.push({ ...page, docset: "saas", version: "latest" });
    }
  }

  if (selectedDocsets.has("multi-tenant")) {
    docsetVersions.set("multi-tenant", versions);
    for (const version of versions) {
      for (const page of MULTI_TENANT_PAGES) {
        entries.push({
          ...page,
          docset: "multi-tenant",
          version,
          url: page.url.replaceAll(VERSION_TOKEN, version),
        });
      }
    }
  }

  if (selectedDocsets.has("legacy")) {
    docsetVersions.set("legacy", versions);
    for (const version of versions) {
      for (const page of LEGACY_PAGES) {
        entries.push({
          ...page,
          docset: "legacy",
          version,
          url: page.url.replaceAll(VERSION_TOKEN, version),
        });
      }
    }
  }

  const deduped: DocEntry[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.docset}|${entry.version}|${entry.url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(entry);
  }

  const activeDocsets = DOCSETS.filter((docset) => selectedDocsets.has(docset.id));

  return { docsets: activeDocsets, docsetVersions, entries: deduped };
}
