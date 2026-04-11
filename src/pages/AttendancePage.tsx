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

const SELECTED_PEOPLE_STORAGE_PREFIX = "RCC_Attendance:selectedPeople:";

/** Public dir; prefix with BASE_URL so it works on GitHub Pages (/repo/). Use logo.png. */
const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

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
    localStorage.setItem(
      selectedPeopleStorageKey(dateKey),
      JSON.stringify([...ids]),
    );
  } catch {
    /* ignore */
  }
}

export function AttendancePage() {
  const checkInManyByPersonIds = useMutation(
    api.attendance.checkInManyByPersonIds,
  );
  const todayKey = formatTodayKey();
  const peopleForCheckIn = useQuery(api.attendance.listPeopleForPublicCheckIn, {
    dateKey: todayKey,
  });
  const [listFilter, setListFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"people">>>(
    () => new Set(readStoredSelectedIds(todayKey)),
  );
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredPeople = useMemo(() => {
    if (!peopleForCheckIn) return [];
    const q = listFilter.trim().toLowerCase();
    const people = q
      ? peopleForCheckIn.filter((p) => p.name.toLowerCase().includes(q))
      : peopleForCheckIn;
    return [...people].sort((a, b) => {
      const aSelected = selectedIds.has(a._id) ? 0 : 1;
      const bSelected = selectedIds.has(b._id) ? 0 : 1;
      return aSelected - bSelected;
    });
  }, [peopleForCheckIn, listFilter, selectedIds]);

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
        if (!validIds.has(id)) {
          changed = true;
          continue;
        }
        next.add(id);
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


  async function handleMarkHere() {
    setErrorMsg(null);
    const ids = [...selectedIds];
    if (ids.length === 0) {
      setErrorMsg("Select at least one person.");
      return;
    }
    setLoading(true);
    try {

      const batch = await checkInManyByPersonIds({
        personIds: ids,
        dateKey: todayKey,
      });
      if (!batch.ok) {
        if (batch.reason === "too_many") {
          setErrorMsg(
            "Too many people selected at once. Try a smaller group.",
          );
        } else {
          setErrorMsg("Something went wrong. Please try again.");
        }
        return;
      }

      const anyRecorded = batch.checkedIn.length > 0;
      const anyAlreadyMarked = batch.alreadyMarked.length > 0;
      if (!anyRecorded && !anyAlreadyMarked) {
        return;
      }

      setSuccessOpen(true);
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
              Select everyone attending from the list, then record attendance.
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
                    No names on the roster yet. If you are a new visitor,
                    please reach out to a welcomer.
                  </p>
                ) : filteredPeople.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground">
                    No matches. Try a different search.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filteredPeople.map((p) => {
                      const checked = selectedIds.has(p._id);
                      return (
                        <li key={p._id}>
                          <div className="flex items-center gap-3 rounded-md px-3 py-2.5 text-base transition-colors hover:bg-muted/80">
                            <input
                              id={`attendance-check-${p._id}`}
                              type="checkbox"
                              className="h-4 w-4 shrink-0 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
                              checked={checked}
                              disabled={loading}
                              onChange={() => togglePerson(p._id)}
                              aria-labelledby={`attendance-name-${p._id}`}
                            />
                            <span
                              id={`attendance-name-${p._id}`}
                              className="min-w-0 flex-1 select-none font-medium text-muted-foreground"
                            >
                              {p.name}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <p className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              If you are a new visitor or don&apos;t see your name on the
              list, please reach out to the welcome team.
            </p>

            {errorMsg ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            ) : null}

            <Button
              className="h-12 w-full text-base font-semibold shadow-sm"
              size="lg"
              onClick={handleMarkHere}
              disabled={loading}
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
              Thank you
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-muted-foreground">
                Thank you. Attendance for {formatDateDisplay(todayKey)} has been
                submitted.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSuccessOpen(false)}>
              Done
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
