// Domain types shared between server and client.
// Raw WebUntis JSON-RPC shapes live in ./raw-types.ts (server only).

export type ElementType = "teacher" | "class" | "room" | "subject";

/** WebUntis element type ids used by getTimetable. */
export const ELEMENT_TYPE_ID: Record<ElementType, number> = {
  class: 1,
  teacher: 2,
  subject: 3,
  room: 4,
};

export interface UntisElement {
  id: number;
  type: ElementType;
  /** Short name / Kürzel, e.g. "HUB", "3AHIT", "E104" */
  name: string;
  /** Long name, e.g. "Huber Maria", "Physiklabor" */
  longName?: string;
  /** Extra info for rooms (building) */
  building?: string;
  /** Teacher name was matched heuristically and may be wrong / incomplete */
  nameUncertain?: boolean;
}

export interface ElementRef {
  id: number;
  name: string;
  longName?: string;
  /** Originally planned element if this one was changed (substitution / room change) */
  original?: { id?: number; name: string };
}

export type LessonStatus = "regular" | "cancelled" | "irregular";

export interface Lesson {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  start: string;
  end: string;
  /** minutes since midnight */
  startMin: number;
  endMin: number;
  classes: ElementRef[];
  teachers: ElementRef[];
  subjects: ElementRef[];
  rooms: ElementRef[];
  status: LessonStatus;
  /** ls = lesson, oh = office hour, sb = standby, bs = break supervision, ex = exam */
  lessonType?: string;
  /** Free text attached to the lesson (lstext) */
  text?: string;
  /** Substitution text (substText) */
  substText?: string;
  info?: string;
  studentGroup?: string;
  teacherChanged: boolean;
  roomChanged: boolean;
}

export type SubstitutionType =
  | "cancel"
  | "subst"
  | "add"
  | "shift"
  | "rmchg"
  | "rmlk"
  | "bs"
  | "free"
  | "exam"
  | "other";

export interface Substitution {
  id: string;
  type: SubstitutionType;
  date: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  classes: ElementRef[];
  teachers: ElementRef[];
  subjects: ElementRef[];
  rooms: ElementRef[];
  text?: string;
}

export interface TimeUnit {
  name: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

/** Timegrid keyed by ISO weekday (1 = Monday … 7 = Sunday). */
export type Timegrid = Record<number, TimeUnit[]>;

export interface MasterData {
  teachers: UntisElement[];
  classes: UntisElement[];
  rooms: UntisElement[];
  subjects: UntisElement[];
  timegrid: Timegrid;
  /** "api" = from master data endpoints, "derived" = reconstructed from timetables */
  teacherSource: "api" | "derived";
  /** Where teacher full names come from */
  teacherNames: {
    source: "untis" | "directory" | "none";
    named: number;
    uncertain: number;
    error?: string;
  };
}

export type ElementState =
  | "in-lesson"
  | "break"
  | "free"
  | "before-school"
  | "after-school"
  | "no-lessons";

export interface ElementStatus {
  element: UntisElement;
  date: string;
  /** Reference time in minutes since midnight (school time zone) */
  atMin: number;
  /** True when the reference time is "now" (live) */
  live: boolean;
  state: ElementState;
  current: Lesson | null;
  /** End of the current block (double periods are merged), minutes since midnight */
  currentBlockEnd: number | null;
  next: Lesson | null;
  previous: Lesson | null;
  lessons: Lesson[];
  timegrid: TimeUnit[];
}

export interface RoomAvailability {
  room: UntisElement;
  /** Lesson currently occupying the room */
  occupiedBy: Lesson | null;
  /** Minutes since midnight when the room becomes busy next (null = free for the rest of the day) */
  freeUntilMin: number | null;
  /** Minutes since midnight when an occupied room becomes free again */
  busyUntilMin: number | null;
}

export interface FreeRoomsResult {
  date: string;
  atMin: number;
  live: boolean;
  free: RoomAvailability[];
  occupied: RoomAvailability[];
}

export interface PeriodUtilization {
  name: string;
  start: string;
  end: string;
  occupiedRooms: number;
  totalRooms: number;
  lessons: number;
}

export interface DashboardStats {
  date: string;
  atMin: number;
  live: boolean;
  lessonsToday: number;
  cancellations: number;
  substitutions: number;
  roomChanges: number;
  additional: number;
  roomsTotal: number;
  roomsOccupiedNow: number;
  teachersInLessonNow: number;
  teachersTotal: number;
  classesInLessonNow: number;
  classesTotal: number;
  utilization: PeriodUtilization[];
  upcomingChanges: Substitution[];
}

export interface ConnectionInfo {
  mode: "live" | "demo";
  school: string;
  server: string;
  timezone: string;
  ok: boolean;
  /** Last successful login (epoch ms) */
  sessionSince?: number;
  error?: ApiErrorBody;
}

export type UntisErrorKind =
  | "config"
  | "auth"
  | "permission"
  | "network"
  | "timeout"
  | "not-found"
  | "bad-request"
  | "rpc";

export interface ApiErrorBody {
  kind: UntisErrorKind;
  message: string;
  code?: number;
}
