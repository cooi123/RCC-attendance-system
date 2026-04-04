import { useMutation } from "convex/react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
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


function readStoredVisitorName(): string {
  try {
    return localStorage.getItem(VISITOR_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function AttendancePage() {
  const checkInByName = useMutation(api.attendance.checkInByName);
  const todayKey = formatTodayKey();
  const [nameInput, setNameInput] = useState(readStoredVisitorName);
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [welcomeNewVisitor, setWelcomeNewVisitor] = useState(false);
  const [checkedInDisplayName, setCheckedInDisplayName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


  const persistVisitorName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      localStorage.setItem(VISITOR_NAME_STORAGE_KEY, trimmed);
    } catch {
      /* ignore */
    }
  };

  const canSubmit = !loading && nameInput.trim().length > 0;

  async function handleMarkHere() {
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await checkInByName({
        name: nameInput,
        dateKey: todayKey,
      });
      if (result.ok) {
        persistVisitorName(nameInput);
        setWelcomeNewVisitor(result.createdProfile);
        setCheckedInDisplayName(nameInput.trim());
        setSuccessOpen(true);
        setNameInput("");
      } else if (result.reason === "already_marked") {
        setErrorMsg("You are already marked present for today.");
      } else if (result.reason === "invalid_name") {
        setErrorMsg("Enter a name (up to 120 characters).");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
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
              src="/logo.png"
              alt=""
              className="h-9 w-auto shrink-0 object-contain"
              width={120}
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
            src="/logo.png"
            alt="Organization logo"
            className="mb-6 h-24 w-auto max-w-[min(100%,14rem)] object-contain drop-shadow-sm sm:h-28"
            width={180}
            height={72}
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
              Enter your name below, then confirm—you&apos;re all set.
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
              <Label htmlFor="person-name">Your name</Label>
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
              {loading ? "Saving…" : "Record my attendance"}
            </Button>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={successOpen} onOpenChange={setSuccessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
              You&apos;re checked in
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-muted-foreground">
                <p>
                  Your attendance for {formatDateDisplay(todayKey)} has been
                  recorded.
                </p>
                {welcomeNewVisitor ? (
                  <p>
                    Welcome <span className="font-medium text-foreground">{checkedInDisplayName}</span>!<br />
                    Please let the welcoming team know, they will help you get settled in.
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
