/** Matches Convex `personRosterStatus`. */
export type PersonRosterStatus = "M" | "M_U18" | "NV" | "RV" | "VO";

export type PersonGender = "female" | "male";

export const PERSON_ROSTER_STATUS_LABELS: Record<PersonRosterStatus, string> =
  {
    M: "M — Member",
    M_U18: "M-U18 — Member under 18",
    NV: "NV — New visitor",
    RV: "RV — Return visitor",
    VO: "VO — Visitor overseas",
  };

export const PERSON_GENDER_LABELS: Record<PersonGender, string> = {
  female: "Female",
  male: "Male",
};

export const PERSON_ROSTER_STATUS_OPTIONS: PersonRosterStatus[] = [
  "M",
  "M_U18",
  "NV",
  "RV",
  "VO",
];

export function isMemberCategory(status: PersonRosterStatus): boolean {
  return status === "M" || status === "M_U18";
}

export function isVisitorCategory(status: PersonRosterStatus): boolean {
  return status === "NV" || status === "RV" || status === "VO";
}
