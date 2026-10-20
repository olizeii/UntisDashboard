import "server-only";

import {
  addDays,
  isoToUntisDate,
  startOfWeek,
  untisDateToIso,
  untisTimeToMinutes,
  formatMinutes,
} from "@/lib/time";
import { cached, mapLimit } from "./cache";
import { UntisClient } from "./client";
import type { UntisConfig } from "./config";
import { UntisError, toUntisError } from "./errors";
import {
  ELEMENT_TYPE_ID,
  type ElementRef,
  type ElementType,
  type Lesson,
  type Substitution,
  type SubstitutionType,
  type Timegrid,
  type UntisElement,
} from "./types";

/** Abstraction over the real WebUntis API and the demo data generator. */
export interface UntisDataSource {
  readonly mode: "live" | "demo";
  readonly sessionSince?: number;
  checkConnection(): Promise<void>;
  getTeachers(): Promise<UntisElement[]>;
  getClasses(): Promise<UntisElement[]>;
  getRooms(): Promise<UntisElement[]>;
  getSubjects(): Promise<UntisElement[]>;
  getTimegrid(): Promise<Timegrid>;
  /** Timetable of one element for an inclusive date range (ISO dates). */
  getTimetable(type: ElementType, id: number, from: string, to: string): Promise<Lesson[]>;
  getSubstitutions(from: string, to: string): Promise<Substitution[]>;
  /** Reports which WebUntis queries the configured account may use. */
  diagnose?(): Promise<DiagnosticCheck[]>;
  /** Teacher list from the weekly timetables of the given classes (when getTeachers is empty). */
  listTeachersFromWeekly?(classIds: number[], monday: string): Promise<UntisElement[]>;
}

export interface DiagnosticCheck {
  name: string;
  ok: boolean;
  detail: string;
}

// ---------------------------------------------------------------------------
// Raw WebUntis JSON-RPC shapes
// ---------------------------------------------------------------------------

interface RawElement {
  id: number;
  name: string;
  longName?: string;
  foreName?: string;
  building?: string;
  active?: boolean;
}

interface RawRef {
  id: number;
  name?: string;
  longname?: string;
  orgid?: number;
  orgname?: string;
}

interface RawPeriod {
  id: number;
  date: number;
  startTime: number;
  endTime: number;
  kl?: RawRef[];
  te?: RawRef[];
  su?: RawRef[];
  ro?: RawRef[];
  lstype?: string;
  code?: "cancelled" | "irregular";
  lstext?: string;
  substText?: string;
  info?: string;
  sg?: string;
}

interface RawSubstitution {
  type: string;
  lsid: number;
  date: number;
  startTime: number;
  endTime: number;
  kl?: RawRef[];
  te?: RawRef[];
  su?: RawRef[];
  ro?: RawRef[];
  txt?: string;
}

interface RawTimegridDay {
  /** 1 = Sunday … 7 = Saturday */
  day: number;
  timeUnits: { name: string; startTime: number; endTime: number }[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapRef(ref: RawRef): ElementRef {
  return {
    id: ref.id,
    name: ref.name ?? "?",
    longName: ref.longname || undefined,
    original:
      ref.orgid || ref.orgname ? { id: ref.orgid, name: ref.orgname ?? "?" } : undefined,
  };
}

function mapPeriod(p: RawPeriod): Lesson {
  const startMin = untisTimeToMinutes(p.startTime);
  const endMin = untisTimeToMinutes(p.endTime);
  const teachers = (p.te ?? []).map(mapRef);
  const rooms = (p.ro ?? []).map(mapRef);
  return {
    id: p.id,
    date: untisDateToIso(p.date),
    start: formatMinutes(startMin),
    end: formatMinutes(endMin),
    startMin,
    endMin,
    classes: (p.kl ?? []).map(mapRef),
    teachers,
    subjects: (p.su ?? []).map(mapRef),
    rooms,
    status: p.code ?? "regular",
    lessonType: p.lstype,
    text: p.lstext || undefined,
    substText: p.substText || undefined,
    info: p.info || undefined,
    studentGroup: p.sg || undefined,
    teacherChanged: teachers.some((t) => t.original),
    roomChanged: rooms.some((r) => r.original),
  };
}

const KNOWN_SUBST_TYPES = new Set<SubstitutionType>([
  "cancel",
  "subst",
  "add",
  "shift",
  "rmchg",
  "rmlk",
  "bs",
  "free",
  "exam",
]);

function mapSubstitution(s: RawSubstitution): Substitution {
  const startMin = untisTimeToMinutes(s.startTime);
  const endMin = untisTimeToMinutes(s.endTime);
  const type = KNOWN_SUBST_TYPES.has(s.type as SubstitutionType)
    ? (s.type as SubstitutionType)
    : "other";
  return {
    id: `${s.lsid}-${s.date}-${s.startTime}-${type}`,
    type,
    date: untisDateToIso(s.date),
    start: formatMinutes(startMin),
    end: formatMinutes(endMin),
    startMin,
    endMin,
    classes: (s.kl ?? []).map(mapRef),
    teachers: (s.te ?? []).map(mapRef),
    subjects: (s.su ?? []).map(mapRef),
    rooms: (s.ro ?? []).map(mapRef),
    text: s.txt || undefined,
  };
}

function mapElements(type: ElementType, raw: RawElement[]): UntisElement[] {
  return raw
    .filter((e) => e.active !== false)
    .map((e) => ({
      id: e.id,
      type,
      name: e.name,
      longName:
        type === "teacher"
          ? [e.longName, e.foreName].filter(Boolean).join(" ") || undefined
          : e.longName || undefined,
      building: e.building || undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

const REF_FIELDS = ["id", "name", "longname", "externalkey"];

// ---------------------------------------------------------------------------
// Weekly web endpoint (/api/public/timetable/weekly/data), as used by the web UI
// ---------------------------------------------------------------------------

const WEEKLY_TEACHER_TYPE = 2;
const WEEKLY_SUBJECT_TYPE = 3;

interface RawWeeklyPeriod {
  id: number;
  date: number;
  startTime: number;
  elements?: { type: number; id: number; orgId?: number }[];
}

interface RawWeeklyResponse {
  data?: {
    error?: { code?: number; message?: string };
    result?: {
      data?: {
        elementPeriods?: Record<string, RawWeeklyPeriod[]>;
        elements?: { type: number; id: number; name?: string; longName?: string; displayname?: string }[];
      };
    };
  };
}

interface WeeklyTeacherMap {
  periods: number;
  /** All teachers listed in the response */
  teachers: UntisElement[];
  /** period id -> teachers */
  byId: Map<number, ElementRef[]>;
  /** "date|startMin|subjectId" -> teachers (fallback when period ids differ) */
  bySlot: Map<string, ElementRef[]>;
}

function mapWeeklyTeachers(res: RawWeeklyResponse): WeeklyTeacherMap {
  if (res.data?.error) {
    throw new UntisError("rpc", `Wochenansicht: ${res.data.error.message ?? "Fehler"}`, res.data.error.code);
  }
  const data = res.data?.result?.data;
  const teacherNames = new Map<number, { name?: string; longName?: string }>();
  for (const e of data?.elements ?? []) {
    if (e.type === WEEKLY_TEACHER_TYPE) {
      teacherNames.set(e.id, { name: e.name || e.displayname, longName: e.longName || undefined });
    }
  }

  const result: WeeklyTeacherMap = {
    periods: 0,
    teachers: [...teacherNames]
      .filter(([, t]) => t.name)
      .map(([id, t]) => ({ id, type: "teacher" as const, name: t.name!, longName: t.longName })),
    byId: new Map(),
    bySlot: new Map(),
  };
  for (const periods of Object.values(data?.elementPeriods ?? {})) {
    for (const p of periods) {
      result.periods++;
      const teachers: ElementRef[] = [];
      for (const e of p.elements ?? []) {
        if (e.type !== WEEKLY_TEACHER_TYPE) continue;
        const current = teacherNames.get(e.id);
        if (!current?.name) continue; // hidden for this account
        const changed = e.orgId && e.orgId !== e.id;
        teachers.push({
          id: e.id,
          name: current.name,
          longName: current.longName,
          original: changed ? { id: e.orgId, name: teacherNames.get(e.orgId!)?.name ?? "?" } : undefined,
        });
      }
      if (teachers.length === 0) continue;
      const subject = (p.elements ?? []).find((e) => e.type === WEEKLY_SUBJECT_TYPE)?.id ?? 0;
      result.byId.set(p.id, teachers);
      result.bySlot.set(`${untisDateToIso(p.date)}|${untisTimeToMinutes(p.startTime)}|${subject}`, teachers);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

export class LiveUntisSource implements UntisDataSource {
  readonly mode = "live" as const;
  private readonly client: UntisClient;

  constructor(private readonly config: UntisConfig) {
    this.client = new UntisClient(config);
  }

  get sessionSince() {
    return this.client.sessionSince;
  }

  async checkConnection() {
    // Cheap authenticated call – logs in if needed, reuses the session otherwise.
    await this.client.call<number>("getLatestImportTime");
  }

  async getTeachers() {
    return mapElements("teacher", await this.client.call<RawElement[]>("getTeachers"));
  }

  async getClasses() {
    return mapElements("class", await this.client.call<RawElement[]>("getKlassen"));
  }

  async getRooms() {
    return mapElements("room", await this.client.call<RawElement[]>("getRooms"));
  }

  async getSubjects() {
    return mapElements("subject", await this.client.call<RawElement[]>("getSubjects"));
  }

  async getTimegrid(): Promise<Timegrid> {
    const raw = await this.client.call<RawTimegridDay[]>("getTimegridUnits");
    const grid: Timegrid = {};
    for (const day of raw) {
      // Untis: 1 = Sunday … 7 = Saturday  ->  ISO: 1 = Monday … 7 = Sunday
      const isoDay = day.day === 1 ? 7 : day.day - 1;
      grid[isoDay] = day.timeUnits.map((u) => {
        const startMin = untisTimeToMinutes(u.startTime);
        const endMin = untisTimeToMinutes(u.endTime);
        return {
          name: u.name,
          start: formatMinutes(startMin),
          end: formatMinutes(endMin),
          startMin,
          endMin,
        };
      });
    }
    return grid;
  }

  private async rpcTimetable(type: ElementType, id: number, from: string, to: string) {
    const raw = await this.client.call<RawPeriod[]>("getTimetable", {
      options: {
        element: { id, type: ELEMENT_TYPE_ID[type] },
        startDate: isoToUntisDate(from),
        endDate: isoToUntisDate(to),
        showLsText: true,
        showStudentgroup: true,
        showSubstText: true,
        showInfo: true,
        showLsNumber: false,
        klasseFields: REF_FIELDS,
        teacherFields: REF_FIELDS,
        subjectFields: REF_FIELDS,
        roomFields: REF_FIELDS,
      },
    });
    return raw.map(mapPeriod).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
  }

  async getTimetable(type: ElementType, id: number, from: string, to: string) {
    const lessons = await this.rpcTimetable(type, id, from, to);
    // Student accounts often get timetables without teachers via JSON-RPC. The web UI's
    // weekly endpoint may still include them, so fill the gap from there.
    if (lessons.length > 0 && lessons.every((l) => l.teachers.length === 0) && !this.weeklyUnavailable.has(type)) {
      await this.fillTeachersFromWeekly(type, id, lessons);
    }
    return lessons;
  }

  /** Element types for which the weekly web endpoint failed – we stop asking for those. */
  private weeklyUnavailable = new Set<ElementType>();

  private weeklyTeachers(type: ElementType, id: number, monday: string) {
    return cached(`weekly:${type}:${id}:${monday}`, 5 * 60_000, async () => {
      const res = await this.client.getJson<RawWeeklyResponse>("api/public/timetable/weekly/data", {
        elementType: String(ELEMENT_TYPE_ID[type]),
        elementId: String(id),
        date: monday,
        formatId: "1",
      });
      return mapWeeklyTeachers(res);
    });
  }

  private async fillTeachersFromWeekly(type: ElementType, id: number, lessons: Lesson[]) {
    const mondays = [...new Set(lessons.map((l) => startOfWeek(l.date)))];
    try {
      const maps = await Promise.all(mondays.map((m) => this.weeklyTeachers(type, id, m)));
      for (const lesson of lessons) {
        const slot = `${lesson.date}|${lesson.startMin}|${lesson.subjects[0]?.id ?? 0}`;
        const teachers = maps.map((m) => m.byId.get(lesson.id) ?? m.bySlot.get(slot)).find((t) => t?.length);
        if (teachers) {
          lesson.teachers = teachers;
          lesson.teacherChanged = teachers.some((t) => t.original);
        }
      }
    } catch (error) {
      this.weeklyUnavailable.add(type);
      console.warn(`[untis] Wochenansicht nicht verfügbar – Lehrkräfte bleiben leer: ${toUntisError(error).message}`);
    }
  }

  async listTeachersFromWeekly(classIds: number[], monday: string): Promise<UntisElement[]> {
    const results = await mapLimit(classIds, this.config.maxConcurrency, (id) =>
      this.weeklyTeachers("class", id, monday),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0 && failures.length === results.length) {
      throw (failures[0] as PromiseRejectedResult).reason;
    }
    const byId = new Map<number, UntisElement>();
    for (const r of results) {
      if (r.status === "fulfilled") for (const t of r.value.teachers) byId.set(t.id, t);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }

  async diagnose(): Promise<DiagnosticCheck[]> {
    const checks: DiagnosticCheck[] = [];
    const run = async (name: string, fn: () => Promise<string>) => {
      try {
        checks.push({ name, ok: true, detail: await fn() });
      } catch (error) {
        checks.push({ name, ok: false, detail: toUntisError(error).message });
      }
    };

    let firstClass: UntisElement | undefined;
    await run("Anmeldung", async () => {
      await this.client.call<number>("getLatestImportTime");
      return this.config.secret ? "per App-Secret" : "per Passwort";
    });
    await run("getKlassen", async () => {
      const classes = await this.getClasses();
      firstClass = classes[0];
      return `${classes.length} Klassen`;
    });
    await run("getTeachers", async () => `${(await this.getTeachers()).length} Lehrkräfte`);
    await run("getRooms", async () => `${(await this.getRooms()).length} Räume`);
    await run("getSubjects", async () => `${(await this.getSubjects()).length} Gegenstände`);

    // A school day: today, or next Monday on weekends
    const today = new Date().toISOString().slice(0, 10);
    const weekend = [0, 6].includes(new Date().getDay());
    const day = weekend ? addDays(startOfWeek(today), 7) : today;
    await run(`getSubstitutions (${day})`, async () => `${(await this.getSubstitutions(day, day)).length} Einträge`);

    await run("Lehrerverzeichnis (TEACHER_DIRECTORY_URL)", async () => {
      const { loadTeacherDirectory } = await import("./teacher-directory");
      const entries = await loadTeacherDirectory();
      return entries.length ? `${entries.length} Namen geladen` : "nicht konfiguriert";
    });

    const cls = firstClass;
    if (cls) {
      await run(`getTimetable Klasse ${cls.name} (${day})`, async () => {
        const lessons = await this.rpcTimetable("class", cls.id, day, day);
        const withTeacher = lessons.filter((l) => l.teachers.length > 0).length;
        return `${lessons.length} Stunden, davon ${withTeacher} mit Lehrkraft`;
      });
      await run(`Wochenansicht Klasse ${cls.name}`, async () => {
        const map = await this.weeklyTeachers("class", cls.id, startOfWeek(day));
        const names = [...new Set([...map.byId.values()].flat().map((t) => t.name))];
        return (
          `${map.periods} Stunden, davon ${map.byId.size} mit Lehrkraft` +
          (names.length ? ` (z. B. ${names.slice(0, 3).join(", ")})` : "")
        );
      });
    }
    return checks;
  }

  async getSubstitutions(from: string, to: string) {
    const raw = await this.client.call<RawSubstitution[]>("getSubstitutions", {
      startDate: isoToUntisDate(from),
      endDate: isoToUntisDate(to),
      departmentId: 0,
    });
    return raw.map(mapSubstitution);
  }
}
