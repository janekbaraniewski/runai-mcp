import { z } from "zod";

export const DEFAULT_SEARCH_LIMIT = 10;
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_LIST_LIMIT = 100;
export const MAX_LIST_LIMIT = 200;
export const DEFAULT_MAX_CONTENT_CHARS = 12000;
export const MAX_CONTENT_CHARS = 50000;

export const PageRefSchema = z.object({
  docset: z.string(),
  version: z.string(),
  url: z.string(),
  title: z.string(),
  category: z.string(),
  subcategory: z.string(),
  fetched_at: z.string().nullable().optional(),
  resource_uri: z.string(),
});

export const PageSchema = PageRefSchema.extend({
  content_md: z.string().optional(),
  content_truncated: z.boolean().optional(),
});

export const SearchResultSchema = PageRefSchema.extend({
  snippet: z.string(),
  rank: z.number(),
});

export const SearchOutputSchema = z.object({
  query: z.string(),
  limit: z.number(),
  offset: z.number(),
  count: z.number(),
  docset: z.string(),
  version: z.string().optional(),
  results: z.array(SearchResultSchema),
});

export const GetPageOutputSchema = z.object({
  kind: z.enum(["page", "matches", "not_found"]),
  page: PageSchema.optional(),
  matches: z.array(PageRefSchema).optional(),
  query: z
    .object({
      url: z.string().optional(),
      title: z.string().optional(),
      docset: z.string().optional(),
      version: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
});

export const PageResultSchema = z.object({
  kind: z.enum(["page", "not_found"]),
  page: PageSchema.optional(),
  query: z.record(z.string(), z.string()).optional(),
  message: z.string().optional(),
});

export const SectionSchema = z.object({
  docset: z.string(),
  version: z.string(),
  category: z.string(),
  subcategory: z.string(),
  count: z.number(),
});

export const ListSectionsOutputSchema = z.object({
  total_sections: z.number(),
  sections: z.array(SectionSchema),
});

export const ListPagesOutputSchema = z.object({
  docset: z.string(),
  version: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  limit: z.number(),
  offset: z.number(),
  total: z.number(),
  pages: z.array(PageRefSchema),
});

export const StatsOutputSchema = z.object({
  docset: z.string(),
  version: z.string(),
  pages: z.number(),
  last_fetched_at: z.string().nullable(),
});

export const DocsetSchema = z.object({
  id: z.string(),
  label: z.string(),
  base_url: z.string(),
  versioned: z.boolean(),
});

export const ListDocsetsOutputSchema = z.object({
  total_docsets: z.number(),
  docsets: z.array(DocsetSchema),
});

export const VersionSchema = z.object({
  docset: z.string(),
  version: z.string(),
  is_latest: z.boolean().optional(),
  release_date: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export const ListVersionsOutputSchema = z.object({
  docset: z.string().optional(),
  versions: z.array(VersionSchema),
});

export const contentOptionsSchema = z.object({
  include_content: z.boolean().optional().default(false),
  max_chars: z
    .number()
    .int()
    .min(500)
    .max(MAX_CONTENT_CHARS)
    .optional()
    .default(DEFAULT_MAX_CONTENT_CHARS),
});

export const docContextSchema = z.object({
  docset: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Docset (self-hosted, saas, multi-tenant, api; legacy optional). Use 'all' to search across docsets."),
  version: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Run:ai version (e.g., 2.24). Use 'latest' for newest or 'all' for all versions."),
});
