import { useMutation, useQuery } from "convex/react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  Search,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  ATTENDANCE_DAY_STATUS_LABELS,
  ATTENDANCE_KIND_LABELS,
  type AttendanceDayStatus,
  type AttendanceKind,
} from "@/lib/attendanceStatus";
import {
  isMemberCategory,
  isVisitorCategory,
  PERSON_ROSTER_STATUS_LABELS,
  PERSON_ROSTER_STATUS_OPTIONS,
  type PersonRosterStatus,
} from "@/lib/personRoster";
import {
  formatDateDisplay,
  formatTodayKey,
  shortDateLabel,
  shortWeekdayLabel,
} from "@/lib/utils";

// ── types ──────────────────────────────────────────────────────────────────

type AdminAttendanceLogRow = {
  _id: Id<"attendance">;
  personId: Id<"people">;
  personName: string;
  teamName?: string;
  dateKey: string;
  markedAt: number;
  kind: AttendanceKind;
  absenceNote?: string;
};

/** Roster API row; `present` only exists on older cached responses. */
type RosterAttendanceRow = {
  personId: Id<"people">;
  name: string;
  teamName?: string;
  dayStatus?: AttendanceDayStatus[];
  present?: boolean[];
};

type RosterAttendanceFilterValue = "all" | AttendanceDayStatus;
type RosterPeopleFilterValue =
  | "all"
  | "members"
  | "visitors"
  | PersonRosterStatus;

// ── constants ──────────────────────────────────────────────────────────────

const ROSTER_ATTENDANCE_FILTER_OPTIONS: {
  value: RosterAttendanceFilterValue;
  label: string;
}[] = [
  { value: "all", label: "All (attendance)" },
  { value: "present", label: ATTENDANCE_DAY_STATUS_LABELS.present },
  { value: "none", label: ATTENDANCE_DAY_STATUS_LABELS.none },
  { value: "sick", label: ATTENDANCE_DAY_STATUS_LABELS.sick },
  { value: "holiday", label: ATTENDANCE_DAY_STATUS_LABELS.holiday },
  { value: "work", label: ATTENDANCE_DAY_STATUS_LABELS.work },
  { value: "other", label: ATTENDANCE_DAY_STATUS_LABELS.other },
  { value: "unexcused", label: ATTENDANCE_DAY_STATUS_LABELS.unexcused },
];

const ROSTER_PEOPLE_FILTER_OPTIONS: {
  value: RosterPeopleFilterValue;
  label: string;
}[] = [
  { value: "all", label: "Everyone" },
  { value: "members", label: "Members (M + M-U18)" },
  { value: "visitors", label: "All visitors" },
  { value: "M", label: "M — Member" },
  { value: "M_U18", label: "M-U18 — Member under 18" },
  { value: "NV", label: "NV — New visitor" },
  { value: "RV", label: "RV — Return visitor" },
  { value: "VO", label: "VO — Visitor overseas" },
];

// ── helpers ────────────────────────────────────────────────────────────────

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rosterAttendanceAt(
  row: RosterAttendanceRow,
  dayIndex: number,
): AttendanceDayStatus {
  const ds = row.dayStatus;
  if (ds !== undefined && ds[dayIndex] !== undefined) return ds[dayIndex]!;
  const pr = row.present;
  if (pr !== undefined && pr[dayIndex] !== undefined) {
    return pr[dayIndex] ? "present" : "none";
  }
  return "none";
}

function rosterRowMatchesViewFilters(
  row: RosterAttendanceRow,
  personRosterStatus: PersonRosterStatus | undefined,
  nameQuery: string,
  attendanceFilter: RosterAttendanceFilterValue,
  peopleFilter: RosterPeopleFilterValue,
): boolean {
  const q = nameQuery.trim().toLowerCase();
  if (q.length > 0 && !row.name.toLowerCase().includes(q)) return false;
  const dayStatus = rosterAttendanceAt(row, 0);
  if (attendanceFilter !== "all" && dayStatus !== attendanceFilter) return false;
  if (peopleFilter === "members") {
    if (!personRosterStatus || !isMemberCategory(personRosterStatus)) return false;
  } else if (peopleFilter === "visitors") {
    if (!personRosterStatus || !isVisitorCategory(personRosterStatus)) return false;
  } else if (peopleFilter !== "all") {
    if (personRosterStatus !== peopleFilter) return false;
  }
  return true;
}

// ── component ──────────────────────────────────────────────────────────────

type Props = { sessionToken: string };

export function AttendanceTab({ sessionToken }: Props) {
  const people = useQuery(api.people.listPeopleAdmin, { sessionToken });
  const teams = useQuery(api.teams.listTeams, { sessionToken });

  const setAttendanceOverride = useMutation(api.attendance.setAttendanceOverride);
  const updatePerson = useMutation(api.people.updatePerson);
  const setPersonStatus = useMutation(api.people.setPersonStatus);

  // ── roster date ──
  const [rosterDate, setRosterDate] = useState(formatTodayKey);

  // ── filter state ──
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterAttendanceFilter, setRosterAttendanceFilter] =
    useState<RosterAttendanceFilterValue>("all");
  const [rosterPeopleFilter, setRosterPeopleFilter] =
    useState<RosterPeopleFilterValue>("all");

  // ── pending-mutation tracking ──
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [pendingStatusPersonId, setPendingStatusPersonId] =
    useState<Id<"people"> | null>(null);
  const [pendingTeamPersonId, setPendingTeamPersonId] =
    useState<Id<"people"> | null>(null);

  const [rosterTableVisible, setRosterTableVisible] = useState(true);
  const [logTableVisible, setLogTableVisible] = useState(true);

  // ── check-in log state ──
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(formatTodayKey);

  const rosterDayKeys = [rosterDate];

  // ── queries ──
  const rosterWeek = useQuery(
    api.attendance.listRosterWeekAttendanceAdmin,
    { sessionToken, dayKeys: rosterDayKeys },
  );

  const filteredAttendance = useQuery(
    api.attendance.listAttendanceAdmin,
    { sessionToken, dateFrom, dateTo },
  );

  // ── derived: people maps ──
  const personStatusById = useMemo(
    () => new Map(people?.map((p) => [p._id, p.status]) ?? []),
    [people],
  );
  const personById = useMemo(
    () => new Map(people?.map((p) => [p._id, p]) ?? []),
    [people],
  );

  // ── derived: filtered roster rows ──
  const filteredRosterRows = useMemo(() => {
    if (!rosterWeek) return [];
    return rosterWeek.rows.filter((r) =>
      rosterRowMatchesViewFilters(
        r as RosterAttendanceRow,
        personStatusById.get(r.personId),
        rosterSearch,
        rosterAttendanceFilter,
        rosterPeopleFilter,
      ),
    );
  }, [rosterWeek, personStatusById, rosterSearch, rosterAttendanceFilter, rosterPeopleFilter]);

  // ── CSV export: roster ──
  function downloadRosterCsv() {
    const header = [
      "Given name",
      "Surname",
      "Cell group",
      ...rosterDayKeys.map((dk) => `${shortWeekdayLabel(dk)} ${shortDateLabel(dk)}`),
    ];
    const lines = [
      header.map(escapeCsvCell).join(","),
      ...filteredRosterRows.map((r) => {
        const row = r as RosterAttendanceRow;
        const person = personById.get(r.personId);
        return [
          person?.givenName.trim() || row.name,
          person?.surname.trim() ?? "",
          row.teamName ?? "",
          ...rosterDayKeys.map((_, i) =>
            ATTENDANCE_DAY_STATUS_LABELS[rosterAttendanceAt(row, i)],
          ),
        ]
          .map(escapeCsvCell)
          .join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${rosterDayKeys[0] ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── CSV export: check-in log ──
  function downloadLogCsv() {
    const rows = (filteredAttendance ?? []) as AdminAttendanceLogRow[];
    const header = ["Date", "Name", "Cell group", "Status", "Note", "Marked at (ISO)"];
    const lines = [
      header.map(escapeCsvCell).join(","),
      ...rows.map((r) =>
        [
          r.dateKey,
          r.personName,
          r.teamName ?? "",
          ATTENDANCE_KIND_LABELS[r.kind],
          r.absenceNote ?? "",
          new Date(r.markedAt).toISOString(),
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!people || !teams) return null;

  return (
    <TabsContent value="attendance" className="space-y-6">
      {/* ── Roster card ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-1">
            <CardTitle>Roster</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              title={rosterTableVisible ? "Hide table" : "Show table"}
              onClick={() => setRosterTableVisible((v) => !v)}
            >
              {rosterTableVisible ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <CardDescription>
            Pick a date, use filters to narrow down, then set or clear each
            person&apos;s attendance.
          </CardDescription>
        </CardHeader>
        {rosterTableVisible && <CardContent className="space-y-4">
          {/* Search bar */}
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              id="roster-search"
              placeholder="Search by name…"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
            />
            {rosterSearch && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  onClick={() => setRosterSearch("")}
                  title="Clear search"
                >
                  <X className="size-3.5" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          {/* Filters + date — 2-col row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label
                htmlFor="roster-date"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <CalendarDays className="size-3.5" />
                Date
              </Label>
              <Input
                id="roster-date"
                type="date"
                className="h-9 w-full"
                value={rosterDate}
                onChange={(e) => {
                  if (e.target.value) setRosterDate(e.target.value);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="roster-attendance-filter"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <CheckCircle2 className="size-3.5" />
                Day attendance
              </Label>
              <Select
                value={rosterAttendanceFilter}
                onValueChange={(v) =>
                  setRosterAttendanceFilter(v as RosterAttendanceFilterValue)
                }
              >
                <SelectTrigger id="roster-attendance-filter" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROSTER_ATTENDANCE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="roster-people-filter"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <Users className="size-3.5" />
                People
              </Label>
              <Select
                value={rosterPeopleFilter}
                onValueChange={(v) =>
                  setRosterPeopleFilter(v as RosterPeopleFilterValue)
                }
              >
                <SelectTrigger id="roster-people-filter" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROSTER_PEOPLE_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table toolbar */}
          {rosterWeek !== undefined && filteredRosterRows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filteredRosterRows.length}{" "}
                {filteredRosterRows.length === 1 ? "person" : "people"} shown
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadRosterCsv}
              >
                <Download className="h-4 w-4" />
                Export current view
              </Button>
            </div>
          )}

          {/* Roster table */}
          <div className="overflow-x-auto rounded-md border border-border">
            {rosterWeek === undefined ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 min-w-[7rem] bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      Given name
                    </TableHead>
                    <TableHead className="min-w-[7rem]">Surname</TableHead>
                    <TableHead className="min-w-[8rem]">Cell group</TableHead>
                    <TableHead className="min-w-[8rem]">Status</TableHead>
                    {rosterDayKeys.map((dk) => (
                      <TableHead
                        key={dk}
                        className="min-w-[5.5rem] text-center text-xs font-medium"
                      >
                        <div>{shortWeekdayLabel(dk)}</div>
                        <div className="font-normal text-muted-foreground">
                          {shortDateLabel(dk)}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRosterRows.map((r) => (
                    <TableRow key={r.personId}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                        {personById.get(r.personId)?.givenName.trim() || r.name}
                      </TableCell>
                      <TableCell className="font-medium">
                        {personById.get(r.personId)?.surname.trim() || ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Select
                          value={personById.get(r.personId)?.teamId ?? "__none__"}
                          onValueChange={(value) => {
                            const person = personById.get(r.personId);
                            if (!person) return;
                            const teamId =
                              value === "__none__"
                                ? undefined
                                : (value as Id<"teams">);
                            void (async () => {
                              setPendingTeamPersonId(r.personId);
                              try {
                                await updatePerson({
                                  sessionToken,
                                  personId: r.personId,
                                  givenName:
                                    person.givenName.trim().length > 0
                                      ? person.givenName.trim()
                                      : person.displayName,
                                  surname: person.surname.trim(),
                                  gender: person.gender,
                                  teamId,
                                  status: person.status,
                                });
                              } finally {
                                setPendingTeamPersonId(null);
                              }
                            })();
                          }}
                          disabled={pendingTeamPersonId === r.personId}
                        >
                          <SelectTrigger className="h-8 w-[8.5rem]">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {teams.map((t) => (
                              <SelectItem key={t._id} value={t._id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={personStatusById.get(r.personId) ?? "M"}
                          onValueChange={(value) => {
                            const status = value as PersonRosterStatus;
                            void (async () => {
                              setPendingStatusPersonId(r.personId);
                              try {
                                await setPersonStatus({
                                  sessionToken,
                                  personId: r.personId,
                                  status,
                                });
                              } finally {
                                setPendingStatusPersonId(null);
                              }
                            })();
                          }}
                          disabled={pendingStatusPersonId === r.personId}
                        >
                          <SelectTrigger className="h-8 min-w-[10rem] max-w-[12rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERSON_ROSTER_STATUS_OPTIONS.map((code) => (
                              <SelectItem key={code} value={code}>
                                {PERSON_ROSTER_STATUS_LABELS[code]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {rosterDayKeys.map((dk, i) => {
                        const status = rosterAttendanceAt(
                          r as RosterAttendanceRow,
                          i,
                        );
                        const cellKey = `${r.personId}|${dk}`;
                        const busy = pendingCell === cellKey;
                        return (
                          <TableCell key={dk} className="p-1">
                            {busy ? (
                              <div className="flex h-9 items-center justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              </div>
                            ) : (
                              <Select
                                value={status}
                                onValueChange={async (value) => {
                                  const next = value as AttendanceDayStatus;
                                  if (next === status) return;
                                  setPendingCell(cellKey);
                                  try {
                                    await setAttendanceOverride({
                                      sessionToken,
                                      personId: r.personId,
                                      dateKey: dk,
                                      status: next === "none" ? "clear" : next,
                                    });
                                  } finally {
                                    setPendingCell(null);
                                  }
                                }}
                              >
                                <SelectTrigger
                                  className="h-9 w-[10.5rem] text-left text-xs"
                                  aria-label={`Attendance for ${r.name} on ${dk}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(
                                    [
                                      "none",
                                      "present",
                                      "sick",
                                      "holiday",
                                      "work",
                                      "other",
                                      "unexcused",
                                    ] as const
                                  ).map((key) => (
                                    <SelectItem key={key} value={key}>
                                      {ATTENDANCE_DAY_STATUS_LABELS[key]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {rosterWeek !== undefined && filteredRosterRows.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {rosterWeek.rows.length === 0
                ? "No people on the roster yet. Add people in the People tab."
                : "No people match your search or filters."}
            </p>
          ) : null}
        </CardContent>}
      </Card>

      {/* ── Check-in log card ── */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Check-in log</CardTitle>
            <CardDescription>
              Raw check-ins in a date range (export for spreadsheets).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={downloadLogCsv}
              disabled={!filteredAttendance?.length}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title={logTableVisible ? "Hide table" : "Show table"}
              onClick={() => setLogTableVisible((v) => !v)}
            >
              {logTableVisible ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        {logTableVisible && <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            {filteredAttendance === undefined ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Cell group</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredAttendance as AdminAttendanceLogRow[]).map((r) => (
                      <TableRow key={r._id}>
                        <TableCell>{formatDateDisplay(r.dateKey)}</TableCell>
                        <TableCell className="font-medium">{r.personName}</TableCell>
                        <TableCell>{r.teamName ?? "—"}</TableCell>
                        <TableCell>{ATTENDANCE_KIND_LABELS[r.kind]}</TableCell>
                        <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                          {r.absenceNote ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {filteredAttendance.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No records in this range.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </CardContent>}
      </Card>
    </TabsContent>
  );
}
