/**
 * Input and request limits for the mock lesson-plan prototype.
 *
 * Every value here is a PROVISIONAL prototype value (暫定設計) chosen only so
 * the prototype can validate input. None of them is an agreed requirement;
 * they remain open until Issues #6 / #9 / #10 are decided.
 */
export const LIMITS = {
  unitNameMaxLength: 40,
  totalLessonsMax: 30,
  durationMinutesMin: 5,
  durationMinutesMax: 120,
  goalMaxLength: 200,
  activityMaxLength: 400,
  listTextMaxLength: 1000,
  requestBodyMaxBytes: 8192,
  requestTimeoutMs: 10000,
  goalCandidateCount: 3,
} as const;
