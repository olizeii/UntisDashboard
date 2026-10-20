// Pure status computation, shared by the API (server) and the live UI (client),
// so the browser can re-evaluate "where is X right now" every second.

import type { ElementRef, ElementState, Lesson } from "./types";

export interface ComputedStatus {
  state: ElementState;
  current: Lesson | null;
  /** End of the current block (double periods merged), minutes since midnight */
  currentBlockEnd: number | null;
  next: Lesson | null;
  previous: Lesson | null;
}

const ids = (refs: ElementRef[]) =>
  refs
    .map((r) => r.id)
    .sort((a, b) => a - b)
    .join(",");

/** True when `b` directly continues `a` (same class/subject/teacher/room, ≤ 15 min gap). */
export function continuesBlock(a: Lesson, b: Lesson) {
  return (
    b.startMin >= a.endMin &&
    b.startMin - a.endMin <= 15 &&
    ids(a.subjects) === ids(b.subjects) &&
    ids(a.classes) === ids(b.classes) &&
    ids(a.teachers) === ids(b.teachers) &&
    ids(a.rooms) === ids(b.rooms)
  );
}

export function computeStatus(lessons: Lesson[], atMin: number): ComputedStatus {
  const active = lessons
    .filter((l) => l.status !== "cancelled")
    .sort((a, b) => a.startMin - b.startMin);
  const current = active.find((l) => l.startMin <= atMin && atMin < l.endMin) ?? null;
  const next = active.find((l) => l.startMin > atMin) ?? null;
  const previous = [...active].reverse().find((l) => l.endMin <= atMin) ?? null;

  let currentBlockEnd: number | null = null;
  if (current) {
    let last = current;
    for (const l of active) {
      if (continuesBlock(last, l)) last = l;
    }
    currentBlockEnd = last.endMin;
  }

  let state: ElementState;
  if (active.length === 0) state = "no-lessons";
  else if (current) state = "in-lesson";
  else if (!previous) state = "before-school";
  else if (!next) state = "after-school";
  else state = next.startMin - previous.endMin <= 20 ? "break" : "free";

  return { state, current, currentBlockEnd, next, previous };
}
