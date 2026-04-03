import { useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  LogOut,
  Pencil,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  addCalendarDays,
  formatDateDisplay,
  formatTodayKey,
  mondayOfWeekContaining,
  SESSION_KEY,
  shortDateLabel,
  shortWeekdayLabel,
  sundayOfWeekFromMonday,
} from "@/lib/utils";

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const sessionToken = localStorage.getItem(SESSION_KEY);

  useEffect(() => {
    if (!sessionToken) {
      navigate("/admin/login", { replace: true });
    }
  }, [sessionToken, navigate]);

  const teams = useQuery(
    api.teams.listTeams,
    sessionToken ? { sessionToken } : "skip",
  );
  const people = useQuery(
    api.people.listPeopleAdmin,
    sessionToken ? { sessionToken } : "skip",
  );

  const logout = useMutation(api.sessions.logout);
  const createTeam = useMutation(api.teams.createTeam);
  const deleteTeam = useMutation(api.teams.deleteTeam);
  const renameTeam = useMutation(api.teams.renameTeam);
  const createPerson = useMutation(api.people.createPerson);
  const updatePerson = useMutation(api.people.updatePerson);
  const removePerson = useMutation(api.people.removePerson);
  const setPersonStatus = useMutation(api.people.setPersonStatus);

  const [teamName, setTeamName] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(formatTodayKey());

  const [weekMonday, setWeekMonday] = useState(() =>
    mondayOfWeekContaining(formatTodayKey()),
  );
  const [rosterSearch, setRosterSearch] = useState("");
  const [pendingCell, setPendingCell] = useState<string | null>(null);

  const rosterDayKeys = useMemo(
    () => [sundayOfWeekFromMonday(weekMonday)],
    [weekMonday],
  );

  const filteredAttendance = useQuery(
    api.attendance.listAttendanceAdmin,
    sessionToken
      ? { sessionToken, dateFrom, dateTo }
      : "skip",
  );

  const rosterWeek = useQuery(
    api.attendance.listRosterWeekAttendanceAdmin,
    sessionToken ? { sessionToken, dayKeys: rosterDayKeys } : "skip",
  );

  const setAttendanceOverride = useMutation(api.attendance.setAttendanceOverride);

  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"people"> | null>(null);
  const [pName, setPName] = useState("");
  const [pTeam, setPTeam] = useState<string>("__none__");
  const [pStatus, setPStatus] = useState<"visitor" | "member">("member");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTeamId, setRenameTeamId] = useState<Id<"teams"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  function openAddPerson() {
    setEditingId(null);
    setPName("");
    setPTeam("__none__");
    setPStatus("member");
    setPersonDialogOpen(true);
  }

  function openEditPerson(id: Id<"people">) {
    const p = people?.find((x) => x._id === id);
    if (!p) return;
    setEditingId(id);
    setPName(p.name);
    setPTeam(p.teamId ?? "__none__");
    setPStatus(p.status);
    setPersonDialogOpen(true);
  }

  async function savePerson() {
    if (!sessionToken) return;
    const teamId =
      pTeam === "__none__" ? undefined : (pTeam as Id<"teams">);
    if (editingId) {
      await updatePerson({
        sessionToken,
        personId: editingId,
        name: pName,
        teamId,
        status: pStatus,
      });
    } else {
      await createPerson({
        sessionToken,
        name: pName,
        teamId,
        status: pStatus,
      });
    }
    setPersonDialogOpen(false);
  }

  async function handleLogout() {
    if (!sessionToken) return;
    await logout({ sessionToken });
    localStorage.removeItem(SESSION_KEY);
    navigate("/admin/login", { replace: true });
  }

  function downloadWeekRosterCsv() {
    const rows = rosterWeek?.rows ?? [];
    const header = [
      "Name",
      "Team",
      ...rosterDayKeys.map(
        (dk) => `${shortWeekdayLabel(dk)} ${shortDateLabel(dk)}`,
      ),
    ];
    const lines = [
      header.map(escapeCsvCell).join(","),
      ...rows.map((r) =>
        [
          r.name,
          r.teamName ?? "",
          ...r.present.map((p) => (p ? "Attending" : "Not attending")),
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-sunday-${rosterDayKeys[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const rows = filteredAttendance ?? [];
    const header = ["Date", "Name", "Team", "Marked at (ISO)"];
    const lines = [
      header.map(escapeCsvCell).join(","),
      ...rows.map((r) =>
        [
          r.dateKey,
          r.personName,
          r.teamName ?? "",
          new Date(r.markedAt).toISOString(),
        ]
          .map(escapeCsvCell)
          .join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!sessionToken || teams === undefined || people === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Helper dashboard</h1>
            <p className="text-xs text-muted-foreground">
              People, teams, attendance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Attendance page</Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
        <Tabs defaultValue="people" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="people">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>People</CardTitle>
                  <CardDescription>
                    Add roster entries and change visitor → member when ready.
                  </CardDescription>
                </div>
                <Button onClick={openAddPerson}>Add person</Button>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people.map((p) => (
                      <TableRow key={p._id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.teamName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "member" ? "default" : "secondary"
                            }
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {p.status === "visitor" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                title="Make member"
                                onClick={() =>
                                  setPersonStatus({
                                    sessionToken,
                                    personId: p._id,
                                    status: "member",
                                  })
                                }
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditPerson(p._id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Remove ${p.name}? Their attendance history will be deleted.`,
                                  )
                                ) {
                                  removePerson({
                                    sessionToken,
                                    personId: p._id,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Teams</CardTitle>
                <CardDescription>
                  Teams can be assigned to people from the People tab.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!teamName.trim()) return;
                    await createTeam({
                      sessionToken,
                      name: teamName.trim(),
                    });
                    setTeamName("");
                  }}
                >
                  <Input
                    placeholder="New team name"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="sm:max-w-xs"
                  />
                  <Button type="submit">Add team</Button>
                </form>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams.map((t) => (
                      <TableRow key={t._id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRenameTeamId(t._id);
                                setRenameValue(t.name);
                                setRenameOpen(true);
                              }}
                            >
                              Rename
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete team "${t.name}"? People on this team will be unassigned.`,
                                  )
                                ) {
                                  deleteTeam({
                                    sessionToken,
                                    teamId: t._id,
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Weekly roster</CardTitle>
                  <CardDescription>
                    Everyone on the roster for the Sunday of the selected week.
                    Click a cell to mark attending or not attending (overrides
                    self check-in).
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  onClick={downloadWeekRosterCsv}
                  disabled={!rosterWeek?.rows.length}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Previous week"
                      onClick={() =>
                        setWeekMonday((m) => addCalendarDays(m, -7))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Next week"
                      onClick={() =>
                        setWeekMonday((m) => addCalendarDays(m, 7))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9"
                      title="Jump to the current week"
                      onClick={() =>
                        setWeekMonday(
                          mondayOfWeekContaining(formatTodayKey()),
                        )
                      }
                    >
                      This week
                    </Button>
                    <div className="space-y-1">
                      <Label htmlFor="week-jump">Week containing</Label>
                      <Input
                        id="week-jump"
                        type="date"
                        className="w-auto min-w-[10rem]"
                        value={weekMonday}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          setWeekMonday(mondayOfWeekContaining(v));
                        }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground lg:ml-2">
                      Sunday: {formatDateDisplay(rosterDayKeys[0]!)}
                    </p>
                  </div>
                  <div className="space-y-1 lg:max-w-sm lg:flex-1">
                    <Label htmlFor="roster-search">Search name</Label>
                    <Input
                      id="roster-search"
                      placeholder="Filter by name…"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  {rosterWeek === undefined ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      Loading…
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-20 min-w-[8rem] bg-card shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                            Name
                          </TableHead>
                          <TableHead className="min-w-[6rem]">Team</TableHead>
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
                        {rosterWeek.rows
                          .filter((r) => {
                            const q = rosterSearch.trim().toLowerCase();
                            if (!q) return true;
                            return r.name.toLowerCase().includes(q);
                          })
                          .map((r) => (
                            <TableRow key={r.personId}>
                              <TableCell className="sticky left-0 z-10 bg-card font-medium shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                                {r.name}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {r.teamName ?? "—"}
                              </TableCell>
                              {rosterDayKeys.map((dk, i) => {
                                const present = r.present[i] ?? false;
                                const cellKey = `${r.personId}|${dk}`;
                                const busy = pendingCell === cellKey;
                                return (
                                  <TableCell key={dk} className="p-1">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        type="button"
                                        variant={
                                          present ? "default" : "outline"
                                        }
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Mark attending"
                                        aria-label="Mark attending"
                                        disabled={busy || present}
                                        onClick={async () => {
                                          if (!sessionToken) return;
                                          setPendingCell(cellKey);
                                          try {
                                            await setAttendanceOverride({
                                              sessionToken,
                                              personId: r.personId,
                                              dateKey: dk,
                                              present: true,
                                            });
                                          } finally {
                                            setPendingCell(null);
                                          }
                                        }}
                                      >
                                        {busy && !present ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Check className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        type="button"
                                        variant={
                                          !present ? "secondary" : "outline"
                                        }
                                        size="icon"
                                        className="h-8 w-8"
                                        title="Mark not attending"
                                        aria-label="Mark not attending"
                                        disabled={busy || !present}
                                        onClick={async () => {
                                          if (!sessionToken) return;
                                          setPendingCell(cellKey);
                                          try {
                                            await setAttendanceOverride({
                                              sessionToken,
                                              personId: r.personId,
                                              dateKey: dk,
                                              present: false,
                                            });
                                          } finally {
                                            setPendingCell(null);
                                          }
                                        }}
                                      >
                                        {busy && present ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <X className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                {rosterWeek !== undefined &&
                rosterWeek.rows.filter((r) => {
                  const q = rosterSearch.trim().toLowerCase();
                  if (!q) return true;
                  return r.name.toLowerCase().includes(q);
                }).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {rosterWeek.rows.length === 0
                      ? "No people on the roster yet. Add people in the People tab."
                      : "No names match your search."}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Check-in log</CardTitle>
                  <CardDescription>
                    Raw check-ins in a date range (export for spreadsheets).
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  onClick={downloadCsv}
                  disabled={!filteredAttendance?.length}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
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
                            <TableHead>Team</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAttendance.map((r) => (
                            <TableRow key={r._id}>
                              <TableCell>
                                {formatDateDisplay(r.dateKey)}
                              </TableCell>
                              <TableCell className="font-medium">
                                {r.personName}
                              </TableCell>
                              <TableCell>{r.teamName ?? "—"}</TableCell>
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit person" : "Add person"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pname">Name</Label>
              <Input
                id="pname"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={pTeam} onValueChange={setPTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="No team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No team</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={pStatus}
                onValueChange={(v) =>
                  setPStatus(v as "visitor" | "member")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="visitor">Visitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePerson} disabled={!pName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename team</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!renameTeamId || !renameValue.trim()) return;
                await renameTeam({
                  sessionToken,
                  teamId: renameTeamId,
                  name: renameValue.trim(),
                });
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
