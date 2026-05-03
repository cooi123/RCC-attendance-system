import { useQuery } from "convex/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  PERSON_GENDER_LABELS,
  PERSON_ROSTER_STATUS_LABELS,
} from "@/lib/personRoster";
import { VISITOR_CHECKLIST_OPTIONS } from "@/lib/visitorIntake";
import { formatDateDisplay } from "@/lib/utils";

const checklistLabelById: Record<string, string> = Object.fromEntries(
  VISITOR_CHECKLIST_OPTIONS.map((o) => [o.id, o.label]),
);

type Props = { sessionToken: string };

export function VisitorsTab({ sessionToken }: Props) {
  const rows = useQuery(api.visitors.listVisitorIntakeSummaryAdmin, {
    sessionToken,
    visitorStatus: "NV",
  });

  if (!rows) return null;

  return (
    <TabsContent value="visitors">
      <Card>
        <CardHeader>
          <CardTitle>Visitors</CardTitle>
          <CardDescription>
            Intake-style fields for everyone on the visitor roster (NV, RV,
            VO). Visit date, family-with-me, and &ldquo;I&apos;m interested
            in&rdquo; selections come from their visitor profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visitor roster entries yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Given name</TableHead>
                  <TableHead>Surname</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Visitor type</TableHead>
                  <TableHead>Visit date</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Suburb</TableHead>
                  <TableHead>Contact by phone</TableHead>
                  <TableHead>Contact by email</TableHead>
                  <TableHead className="min-w-[12rem]">
                    Family with me
                  </TableHead>
                  <TableHead className="min-w-[14rem]">
                    I&apos;m interested in
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.personId}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {row.givenName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.surname || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {PERSON_GENDER_LABELS[row.gender]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {PERSON_ROSTER_STATUS_LABELS[row.visitorStatus]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.dateKey
                        ? formatDateDisplay(row.dateKey)
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.phone?.trim() ? row.phone : "—"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">
                      {row.email?.trim() ? row.email : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.suburb?.trim() ? row.suburb : "—"}
                    </TableCell>
                    <TableCell>{row.contactByPhone ? "Yes" : "No"}</TableCell>
                    <TableCell>{row.contactByEmail ? "Yes" : "No"}</TableCell>
                    <TableCell className="max-w-[14rem] whitespace-pre-wrap text-sm align-top">
                      {row.familyWithMe?.trim()
                        ? row.familyWithMe
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-[18rem] align-top text-sm">
                      {row.checklist && row.checklist.length > 0 ? (
                        <ul className="list-disc space-y-1 pl-4">
                          {row.checklist.map((id) => (
                            <li key={id}>
                              {checklistLabelById[id] ?? id}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
