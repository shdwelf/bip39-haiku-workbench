/** Small, deliberately forgiving importer for journal haiku files. */
export interface ImportedHaiku {
  title: string;
  lines: [string, string, string];
  body: string;
  sourceName?: string;
}

function cleanLine(line: string): string {
  return line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();
}

function fromLines(raw: string[], sourceName?: string): ImportedHaiku | null {
  const lines = raw.map(cleanLine).filter(Boolean);
  if (lines.length < 3) return null;
  const poem = lines.slice(-3) as [string, string, string];
  const title = lines.length > 3 ? lines[0].replace(/^#+\s*/, "") : sourceName?.replace(/\.[^.]+$/, "") || "Untitled haiku";
  return { title: title.trim() || "Untitled haiku", lines: poem, body: poem.join("\n"), sourceName };
}

/**
 * Parse one journal file. Accepts three-line text/markdown and a small JSON
 * shape ({title, lines}) so exports from other writing tools are easy to bring
 * into the workbench. Blank lines separate multiple poems; the first poem is
 * returned because a file is represented by one journal chapter.
 */
export function parseHaikuText(text: string, sourceName?: string): ImportedHaiku | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const value: unknown = JSON.parse(trimmed);
    if (value && typeof value === "object") {
      const record = value as { title?: unknown; lines?: unknown; haiku?: unknown };
      const lines = record.lines ?? record.haiku;
      if (Array.isArray(lines)) {
        const parsed = fromLines(lines.filter((x): x is string => typeof x === "string"), sourceName);
        if (parsed && typeof record.title === "string" && record.title.trim()) parsed.title = record.title.trim();
        return parsed;
      }
    }
  } catch {
    // Plain text and markdown are the normal format.
  }
  const heading = trimmed.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/)?.[1];
  const block = trimmed.split(/\n\s*\n/).find((part) => part.split(/\r?\n/).filter(Boolean).length >= 3);
  if (!block) return null;
  const parsed = fromLines(block.split(/\r?\n/), sourceName);
  if (parsed && heading) parsed.title = heading;
  return parsed;
}

export function haikuChapterBody(haiku: ImportedHaiku, attachmentName: string): string {
  return `${haiku.body}\n\n[[file:${attachmentName}]]`;
}
