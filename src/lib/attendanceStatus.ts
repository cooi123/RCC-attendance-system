/** Matches Convex attendance record kinds (excluding optional legacy rows with no kind = present). */
export type AttendanceKind =
  | "present"
  | "sick"
  | "holiday"
  | "work"
  | "other"
  | "unexcused";

/** Per-day cell: no record, present, or a recorded absence reason. */
export type AttendanceDayStatus =
  | "none"
  | AttendanceKind;

export const ATTENDANCE_KIND_LABELS: Record<AttendanceKind, string> = {
  present: "Attending",
  sick: "Sick",
  holiday: "Holiday",
  work: "Work",
  other: "Other",
  unexcused: "Absent (no reason)",
};

export const ATTENDANCE_DAY_STATUS_LABELS: Record<AttendanceDayStatus, string> =
  {
    none: "Not set",
    ...ATTENDANCE_KIND_LABELS,
  };

export function isSelectableForCheckIn(
  status: AttendanceDayStatus,
): boolean {
  return status === "none";
}

export function isPresentDayStatus(status: AttendanceDayStatus): boolean {
  return status === "present";
}
