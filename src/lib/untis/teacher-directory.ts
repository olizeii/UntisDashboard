import "server-only";

import { cached } from "./cache";
import type { DirectoryEntry } from "./teacher-names";

const DAY = 24 * 60 * 60 * 1000;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", quot: '"', apos: "'", lt: "<", gt: ">",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  eacute: "é", egrave: "è", aacute: "á", oacute: "ó", iacute: "í", ccedil: "ç",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code] ?? match;
  });
}

/**
 * Parses a staff list in the format of the HTL Hollabrunn website
 * (`<b>Nachname Vorname</b>&nbsp;Titel</div>` per person).
 */
export function parseTeacherDirectory(html: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  for (const m of html.matchAll(/<b>([\s\S]*?)<\/b>([\s\S]*?)<\/div>/g)) {
    const name = decodeEntities(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const [surname, ...first] = name.split(" ");
    if (!surname || first.length === 0) continue;
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    entries.push({ surname, firstName: first.join(" "), title: title || undefined });
  }
  return entries;
}

/** Loads and caches the staff directory (24 h). Returns [] if not configured. */
export async function loadTeacherDirectory(): Promise<DirectoryEntry[]> {
  const url = process.env.TEACHER_DIRECTORY_URL?.trim();
  if (!url) return [];
  return cached(`teacher-directory:${url}`, DAY, async () => {
    const response = await fetch(url, {
      headers: { Accept: "text/html", "User-Agent": "untis-dashboard (teacher directory)" },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const entries = parseTeacherDirectory(await response.text());
    if (entries.length === 0) throw new Error("keine Einträge gefunden – hat sich das Seitenformat geändert?");
    return entries;
  });
}
