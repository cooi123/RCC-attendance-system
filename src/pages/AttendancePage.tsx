import { useMutation, useQuery } from "convex/react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "../../convex/_generated/api";
import { formatDateDisplay, formatTodayKey } from "@/lib/utils";

const VISITOR_NAME_STORAGE_KEY = "RCC_Attendance:lastVisitorName";
const SELECTED_PEOPLE_STORAGE_PREFIX = "RCC_Attendance:selectedPeople:";

/** Public dir; prefix with BASE_URL so it works on GitHub Pages (/repo/). Use logo.png. */
const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;


function readStoredVisitorName(): string {
  try {
    return localStorage.getItem(VISITOR_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function selectedPeopleStorageKey(dateKey: string): string {
  return `${SELECTED_PEOPLE_STORAGE_PREFIX}${dateKey}`;
}

function readStoredSelectedIds(dateKey: string): Id<"people">[] {
  try {
    const raw = localStorage.getItem(selectedPeopleStorageKey(dateKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is Id<"people"> => typeof v === "string");
  } catch {
    return [];
  }
}

function persistSelectedIds(dateKey: string, ids: Set<Id<"people">>): void {
  try {
    if (ids.size === 0) {
      localStorage.removeItem(selectedPeopleStorageKey(dateKey));
      return;
    }
    localStorage.setItem(selectedPeopleStorageKey(dateKey), JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

function formatNameList(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return "";
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

export function AttendancePage() {
  const checkInByName = useMutation(api.attendance.checkInByName);
  const checkInManyByPersonIds = useMutation(
    api.attendance.checkInManyByPersonIds,
  );
  const todayKey = formatTodayKey();
  const peopleForCheckIn = useQuery(api.attendance.listPeopleForPublicCheckIn, {
    dateKey: todayKey,
  });
  const [nameInput, setNameInput] = useState(readStoredVisitorName);
  const [listFilter, setListFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"people">>>(
    () => new Set(readStoredSelectedIds(todayKey)),
  );
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [welcomeNewVisitor, setWelcomeNewVisitor] = useState(false);
  const [checkedInSummary, setCheckedInSummary] = useState("");
  const [alreadyMarkedNote, setAlreadyMarkedNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    if (!peopleForCheckIn) return [];
    const q = listFilter.trim().toLowerCase();
    if (!q) return peopleForCheckIn;
    return peopleForCheckIn.filter((p) =>
      p.name.toLowerCase().includes(q),
    );
  }, [peopleForCheckIn, listFilter]);

  useEffect(() => {
    persistSelectedIds(todayKey, selectedIds);
  }, [todayKey, selectedIds]);

  useEffect(() => {
    if (!peopleForCheckIn) return;
    const validIds = new Set(peopleForCheckIn.map((p) => p._id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<Id<"people">>();
      for (const id of prev) {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      if (!changed && next.size === prev.size) return prev;
      return next;
    });
  }, [peopleForCheckIn]);

  const togglePerson = (id: Id<"people">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setErrorMsg(null);
  };

  const selectAllSelectableFiltered = () => {
    const allSelected =
      filteredPeople.length > 0 &&
      filteredPeople.every((p) => selectedIds.has(p._id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const p of filteredPeople) next.delete(p._id);
      } else {
        for (const p of filteredPeople) next.add(p._id);
      }
      return next;
    });
    setErrorMsg(null);
  };


  const persistVisitorName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(VISITOR_NAME_STORAGE_KEY, trimmed);
    } catch {
      /* ignore */
    }
  };

  const hasSelection = selectedIds.size > 0;
  const hasTypedName = nameInput.trim().length > 0;
  const canSubmit = !loading && (hasSelection || hasTypedName);

  async function handleMarkHere() {
    setErrorMsg(null);
    setAlreadyMarkedNote(null);
    setLoading(true);
    try {
      const checkedInNames: string[] = [];
      const alreadyMarkedNames: string[] = [];
      let createdProfile = false;

      const ids = [...selectedIds];
      if (ids.length > 0) {
        const batch = await checkInManyByPersonIds({
          personIds: ids,
          dateKey: todayKey,
        });
        if (!batch.ok) {
          if (batch.reason === "too_many") {
            setErrorMsg("Too many people selected at once. Try a smaller group.");
          } else {
            setErrorMsg("Something went wrong. Please try again.");
          }
          return;
        }
        checkedInNames.push(...batch.checkedIn.map((r) => r.name));
        alreadyMarkedNames.push(...batch.alreadyMarked.map((r) => r.name));
      }

      if (hasTypedName) {
        const result = await checkInByName({
          name: nameInput,
          dateKey: todayKey,
        });
        if (result.ok) {
          persistVisitorName(nameInput);
          createdProfile = result.createdProfile;
          checkedInNames.push(nameInput.trim());
        } else if (result.reason === "already_marked") {
          alreadyMarkedNames.push(nameInput.trim());
        } else if (result.reason === "invalid_name") {
          setErrorMsg("Enter a name (up to 120 characters), or clear the extra name field.");
          return;
        } else {
          setErrorMsg("Something went wrong. Please try again.");
          return;
        }
      }

      const anyRecorded = checkedInNames.length > 0;
      const anyAlreadyMarked = alreadyMarkedNames.length > 0;
      if (!anyRecorded && !anyAlreadyMarked) {
        return;
      }

      setWelcomeNewVisitor(createdProfile);
      setCheckedInSummary(formatNameList(checkedInNames));
      const dupAlready = [...new Set(alreadyMarkedNames)];
      setAlreadyMarkedNote(
        dupAlready.length > 0
          ? `Already checked in today: ${formatNameList(dupAlready)}.`
          : null,
      );
      setSuccessOpen(true);
      setNameInput("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary/[0.07] via-background to-background pb-12">
      <header className="border-b border-border/80 bg-card/90 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={LOGO_URL}
              alt=""
              className="h-9 w-auto shrink-0 object-contain"
              width={36}
              height={36}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-muted-foreground">
                Attendance
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link to="/admin/login">Helper sign in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={LOGO_URL}
            alt="RCC"
            className="mb-6 h-24 w-auto max-w-[min(100%,14rem)] object-contain drop-shadow-sm sm:h-28"
            width={112}
            height={112}
          />
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Welcome!
          </h1>
        </div>

        <Card className="border-border/80 shadow-md shadow-black/[0.04]">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-lg font-medium">
              Check in for today
            </CardTitle>
            <CardDescription>
              Select everyone attending from the list. 
              If you are new comer or visitor, please add your name below and reach out to the welcoming team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            <div className="flex gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Today
                </p>
                <p className="text-base font-semibold text-foreground">
                  {formatDateDisplay(todayKey)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="roster-filter">Who&apos;s here today?</Label>
                {filteredPeople.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto py-1 text-xs text-muted-foreground"
                    onClick={selectAllSelectableFiltered}
                    disabled={loading || peopleForCheckIn === undefined}
                  >
                    {filteredPeople.every((p) => selectedIds.has(p._id))
                      ? "Clear filtered"
                      : "Select all in list"}
                  </Button>
                ) : null}
              </div>
              <Input
                id="roster-filter"
                value={listFilter}
                onChange={(e) => {
                  setListFilter(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Search names…"
                disabled={loading}
                className="h-11 text-base"
                autoComplete="off"
              />
              <div
                className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card px-1 py-2"
                role="group"
                aria-label="People on the roster"
              >
                {peopleForCheckIn === undefined ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    Loading names…
                  </p>
                ) : peopleForCheckIn.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No names in the list yet. Use the field below to add yours.
                  </p>
                ) : filteredPeople.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No matches. Try a different search or add a name below.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filteredPeople.map((p) => {
                      const checked = selectedIds.has(p._id);
                      return (
                        <li key={p._id}>
                          <label
                            className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-base transition-colors ${
                              "hover:bg-muted/80"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                              checked={checked}
                              onChange={() => togglePerson(p._id)}
                            />
                            <span className="min-w-0 flex-1 font-medium text-foreground">
                              {p.name}
                            </span>
                          
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="person-name">Not on the list?</Label>
              <Input
                id="person-name"
                name="person-name"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setErrorMsg(null);
                }}
                onBlur={() => persistVisitorName(nameInput)}
                placeholder="First and last name"
                disabled={loading}
                className="h-12 text-base"
                autoComplete="name"
                autoCapitalize="words"
              />
            </div>

            {errorMsg ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <Button
              className="h-12 w-full text-base font-semibold shadow-sm"
              size="lg"
              onClick={handleMarkHere}
              disabled={!canSubmit}
            >
              {loading ? "Saving…" : "Record attendance"}
            </Button>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              Checked in
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground">
                <p>
                  {checkedInSummary
                    ? (
                      <>
                        Attendance for {formatDateDisplay(todayKey)} was recorded for{" "}
                        <span className="font-medium text-foreground">
                          {checkedInSummary}
                        </span>
                        .
                      </>
                    )
                    : `Attendance for ${formatDateDisplay(todayKey)} is already marked for the selected names.`}
                </p>
                {alreadyMarkedNote ? (
                  <p className="text-sm">{alreadyMarkedNote}</p>
                ) : null}
                {welcomeNewVisitor ? (
                  <p>
                    Welcome—we added a new profile for a name you entered.
                    Please let the welcoming team know; they can help you get
                    settled in.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setSuccessOpen(false);
                setNameInput(readStoredVisitorName());
              }}
            >
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
