import "server-only";

import { addDays, isIsoDate, isoWeekday, parseTime, startOfWeek, zonedNow } from "@/lib/time";
import { cached, mapLimit } from "./cache";
import { getUntisConfig, peekUntisConfig } from "./config";
import { deriveSubstitutions } from "./derive";
import { UntisError, toUntisError } from "./errors";
import { MockUntisSource } from "./mock";
import { computeStatus } from "./status";
import { LiveUntisSource, type UntisDataSource } from "./source";
import type {
  ConnectionInfo,
  DashboardStats,
  ElementRef,
  ElementStatus,
  ElementType,
  FreeRoomsResult,
  Lesson,
  MasterData,
  RoomAvailability,
  Substitution,
  UntisElement,
} from "./types";

const MINUTE = 60_000;
const TTL = {
  master: 6 * 60 * MINUTE,
  today: 2 * MINUTE,
  otherDay: 15 * MINUTE,
  substitutions: 3 * MINUTE,
  connection: MINUTE,
};

// ---------------------------------------------------------------------------
// Data source singleton
// ---------------------------------------------------------------------------

const globalState = globalThis as unknown as {
  __untisSource?: UntisDataSource;
  /** Element types for which direct timetable queries are not permitted (-8509). */
  __untisDenied?: Set<string>;
};
const denied = (globalState.__untisDenied ??= new Set());

function getSource(): UntisDataSource {
  if (!globalState.__untisSource) {
    const config = getUntisConfig();
    globalState.__untisSource = config.mock
      ? new MockUntisSource()
      : new LiveUntisSource(config);
  }
  return globalState.__untisSource;
}

export function getTimezone() {
  return peekUntisConfig().config?.timezone ?? "Europe/Vienna";
}

function isPermissionError(error: unknown) {
  return error instanceof UntisError && error.kind === "permission";
}

// ---------------------------------------------------------------------------
// Moment ("now" or a chosen date/time in school time)
// ---------------------------------------------------------------------------

export interface Moment {
  date: string;
  atMin: number;
  live: boolean;
  today: string;
}

export function resolveMoment(date?: string | null, time?: string | null): Moment {
  const now = zonedNow(Date.now(), getTimezone());
  const targetDate = isIsoDate(date) ? date : now.date;
  const parsedTime = time ? parseTime(time) : NaN;
  if (!Number.isNaN(parsedTime)) {
    return { date: targetDate, atMin: parsedTime, live: false, today: now.date };
  }
  return { date: targetDate, atMin: now.minutes, live: targetDate === now.date, today: now.date };
}

function dayTtl(date: string) {
  return date === zonedNow(Date.now(), getTimezone()).date ? TTL.today : TTL.otherDay;
}

// ---------------------------------------------------------------------------
// Master data
// ---------------------------------------------------------------------------

function deriveElements(type: "teacher" | "room", lessons: Lesson[]): UntisElement[] {
  const map = new Map<number, UntisElement>();
  for (const lesson of lessons) {
    for (const r of type === "teacher" ? lesson.teachers : lesson.rooms) {
      if (r.id && !map.has(r.id)) map.set(r.id, { id: r.id, type, name: r.name, longName: r.longName });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}

async function loadMasterData(): Promise<MasterData> {
  const source = getSource();
  const [classes, subjects, timegrid, teachersResult, roomsResult] = await Promise.all([
    source.getClasses(),
    source.getSubjects().catch(() => []),
    source.getTimegrid().catch(() => ({})),
    source.getTeachers().then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    ),
    source.getRooms().then(
      (value) => ({ ok: true as const, value }),
      (error) => ({ ok: false as const, error }),
    ),
  ]);

  let teachers: UntisElement[] = [];
  let rooms: UntisElement[] = [];
  let teacherSource: MasterData["teacherSource"] = "api";

  const needsDerived =
    (!teachersResult.ok && isPermissionError(teachersResult.error)) ||
    (!roomsResult.ok && isPermissionError(roomsResult.error));
  for (const r of [teachersResult, roomsResult]) {
    if (!r.ok && !isPermissionError(r.error)) throw r.error;
  }

  if (needsDerived) {
    // Reconstruct missing master data from this week's class timetables.
    const monday = startOfWeek(resolveMoment().date);
    const week = await Promise.all(
      [0, 1, 2, 3, 4].map((i) => aggregateDay(addDays(monday, i), classes)),
    );
    const lessons = week.flat();
    if (!teachersResult.ok) {
      teachers = deriveElements("teacher", lessons);
      teacherSource = "derived";
    }
    if (!roomsResult.ok) rooms = deriveElements("room", lessons);
  }
  if (teachersResult.ok) teachers = teachersResult.value;
  if (roomsResult.ok) rooms = roomsResult.value;

  return { teachers, classes, rooms, subjects, timegrid, teacherSource };
}

export function getMasterData(): Promise<MasterData> {
  return cached("master", TTL.master, loadMasterData);
}

export async function findElement(type: ElementType, id: number): Promise<UntisElement> {
  const master = await getMasterData();
  const list =
    type === "teacher"
      ? master.teachers
      : type === "class"
        ? master.classes
        : type === "room"
          ? master.rooms
          : master.subjects;
  const element = list.find((e) => e.id === id);
  if (!element) throw new UntisError("not-found", "Das gesuchte Element wurde nicht gefunden.");
  return element;
}

// ---------------------------------------------------------------------------
// Timetables
// ---------------------------------------------------------------------------

/** All lessons of a day, aggregated from every class timetable (deduplicated). */
async function aggregateDay(date: string, classes: UntisElement[]): Promise<Lesson[]> {
  return cached(`day:${date}`, dayTtl(date), async () => {
    const source = getSource();
    const { maxConcurrency } = getUntisConfig();
    const results = await mapLimit(classes, maxConcurrency, (c) =>
      getClassTimetable(source, c.id, date),
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length === results.length && failures.length > 0) {
      throw (failures[0] as PromiseRejectedResult).reason;
    }
    const byId = new Map<number, Lesson>();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const lesson of r.value) if (!byId.has(lesson.id)) byId.set(lesson.id, lesson);
    }
    return [...byId.values()].sort((a, b) => a.startMin - b.startMin);
  });
}

function getClassTimetable(source: UntisDataSource, id: number, date: string) {
  return cached(`tt:class:${id}:${date}`, dayTtl(date), () =>
    source.getTimetable("class", id, date, date),
  );
}

export async function getDayLessons(date: string): Promise<Lesson[]> {
  const master = await getMasterData();
  return aggregateDay(date, master.classes);
}

function refsOf(lesson: Lesson, type: ElementType): ElementRef[] {
  switch (type) {
    case "teacher":
      return lesson.teachers;
    case "class":
      return lesson.classes;
    case "room":
      return lesson.rooms;
    case "subject":
      return lesson.subjects;
  }
}

/**
 * Timetable of one element for a single day. Tries the direct query first and
 * falls back to the aggregated day if the account lacks permission.
 */
export async function getElementLessons(
  type: ElementType,
  id: number,
  date: string,
): Promise<Lesson[]> {
  const source = getSource();
  if (type === "class") return getClassTimetable(source, id, date);

  if (!denied.has(type)) {
    try {
      return await cached(`tt:${type}:${id}:${date}`, dayTtl(date), () =>
        source.getTimetable(type, id, date, date),
      );
    } catch (error) {
      if (!isPermissionError(error)) throw error;
      denied.add(type);
    }
  }
  const day = await getDayLessons(date);
  return day.filter((l) => refsOf(l, type).some((r) => r.id === id));
}

export async function getElementStatus(
  type: ElementType,
  id: number,
  moment: Moment,
): Promise<ElementStatus> {
  const [element, lessons, master] = await Promise.all([
    findElement(type, id),
    getElementLessons(type, id, moment.date),
    getMasterData(),
  ]);
  return {
    element,
    date: moment.date,
    atMin: moment.atMin,
    live: moment.live,
    ...computeStatus(lessons, moment.atMin),
    lessons,
    timegrid: master.timegrid[isoWeekday(moment.date)] ?? [],
  };
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export async function getFreeRooms(moment: Moment): Promise<FreeRoomsResult> {
  const [master, lessons] = await Promise.all([getMasterData(), getDayLessons(moment.date)]);
  const at = moment.atMin;
  const active = lessons.filter((l) => l.status !== "cancelled");

  const byRoom = new Map<number, Lesson[]>();
  for (const l of active) {
    for (const r of l.rooms) byRoom.set(r.id, [...(byRoom.get(r.id) ?? []), l]);
  }

  const free: RoomAvailability[] = [];
  const occupied: RoomAvailability[] = [];
  for (const room of master.rooms) {
    const roomLessons = (byRoom.get(room.id) ?? []).sort((a, b) => a.startMin - b.startMin);
    const occupiedBy = roomLessons.find((l) => l.startMin <= at && at < l.endMin) ?? null;
    if (occupiedBy) {
      let busyUntil = occupiedBy.endMin;
      for (const l of roomLessons) {
        if (l.startMin >= busyUntil && l.startMin - busyUntil <= 15) busyUntil = Math.max(busyUntil, l.endMin);
      }
      occupied.push({ room, occupiedBy, freeUntilMin: null, busyUntilMin: busyUntil });
    } else {
      const nextLesson = roomLessons.find((l) => l.startMin > at);
      free.push({ room, occupiedBy: null, freeUntilMin: nextLesson?.startMin ?? null, busyUntilMin: null });
    }
  }

  free.sort(
    (a, b) =>
      (b.freeUntilMin ?? 24 * 60) - (a.freeUntilMin ?? 24 * 60) ||
      a.room.name.localeCompare(b.room.name, "de", { numeric: true }),
  );
  occupied.sort((a, b) => a.room.name.localeCompare(b.room.name, "de", { numeric: true }));
  return { date: moment.date, atMin: at, live: moment.live, free, occupied };
}

// ---------------------------------------------------------------------------
// Substitutions
// ---------------------------------------------------------------------------

export interface SubstitutionResult {
  from: string;
  to: string;
  items: Substitution[];
  source: "api" | "derived";
}

export async function getSubstitutions(from: string, to: string): Promise<SubstitutionResult> {
  return cached(`subst:${from}:${to}`, TTL.substitutions, async () => {
    const source = getSource();
    if (!denied.has("substitutions")) {
      try {
        const items = await source.getSubstitutions(from, to);
        items.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
        return { from, to, items, source: "api" as const };
      } catch (error) {
        if (!isPermissionError(error)) throw error;
        denied.add("substitutions");
      }
    }
    const days: string[] = [];
    for (let d = from; d <= to && days.length < 14; d = addDays(d, 1)) {
      if (isoWeekday(d) <= 6) days.push(d);
    }
    const lessons = (await Promise.all(days.map(getDayLessons))).flat();
    return { from, to, items: deriveSubstitutions(lessons), source: "derived" as const };
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getDashboardStats(moment: Moment): Promise<DashboardStats> {
  const [master, lessons, subst] = await Promise.all([
    getMasterData(),
    getDayLessons(moment.date),
    getSubstitutions(moment.date, moment.date),
  ]);
  const at = moment.atMin;
  const active = lessons.filter((l) => l.status !== "cancelled");
  const now = active.filter((l) => l.startMin <= at && at < l.endMin);
  const unique = (refs: ElementRef[]) => new Set(refs.map((r) => r.id)).size;

  const units = master.timegrid[isoWeekday(moment.date)] ?? [];
  const utilization = units.map((u) => {
    const mid = (u.startMin + u.endMin) / 2;
    const inUnit = active.filter((l) => l.startMin <= mid && mid < l.endMin);
    return {
      name: u.name,
      start: u.start,
      end: u.end,
      lessons: inUnit.length,
      occupiedRooms: unique(inUnit.flatMap((l) => l.rooms)),
      totalRooms: master.rooms.length,
    };
  });

  const count = (...types: Substitution["type"][]) =>
    subst.items.filter((s) => types.includes(s.type)).length;

  return {
    date: moment.date,
    atMin: at,
    live: moment.live,
    lessonsToday: active.length,
    cancellations: count("cancel"),
    substitutions: count("subst"),
    roomChanges: count("rmchg", "rmlk"),
    additional: count("add", "shift", "exam"),
    roomsTotal: master.rooms.length,
    roomsOccupiedNow: unique(now.flatMap((l) => l.rooms)),
    teachersInLessonNow: unique(now.flatMap((l) => l.teachers)),
    teachersTotal: master.teachers.length,
    classesInLessonNow: unique(now.flatMap((l) => l.classes)),
    classesTotal: master.classes.length,
    utilization,
    upcomingChanges: subst.items
      .filter((s) => !moment.live || s.endMin > at)
      .slice(0, 8),
  };
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export async function getConnectionInfo(): Promise<ConnectionInfo> {
  const { config, error } = peekUntisConfig();
  const base = {
    mode: config?.mock ? ("demo" as const) : ("live" as const),
    school: config?.school ?? "",
    server: config?.server ?? "",
    timezone: getTimezone(),
  };
  if (!config) return { ...base, ok: false, error: error!.toJSON() };

  try {
    await cached("connection", TTL.connection, () => getSource().checkConnection());
    return { ...base, ok: true, sessionSince: getSource().sessionSince };
  } catch (e) {
    return { ...base, ok: false, error: toUntisError(e).toJSON() };
  }
}
