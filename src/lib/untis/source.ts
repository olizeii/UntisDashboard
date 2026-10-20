import "server-only";

import {
  isoToUntisDate,
  untisDateToIso,
  untisTimeToMinutes,
  formatMinutes,
} from "@/lib/time";
import { UntisClient } from "./client";
import type { UntisConfig } from "./config";
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
// Live implementation
// ---------------------------------------------------------------------------

export class LiveUntisSource implements UntisDataSource {
  readonly mode = "live" as const;
  private readonly client: UntisClient;

  constructor(config: UntisConfig) {
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

  async getTimetable(type: ElementType, id: number, from: string, to: string) {
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

  async getSubstitutions(from: string, to: string) {
    const raw = await this.client.call<RawSubstitution[]>("getSubstitutions", {
      startDate: isoToUntisDate(from),
      endDate: isoToUntisDate(to),
      departmentId: 0,
    });
    return raw.map(mapSubstitution);
  }
}
