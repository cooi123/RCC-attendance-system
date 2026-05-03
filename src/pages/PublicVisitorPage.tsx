import { useMutation } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  VisitorIntakeForm,
  type VisitorIntakeValues,
} from "@/components/VisitorIntakeForm";
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
import { api } from "../../convex/_generated/api";
import { formatDateDisplay } from "@/lib/utils";

const LOGO_URL = `${import.meta.env.BASE_URL}logo.png`;

export function PublicVisitorPage() {
  const navigate = useNavigate();
  const submitPublicVisitorIntake = useMutation(
    api.visitors.submitPublicVisitorIntake,
  );
  const [loading, setLoading] = useState(false);
  const [formNonce, setFormNonce] = useState(0);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successDateKey, setSuccessDateKey] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(values: VisitorIntakeValues) {
    setErrorMsg(null);
    setLoading(true);
    try {
      const hasVisitDetails =
        values.familyWithMe.trim().length > 0 || values.checklist.length > 0;
      const result = await submitPublicVisitorIntake({
        givenName: values.givenName,
        surname: values.surname,
        gender: values.gender,
        visitorStatus: values.visitorStatus,
        dateKey: values.dateKey,
        phone: values.phone.trim() ? values.phone : undefined,
        email: values.email.trim() ? values.email : undefined,
        suburb: values.suburb.trim() ? values.suburb : undefined,
        contactByEmail: values.contactByEmail,
        contactByPhone: values.contactByPhone,
        familyMembers: values.familyMembers,
        ...(hasVisitDetails
          ? {
              visitorVisitDetails: {
                familyWithMe: values.familyWithMe.trim() || undefined,
                checklist:
                  values.checklist.length > 0 ? values.checklist : undefined,
              },
            }
          : {}),
      });
      if (!result.ok) {
        if (result.reason === "already_marked") {
          setErrorMsg(
            `You already have attendance recorded for ${formatDateDisplay(values.dateKey)}. If that is wrong, speak to the welcome team.`,
          );
        } else if (result.reason === "invalid_date") {
          setErrorMsg(
            "That date is not valid. Please choose a date from the calendar.",
          );
        } else if (result.reason === "invalid_email") {
          setErrorMsg("Please enter a valid email address.");
        } else if (result.reason === "invalid_contact") {
          setErrorMsg(
            "If you choose contact by email or phone, fill in that field.",
          );
        } else {
          setErrorMsg("Please check your name fields and try again.");
        }
        return;
      }
      setSuccessDateKey(values.dateKey);
      setSuccessOpen(true);
      setFormNonce((n) => n + 1);
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
            <p className="truncate text-sm font-medium text-muted-foreground">
              New visitor
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" asChild>
            <Link to="/">Check-in</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={LOGO_URL}
            alt=""
            className="mb-4 h-20 w-auto max-w-[min(100%,12rem)] object-contain drop-shadow-sm sm:h-24"
            width={96}
            height={96}
          />
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Visitor registration
          </h1>
        </div>

        <Card className="border-border/80 shadow-md shadow-black/[0.04]">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-lg font-medium">Your details</CardTitle>
            <CardDescription>
              Please fill in your details so that we can follow up with you.
              If you choose contact by email or phone, fill in that field.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            {errorMsg ? (
              <p className="text-sm text-destructive" role="alert">
                {errorMsg}
              </p>
            ) : null}
            <VisitorIntakeForm
              resetSignal={formNonce}
              idPrefix="pub-v"
              showVisitorType={false}
              submitLabel="Submit registration"
              loading={loading}
              leadingFooter={
                <Button type="button" variant="outline" asChild>
                  <Link to="/">Back</Link>
                </Button>
              }
              onSubmit={(values) => void handleSubmit(values)}
            />
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
                Your registration for{" "}
                {successDateKey
                  ? formatDateDisplay(successDateKey)
                  : "that date"}{" "}
                has been received. We&apos;re glad you&apos;re here.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setSuccessOpen(false);
                navigate("/");
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
