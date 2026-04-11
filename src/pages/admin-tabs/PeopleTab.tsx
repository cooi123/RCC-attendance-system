import { useMutation, useQuery } from "convex/react";
import { Download, Loader2, Pencil, Trash2, Upload, UserPlus } from "lucide-react";
import { useState } from "react";
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
  DialogDescription,
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
import { TabsContent } from "@/components/ui/tabs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  isMemberCategory,
  PERSON_GENDER_LABELS,
  PERSON_ROSTER_STATUS_LABELS,
  PERSON_ROSTER_STATUS_OPTIONS,
  type PersonGender,
  type PersonRosterStatus,
} from "@/lib/personRoster";
import { formatTodayKey } from "@/lib/utils";
import {
  MEMBER_IMPORT_CSV_SAMPLE,
  parseMemberImportCsv,
  type MemberImportRow,
} from "@/lib/memberImportCsv";

type Props = { sessionToken: string };

export function PeopleTab({ sessionToken }: Props) {
  const people = useQuery(
    api.people.listPeopleAdmin,
    { sessionToken },
  );
  const teams = useQuery(api.teams.listTeams, { sessionToken });

  const createPerson = useMutation(api.people.createPerson);
  const updatePerson = useMutation(api.people.updatePerson);
  const removePerson = useMutation(api.people.removePerson);
  const importMembers = useMutation(api.people.importMembers);
  const setAttendanceOverride = useMutation(api.attendance.setAttendanceOverride);

  // ── Import dialog ──
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState<MemberImportRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importDone, setImportDone] = useState<{
    created: number;
    failed: { line: number; message: string }[];
    warnings: { line: number; message: string }[];
  } | null>(null);

  function resetImportDialog() {
    setImportRows([]);
    setImportParseErrors([]);
    setImportDone(null);
    setImportLoading(false);
    const el = document.getElementById("csv-import") as HTMLInputElement | null;
    if (el) el.value = "";
  }

  function downloadMemberCsvSample() {
    const blob = new Blob([MEMBER_IMPORT_CSV_SAMPLE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "members-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportCsvFile(file: File) {
    setImportDone(null);
    const text = await file.text();
    const { members, errors } = parseMemberImportCsv(text);
    setImportRows(members);
    setImportParseErrors(errors);
  }

  async function runMemberImport() {
    if (!sessionToken || importRows.length === 0) return;
    setImportLoading(true);
    setImportDone(null);
    const BATCH = 200;
    let created = 0;
    const failed: { line: number; message: string }[] = [];
    const warnings: { line: number; message: string }[] = [];
    try {
      for (let i = 0; i < importRows.length; i += BATCH) {
        const slice = importRows.slice(i, i + BATCH);
        const res = await importMembers({ sessionToken, members: slice });
        created += res.created;
        failed.push(...res.failed);
        warnings.push(...res.warnings);
      }
      setImportDone({ created, failed, warnings });
    } catch {
      setImportParseErrors((prev) => [
        ...prev,
        "Import failed. Check your connection and try again.",
      ]);
    } finally {
      setImportLoading(false);
    }
  }

  // ── Person dialog ──
  const [personDialogOpen, setPersonDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"people"> | null>(null);
  const [pGivenName, setPGivenName] = useState("");
  const [pSurname, setPSurname] = useState("");
  const [pGender, setPGender] = useState<PersonGender>("male");
  const [pTeam, setPTeam] = useState<string>("__none__");
  const [pStatus, setPStatus] = useState<PersonRosterStatus>("NV");

  function openAddPerson() {
    setEditingId(null);
    setPGivenName("");
    setPSurname("");
    setPGender("male");
    setPTeam("__none__");
    setPStatus("NV");
    setPersonDialogOpen(true);
  }

  function openEditPerson(id: Id<"people">) {
    const p = people?.find((x) => x._id === id);
    if (!p) return;
    setEditingId(id);
    setPGivenName(p.givenName.trim().length > 0 ? p.givenName.trim() : p.displayName);
    setPSurname(p.surname.trim());
    setPGender(p.gender);
    setPTeam(p.teamId ?? "__none__");
    setPStatus(p.status);
    setPersonDialogOpen(true);
  }

  async function savePerson() {
    const teamId = pTeam === "__none__" ? undefined : (pTeam as Id<"teams">);
    if (editingId) {
      await updatePerson({
        sessionToken,
        personId: editingId,
        givenName: pGivenName,
        surname: pSurname,
        gender: pGender,
        teamId,
        status: pStatus,
      });
    } else {
      await createPerson({
        sessionToken,
        givenName: pGivenName,
        surname: pSurname,
        gender: pGender,
        teamId,
        status: pStatus,
      });
    }
    setPersonDialogOpen(false);
  }

  // ── Add visitor today dialog ──
  const VISITOR_STATUSES: PersonRosterStatus[] = ["NV", "RV", "VO"];
  const [visitorDialogOpen, setVisitorDialogOpen] = useState(false);
  const [vGivenName, setVGivenName] = useState("");
  const [vSurname, setVSurname] = useState("");
  const [vGender, setVGender] = useState<PersonGender>("male");
  const [vStatus, setVStatus] = useState<PersonRosterStatus>("NV");
  const [vLoading, setVLoading] = useState(false);

  function openAddVisitorToday() {
    setVGivenName("");
    setVSurname("");
    setVGender("male");
    setVStatus("NV");
    setVLoading(false);
    setVisitorDialogOpen(true);
  }

  async function saveVisitorToday() {
    if (!vGivenName.trim()) return;
    setVLoading(true);
    try {
      const personId = await createPerson({
        sessionToken,
        givenName: vGivenName,
        surname: vSurname,
        gender: vGender,
        status: vStatus,
      });
      await setAttendanceOverride({
        sessionToken,
        personId,
        dateKey: formatTodayKey(),
        status: "present",
      });
      setVisitorDialogOpen(false);
    } finally {
      setVLoading(false);
    }
  }

  if (!people || !teams) return null;

  return (
    <>
      <TabsContent value="people">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>People</CardTitle>
              <CardDescription>
                Add people with given name, surname, gender, and roster status
                (M, M-U18, NV, RV, VO). Import many at once from a CSV file.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetImportDialog();
                  setImportDialogOpen(true);
                }}
              >
                <Upload className="h-4 w-4" />
                Import members
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={openAddVisitorToday}
              >
                <UserPlus className="h-4 w-4" />
                Add visitor today
              </Button>
              <Button type="button" onClick={openAddPerson}>
                Add person
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Cell group</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="font-medium">{p.displayName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {PERSON_GENDER_LABELS[p.gender]}
                    </TableCell>
                    <TableCell>{p.teamName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={isMemberCategory(p.status) ? "default" : "secondary"}
                      >
                        {PERSON_ROSTER_STATUS_LABELS[p.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
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
                                `Remove ${p.displayName}? Their attendance history will be deleted.`,
                              )
                            ) {
                              removePerson({ sessionToken, personId: p._id });
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

      {/* ── Import dialog ── */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) resetImportDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import members from CSV</DialogTitle>
            <DialogDescription>
              Use a header row with columns{" "}
              <span className="font-medium text-foreground">Name</span>,{" "}
              <span className="font-medium text-foreground">Surname</span>,{" "}
              <span className="font-medium text-foreground">Gender</span>{" "}
              (Male/Female), and{" "}
              <span className="font-medium text-foreground">Member</span> (roster
              status: M, M-U18, NV, RV, VO; leave blank for M). Optional column:{" "}
              <span className="font-medium text-foreground">Cell group</span>{" "}
              (must match the Cell groups tab). You can still use headers like
              Given name or Status instead of Name/Member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={downloadMemberCsvSample}
            >
              <Download className="h-4 w-4" />
              Download sample CSV
            </Button>
            <div className="space-y-2">
              <Label htmlFor="csv-import">CSV file</Label>
              <Input
                id="csv-import"
                type="file"
                accept=".csv,text/csv"
                disabled={importLoading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImportCsvFile(f);
                }}
              />
            </div>
            {importParseErrors.length > 0 ? (
              <ul className="max-h-32 overflow-y-auto rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {importParseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            ) : null}
            {importRows.length > 0 && !importDone ? (
              <p className="text-sm text-muted-foreground">
                Ready to import{" "}
                <span className="font-medium text-foreground">
                  {importRows.length}
                </span>{" "}
                {importRows.length === 1 ? "person" : "people"}.
              </p>
            ) : null}
            {importDone ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">
                  Created {importDone.created}{" "}
                  {importDone.created === 1 ? "person" : "people"}.
                </p>
                {importDone.failed.length > 0 ? (
                  <div>
                    <p className="font-medium text-destructive">Errors</p>
                    <ul className="mt-1 max-h-24 overflow-y-auto text-destructive">
                      {importDone.failed.map((f, i) => (
                        <li key={i}>
                          Line {f.line}: {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {importDone.warnings.length > 0 ? (
                  <div>
                    <p className="font-medium text-amber-700 dark:text-amber-500">
                      Warnings
                    </p>
                    <ul className="mt-1 max-h-24 overflow-y-auto text-muted-foreground">
                      {importDone.warnings.map((w, i) => (
                        <li key={i}>
                          Line {w.line}: {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              Close
            </Button>
            {!importDone ? (
              <Button
                type="button"
                className="gap-2"
                onClick={() => void runMemberImport()}
                disabled={importLoading || importRows.length === 0}
              >
                {importLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import"
                )}
              </Button>
            ) : (
              <Button type="button" onClick={resetImportDialog}>
                Import another file
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add visitor today dialog ── */}
      <Dialog open={visitorDialogOpen} onOpenChange={setVisitorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add visitor today</DialogTitle>
            <DialogDescription>
              Creates a new visitor profile and marks them as attending today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="vgiven">Given name</Label>
                <Input
                  id="vgiven"
                  value={vGivenName}
                  onChange={(e) => setVGivenName(e.target.value)}
                  autoComplete="given-name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vsurname">Surname</Label>
                <Input
                  id="vsurname"
                  value={vSurname}
                  onChange={(e) => setVSurname(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={vGender}
                onValueChange={(v) => setVGender(v as PersonGender)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERSON_GENDER_LABELS) as PersonGender[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {PERSON_GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visitor type</Label>
              <Select
                value={vStatus}
                onValueChange={(v) => setVStatus(v as PersonRosterStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISITOR_STATUSES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {PERSON_ROSTER_STATUS_LABELS[code]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVisitorDialogOpen(false)}
              disabled={vLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveVisitorToday()}
              disabled={vLoading || !vGivenName.trim()}
            >
              {vLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Add & mark attending"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit person dialog ── */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit person" : "Add person"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pgiven">Given name</Label>
                <Input
                  id="pgiven"
                  value={pGivenName}
                  onChange={(e) => setPGivenName(e.target.value)}
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="psurname">Surname</Label>
                <Input
                  id="psurname"
                  value={pSurname}
                  onChange={(e) => setPSurname(e.target.value)}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={pGender}
                onValueChange={(v) => setPGender(v as PersonGender)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERSON_GENDER_LABELS) as PersonGender[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      {PERSON_GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cell group</Label>
              <Select value={pTeam} onValueChange={setPTeam}>
                <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Person status</Label>
              <Select
                value={pStatus}
                onValueChange={(v) => setPStatus(v as PersonRosterStatus)}
              >
                <SelectTrigger>
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
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePerson} disabled={!pGivenName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
