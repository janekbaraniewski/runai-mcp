import type { DocRow, DocMeta, SearchResult } from "./db/docs-db.js";

export function formatTable(
  headers: string[],
  rows: string[][],
  opts?: { maxColWidth?: number },
): string {
  if (rows.length === 0) {
    return headers.map((h) => h.toUpperCase()).join("  ") + "\n(none)";
  }

  const maxWidth = opts?.maxColWidth ?? 60;
  const colCount = headers.length;

  const widths = headers.map((h) => h.length);
  for (const row of rows) {
    for (let i = 0; i < colCount; i++) {
      const cell = row[i] ?? "";
      widths[i] = Math.min(Math.max(widths[i], cell.length), maxWidth);
    }
  }

  function pad(value: string, width: number): string {
    if (value.length > width) {
      return value.slice(0, width - 3) + "...";
    }
    return value.padEnd(width);
  }

  const headerLine = headers.map((h, i) => pad(h.toUpperCase(), widths[i])).join("  ");
  const dataLines = rows.map((row) =>
    row
      .slice(0, colCount)
      .map((cell, i) => pad(cell ?? "", widths[i]))
      .join("  "),
  );

  return [headerLine, ...dataLines].join("\n");
}

export function formatSearchResults(
  results: SearchResult[],
  query: string,
  context: { docset?: string; version?: string },
): string {
  const header = `Search: "${query}" in ${context.docset ?? "all"}/${context.version ?? "all"} (${results.length} result(s))`;
  if (results.length === 0) return header;

  const table = formatTable(
    ["Title", "Category", "Snippet"],
    results.map((r) => [
      r.title,
      `${r.category}/${r.subcategory}`,
      (r.snippet ?? "").replace(/>>>>/g, "").replace(/<<<<>/g, "").replace(/<<<</, "").replace(/\n+/g, " ").trim(),
    ]),
    { maxColWidth: 50 },
  );
  return `${header}\n${table}`;
}

export function formatPageList(
  pages: DocMeta[],
  context: { docset?: string; version?: string },
): string {
  const table = formatTable(
    ["Title", "Subcategory", "URL"],
    pages.map((p) => [p.title, p.subcategory, p.url]),
    { maxColWidth: 60 },
  );
  return table;
}

export function formatSections(
  sections: { category: string; subcategory: string; count: number; docset?: string; version?: string }[],
): string {
  const table = formatTable(
    ["Category", "Subcategory", "Pages"],
    sections.map((s) => [s.category, s.subcategory, String(s.count)]),
  );
  return `Sections (${sections.length})\n${table}`;
}

export function formatPageHeader(
  page: DocRow,
  context: { docset?: string; version?: string },
): string {
  const lines = [
    `Title:    ${page.title}`,
    `URL:      ${page.url}`,
    `Docset:   ${page.docset ?? context.docset ?? "unknown"}`,
    `Version:  ${page.version ?? context.version ?? "unknown"}`,
    `Category: ${page.category}/${page.subcategory}`,
    `Fetched:  ${page.fetched_at ?? "unknown"}`,
  ];
  return lines.join("\n");
}

export function formatDocsets(docsets: { id: string; label: string; base_url: string; versioned: boolean }[]): string {
  const table = formatTable(
    ["ID", "Label", "Base URL", "Versioned"],
    docsets.map((d) => [d.id, d.label, d.base_url, d.versioned ? "yes" : "no"]),
    { maxColWidth: 50 },
  );
  return `Docsets (${docsets.length})\n${table}`;
}

export function formatVersions(
  versions: { docset: string; version: string; is_latest?: boolean; source?: string | null }[],
  docset?: string,
): string {
  const table = formatTable(
    ["Docset", "Version", "Latest", "Source"],
    versions.map((v) => [v.docset, v.version, v.is_latest ? "yes" : "no", v.source ?? ""]),
  );
  const label = docset ? `Versions for ${docset}` : "Versions";
  return `${label} (${versions.length})\n${table}`;
}

export function formatStats(stats: {
  docset: string;
  version: string;
  pages: number;
  last_fetched_at: string | null;
}): string {
  return [
    `Docset:   ${stats.docset}`,
    `Version:  ${stats.version}`,
    `Pages:    ${stats.pages}`,
    `Fetched:  ${stats.last_fetched_at ?? "unknown"}`,
  ].join("\n");
}
