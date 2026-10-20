// Matches Untis teacher abbreviations (e.g. "KALA") to names from a staff directory
// that lists names without abbreviations. Pure functions, no framework imports.

export interface DirectoryEntry {
  surname: string;
  firstName: string;
  title?: string;
}

export type MatchConfidence = "override" | "exact" | "high" | "medium" | "low";

export interface NameMatch {
  /** "Nachname Vorname", or only the surname if several people share it */
  longName: string;
  confidence: MatchConfidence;
  /** True if only the surname is certain (several candidates share it) */
  partial?: boolean;
}

/** Lowercase ASCII: Ä -> ae, ß -> ss, strips everything except a–z. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) if (ch === needle[i]) i++;
  return i === needle.length;
}

/** Score how well an abbreviation fits a person (0 = no match). */
export function scoreMatch(abbreviation: string, entry: DirectoryEntry): number {
  const a = normalize(abbreviation);
  const surname = normalize(entry.surname);
  const parts = entry.surname.split(/[-\s]+/).map(normalize).filter(Boolean);
  const first = normalize(entry.firstName);
  if (a.length < 2 || !surname) return 0;

  if (a === surname || parts.includes(a)) return 100;
  if (surname.startsWith(a) || parts.some((p) => p.startsWith(a))) return 80;
  // surname prefix + first-name prefix, e.g. "EDR" = Ed(er) R(alf)
  for (let i = 2; i < a.length; i++) {
    if (surname.startsWith(a.slice(0, i)) && first.startsWith(a.slice(i))) return 60;
  }
  if (a[0] === surname[0] && isSubsequence(a, surname)) return 40;
  if (a[0] === surname[0] && isSubsequence(a, surname + first)) return 20;
  return 0;
}

const CONFIDENCE: Record<number, MatchConfidence> = { 100: "exact", 80: "high", 60: "high", 40: "medium", 20: "low" };

export const fullName = (e: DirectoryEntry) => `${e.surname} ${e.firstName}`.trim();

/**
 * Assigns directory entries to abbreviations. Strong matches are resolved first and
 * removed from the pool, which often disambiguates the rest (e.g. two "Eder").
 *
 * @param overrides abbreviation -> long name, always wins
 */
export function matchTeacherNames(
  abbreviations: string[],
  directory: DirectoryEntry[],
  overrides: Record<string, string> = {},
): Map<string, NameMatch> {
  const result = new Map<string, NameMatch>();
  const taken = new Set<DirectoryEntry>();
  const overrideKeys = new Map(Object.entries(overrides).map(([k, v]) => [k.toUpperCase(), v]));

  for (const abbr of abbreviations) {
    const override = overrideKeys.get(abbr.toUpperCase());
    if (!override) continue;
    result.set(abbr, { longName: override, confidence: "override" });
    const entry = directory.find((e) => normalize(fullName(e)) === normalize(override));
    if (entry) taken.add(entry);
  }

  const candidates = abbreviations
    .filter((a) => !result.has(a))
    .map((abbr) => ({
      abbr,
      scored: directory
        .map((entry) => ({ entry, score: scoreMatch(abbr, entry) }))
        .filter((c) => c.score > 0),
    }));

  for (const tier of [100, 80, 60, 40, 20]) {
    let changed = true;
    while (changed) {
      changed = false;
      // longer abbreviations are more specific – resolve them first
      const open = candidates
        .filter((c) => !result.has(c.abbr))
        .sort((x, y) => y.abbr.length - x.abbr.length);
      for (const c of open) {
        const free = c.scored.filter((s) => !taken.has(s.entry));
        const best = Math.max(0, ...free.map((s) => s.score));
        if (best < tier) continue;
        const top = free.filter((s) => s.score === best);
        if (top.length === 1) {
          taken.add(top[0].entry);
          result.set(c.abbr, { longName: fullName(top[0].entry), confidence: CONFIDENCE[best] });
          changed = true;
        }
      }
    }
  }

  // Still ambiguous: show the surname if all best candidates share it
  for (const c of candidates) {
    if (result.has(c.abbr)) continue;
    const free = c.scored.filter((s) => !taken.has(s.entry));
    const best = Math.max(0, ...free.map((s) => s.score));
    if (best < 80) continue;
    const surnames = new Set(free.filter((s) => s.score === best).map((s) => s.entry.surname));
    if (surnames.size === 1) {
      result.set(c.abbr, { longName: [...surnames][0], confidence: CONFIDENCE[best], partial: true });
    }
  }
  return result;
}

/** Parses "KÜRZEL=Nachname Vorname; KÜRZEL2=…" (from UNTIS_TEACHER_NAMES). */
export function parseOverrides(value: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of (value ?? "").split(";")) {
    const [abbr, ...name] = pair.split("=");
    if (abbr?.trim() && name.join("=").trim()) result[abbr.trim()] = name.join("=").trim();
  }
  return result;
}
