import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
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
  PERSON_GENDER_LABELS,
  PERSON_ROSTER_STATUS_LABELS,
  type PersonGender,
} from "@/lib/personRoster";
import { formatDateDisplay, formatTodayKey } from "@/lib/utils";
import { VISITOR_CHECKLIST_OPTIONS } from "@/lib/visitorIntake";

export type VisitorIntakeVisitorStatus = "NV" | "RV" | "VO";

const VISITOR_STATUSES: VisitorIntakeVisitorStatus[] = ["NV", "RV", "VO"];

export type VisitorIntakeFamilyMember = {
  id: string;
  givenName: string;
  surname: string;
  relationship: string;
};

function newFamilyMemberId(): string {
  return `fm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function familyMemberDisplayLine(m: VisitorIntakeFamilyMember): string {
  const g = m.givenName.trim();
  const s = m.surname.trim();
  const rel = m.relationship.trim();
  const parts = [g, s].filter((x) => x.length > 0);
  const base = parts.length > 0 ? parts.join(" ") : g;
  if (!base) return "";
  return rel.length > 0 ? `${base} (${rel})` : base;
}

function serializeFamilyMembers(members: VisitorIntakeFamilyMember[]): string {
  return members
    .map((m) => {
      const line = familyMemberDisplayLine(m);
      return line.length > 0 ? line : null;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

export type VisitorIntakeValues = {
  givenName: string;
  surname: string;
  gender: PersonGender;
  visitorStatus: VisitorIntakeVisitorStatus;
  dateKey: string;
  phone: string;
  email: string;
  suburb: string;
  contactByPhone: boolean;
  contactByEmail: boolean;
  familyMembers: Array<{
    givenName: string;
    surname: string;
    relationship: string;
  }>;
  familyWithMe: string;
  checklist: string[];
};

type Props = {
  /** Change this (e.g. increment) to reset all fields to defaults. */
  resetSignal: number;
  idPrefix: string;
  submitLabel: string;
  loading?: boolean;
  /** Shown before the submit button (e.g. Cancel). */
  leadingFooter?: React.ReactNode;
  /** When false, visitor type is fixed to new visitor (NV) and hidden. */
  showVisitorType?: boolean;
  onSubmit: (values: VisitorIntakeValues) => void | Promise<void>;
};

export function VisitorIntakeForm({
  resetSignal,
  idPrefix,
  submitLabel,
  loading = false,
  leadingFooter,
  showVisitorType = true,
  onSubmit,
}: Props) {
  const [givenName, setGivenName] = useState("");
  const [surname, setSurname] = useState("");
  const [gender, setGender] = useState<PersonGender>("male");
  const [visitorStatus, setVisitorStatus] =
    useState<VisitorIntakeVisitorStatus>("NV");
  const [dateKey, setDateKey] = useState(() => formatTodayKey());
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [suburb, setSuburb] = useState("");
  const [contactByPhone, setContactByPhone] = useState(false);
  const [contactByEmail, setContactByEmail] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<VisitorIntakeFamilyMember[]>([]);
  const [familyGivenDraft, setFamilyGivenDraft] = useState("");
  const [familySurnameDraft, setFamilySurnameDraft] = useState("");
  const [familyRelationshipDraft, setFamilyRelationshipDraft] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  useEffect(() => {
    setGivenName("");
    setSurname("");
    setGender("male");
    setVisitorStatus("NV");
    setDateKey(formatTodayKey());
    setPhone("");
    setEmail("");
    setSuburb("");
    setContactByPhone(false);
    setContactByEmail(false);
    setFamilyMembers([]);
    setFamilyGivenDraft("");
    setFamilySurnameDraft("");
    setFamilyRelationshipDraft("");
    setChecklist([]);
  }, [resetSignal]);

  function toggleChecklist(id: string) {
    setChecklist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(dateKey);
  const contactPrefsValid =
    (!contactByEmail || email.trim().length > 0) &&
    (!contactByPhone || phone.trim().length > 0);
  const canSubmit =
    givenName.trim().length > 0 &&
    dateOk &&
    contactPrefsValid &&
    !loading;

  function addFamilyMember() {
    const g = familyGivenDraft.trim();
    if (!g) return;
    setFamilyMembers((prev) => [
      ...prev,
      {
        id: newFamilyMemberId(),
        givenName: g,
        surname: familySurnameDraft.trim(),
        relationship: familyRelationshipDraft.trim(),
      },
    ]);
    setFamilyGivenDraft("");
    setFamilySurnameDraft("");
    setFamilyRelationshipDraft("");
  }

  function removeFamilyMember(id: string) {
    setFamilyMembers((prev) => prev.filter((row) => row.id !== id));
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    await onSubmit({
      givenName,
      surname,
      gender,
      visitorStatus,
      dateKey,
      phone,
      email,
      suburb,
      contactByPhone,
      contactByEmail,
      familyMembers: familyMembers.map((m) => ({
        givenName: m.givenName.trim(),
        surname: m.surname.trim(),
        relationship: m.relationship.trim(),
      })),
      familyWithMe: serializeFamilyMembers(familyMembers),
      checklist,
    });
  }

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-date`}>Visit date</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {dateOk ? formatDateDisplay(dateKey) : "Choose a calendar date"}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-given`}>Given name</Label>
            <Input
              id={`${idPrefix}-given`}
              value={givenName}
              onChange={(e) => setGivenName(e.target.value)}
              autoComplete="given-name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-surname`}>Surname</Label>
            <Input
              id={`${idPrefix}-surname`}
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-phone`}>Phone</Label>
            <Input
              id={`${idPrefix}-phone`}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-email`}>Email</Label>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-suburb`}>Suburb</Label>
            <Input
              id={`${idPrefix}-suburb`}
              value={suburb}
              onChange={(e) => setSuburb(e.target.value)}
              autoComplete="address-level2"
            />
          </div>
        </div>
        <div className="space-y-3 rounded-md border border-border bg-muted/25 px-3 py-3">
          <p className="text-sm font-medium leading-none">
            How should we contact you?
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              checked={contactByPhone}
              onChange={(e) => setContactByPhone(e.target.checked)}
            />
            <span>I would like to be contacted by phone</span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
              checked={contactByEmail}
              onChange={(e) => setContactByEmail(e.target.checked)}
            />
            <span>I would like to be contacted by email</span>
          </label>
          {!contactPrefsValid ? (
            <div className="space-y-1 text-xs text-destructive" role="alert">
              {contactByEmail && email.trim().length === 0 ? (
                <p>Enter an email address, or turn off contact by email.</p>
              ) : null}
              {contactByPhone && phone.trim().length === 0 ? (
                <p>Enter a phone number, or turn off contact by phone.</p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium leading-none">
            Family members with me
          </span>
          <p className="text-xs text-muted-foreground">
            Add each person with given name, surname, and relationship.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-start">
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${idPrefix}-family-given`}>Given name</Label>
                <Input
                  id={`${idPrefix}-family-given`}
                  value={familyGivenDraft}
                  onChange={(e) => setFamilyGivenDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFamilyMember();
                    }
                  }}
                  placeholder="e.g. Jane"
                  autoComplete="given-name"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${idPrefix}-family-surname`}>Surname</Label>
                <Input
                  id={`${idPrefix}-family-surname`}
                  value={familySurnameDraft}
                  onChange={(e) => setFamilySurnameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFamilyMember();
                    }
                  }}
                  placeholder="e.g. Smith"
                  autoComplete="family-name"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor={`${idPrefix}-family-rel`}>Relationship</Label>
                <Input
                  id={`${idPrefix}-family-rel`}
                  value={familyRelationshipDraft}
                  onChange={(e) => setFamilyRelationshipDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFamilyMember();
                    }
                  }}
                  placeholder="e.g. spouse, daughter"
                />
              </div>
            </div>
            <div className="flex sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full gap-1.5 sm:w-auto"
                onClick={addFamilyMember}
                disabled={!familyGivenDraft.trim()}
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
          {familyMembers.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border bg-muted/20">
              {familyMembers.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 font-medium text-foreground">
                    {familyMemberDisplayLine(row)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeFamilyMember(row.id)}
                    aria-label={`Remove ${familyMemberDisplayLine(row)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>I&apos;m interested in</Label>
          <ul className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-3">
            {VISITOR_CHECKLIST_OPTIONS.map((opt) => (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                    checked={checklist.includes(opt.id)}
                    onChange={() => toggleChecklist(opt.id)}
                  />
                  <span>{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={gender}
            onValueChange={(v) => setGender(v as PersonGender)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERSON_GENDER_LABELS) as PersonGender[]).map(
                (g) => (
                  <SelectItem key={g} value={g}>
                    {PERSON_GENDER_LABELS[g]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
        {showVisitorType ? (
          <div className="space-y-2">
            <Label>Visitor type</Label>
            <Select
              value={visitorStatus}
              onValueChange={(v) =>
                setVisitorStatus(v as VisitorIntakeVisitorStatus)
              }
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
        ) : null}
      </div>
      <DialogFooter>
        {leadingFooter}
        <Button
          type="button"
          className="gap-2"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
