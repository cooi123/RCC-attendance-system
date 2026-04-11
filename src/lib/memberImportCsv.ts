import { parseCsv } from "./csv";

export type MemberImportRow = {
  /** 1-based line number in the file (for error messages). */
  line: number;
  givenName: string;
  surname: string;
  gender?: string;
  teamName?: string;
  status?: string;
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Map normalized header text → logical column key. */
const HEADER_TO_KEY: Record<string, keyof Omit<MemberImportRow, "line">> = {
  /** Primary format: Name, Surname, Gender, Member (see sample CSV). */
  name: "givenName",
  given_name: "givenName",
  first_name: "givenName",
  firstname: "givenName",
  first: "givenName",
  given: "givenName",
  surname: "surname",
  last_name: "surname",
  lastname: "surname",
  last: "surname",
  family_name: "surname",
  gender: "gender",
  sex: "gender",
  team: "teamName",
  team_name: "teamName",
  cg: "teamName",
  cell_group: "teamName",
  cellgroup: "teamName",
  cell_groups: "teamName",
  group: "teamName",
  status: "status",
  roster_status: "status",
  role: "status",
  member: "status",
};

/**
 * Parse member CSV. Expected columns (see sample): Name, Surname, Gender, Member
 * (Member = roster status: M, M-U18, NV, RV, VO).
 * Also accepts Given name / First name instead of Name, optional Cell group / Team,
 * and Status instead of Member.
 */
export function parseMemberImportCsv(text: string): {
  members: MemberImportRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) {
    return { members: [], errors: ["File is empty."] };
  }

  const grid = parseCsv(trimmed);
  if (grid.length < 2) {
    return {
      members: [],
      errors: ["Add a header row and at least one data row."],
    };
  }

  const headerCells = grid[0]!.map((h) => normalizeHeader(h));
  const colByKey = new Map<string, number>();
  for (let c = 0; c < headerCells.length; c++) {
    const h = headerCells[c]!;
    const key = HEADER_TO_KEY[h];
    if (key !== undefined && !colByKey.has(key)) {
      colByKey.set(key, c);
    }
  }

  if (!colByKey.has("givenName")) {
    return {
      members: [],
      errors: [
        'No name column found. Use a header row with "Name" (or "Given name" / "First name").',
      ],
    };
  }

  const members: MemberImportRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    const line = r + 1;
    const get = (key: keyof Omit<MemberImportRow, "line">) => {
      const idx = colByKey.get(key);
      if (idx === undefined) return "";
      return (cells[idx] ?? "").trim();
    };

    const givenName = get("givenName");
    if (!givenName) {
      errors.push(`Line ${line}: missing Name, skipped.`);
      continue;
    }

    members.push({
      line,
      givenName,
      surname: get("surname"),
      gender: get("gender") || undefined,
      teamName: get("teamName") || undefined,
      status: get("status") || undefined,
    });
  }

  return { members, errors };
}

export const MEMBER_IMPORT_CSV_SAMPLE = `Name,Surname,Gender,Member
Jane,Doe,Female,M
John,Smith,Male,M_U18
`;
