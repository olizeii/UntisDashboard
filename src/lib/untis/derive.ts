import type { Lesson, Substitution, SubstitutionType } from "./types";

function lessonChangeType(lesson: Lesson): SubstitutionType | null {
  if (lesson.status === "cancelled") return "cancel";
  if (lesson.teacherChanged) return "subst";
  if (lesson.roomChanged) return "rmchg";
  if (lesson.status === "irregular") return lesson.lessonType === "ex" ? "exam" : "add";
  return null;
}

/**
 * Reconstructs a substitution list from timetable entries. Used when the account
 * is not allowed to call `getSubstitutions` and by the demo data source.
 */
export function deriveSubstitutions(lessons: Lesson[]): Substitution[] {
  const result: Substitution[] = [];
  for (const lesson of lessons) {
    const type = lessonChangeType(lesson);
    if (!type) continue;
    result.push({
      id: `${lesson.id}-${lesson.date}-${lesson.startMin}-${type}`,
      type,
      date: lesson.date,
      start: lesson.start,
      end: lesson.end,
      startMin: lesson.startMin,
      endMin: lesson.endMin,
      classes: lesson.classes,
      teachers: lesson.teachers,
      subjects: lesson.subjects,
      rooms: lesson.rooms,
      text: lesson.substText ?? lesson.text,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}
