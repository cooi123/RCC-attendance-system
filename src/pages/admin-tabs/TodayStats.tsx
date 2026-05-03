import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../convex/_generated/api";
import { formatDateDisplay, formatTodayKey } from "@/lib/utils";

type Props = { sessionToken: string };

export function TodayStats({ sessionToken }: Props) {
  const todayKey = formatTodayKey();

  const people = useQuery(api.people.listPeopleAdmin, { sessionToken });
  const todayRoster = useQuery(
    api.attendance.listRosterWeekAttendanceAdmin,
    { sessionToken, dayKeys: [todayKey] },
  );
  const visitorSummary = useQuery(api.visitors.listVisitorIntakeSummaryAdmin, {
    sessionToken,
  });

  const stats = useMemo(() => {
    if (!todayRoster || !people || !visitorSummary) return null;
    const statusById = new Map(people.map((p) => [p._id, p.status]));
    const familyByPersonId = new Map<string, string[]>();
    for (const row of visitorSummary) {
      const raw = row.familyWithMe ?? "";
      const family = raw
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
      if (family.length > 0) {
        familyByPersonId.set(row.personId, family);
      }
    }
    let attending = 0;
    const newVisitors: Array<{
      personId: string;
      name: string;
      hasFamily: boolean;
      familyMembers: string[];
    }> = [];

    for (const row of todayRoster.rows) {
      const isPresent = row.dayStatus?.[0] === "present";
      if (!isPresent) continue;
      const status = statusById.get(row.personId);
      if (status === "NV") {
        const familyMembers = familyByPersonId.get(row.personId) ?? [];
        newVisitors.push({
          personId: row.personId,
          name: row.name,
          hasFamily: familyMembers.length > 0,
          familyMembers,
        });
      } else {
        attending++;
      }
    }

    return { attending, newVisitors };
  }, [todayRoster, people, visitorSummary]);

  const todayLabel = formatDateDisplay(todayKey);

  return (
    <section className="mb-6 grid gap-3 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Today · {todayLabel}</CardDescription>
          <CardTitle className="text-2xl">Attending</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {stats ? stats.attending : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Members &amp; return visitors
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Today · {todayLabel}</CardDescription>
          <CardTitle className="text-2xl">New visitors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">
            {stats ? stats.newVisitors.length : "—"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">First-time visitors</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-xs">Today · {todayLabel}</CardDescription>
          <CardTitle className="text-xl">New visitor names</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats || stats.newVisitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet today</p>
          ) : (
            <ul className="space-y-2">
              {stats.newVisitors.map((visitor) => (
                <li
                  key={visitor.personId}
                  className="space-y-1"
                >
                  <div className="flex items-center justify-between gap-2 text-sm font-medium">
                    <span className={visitor.hasFamily ? "text-primary" : undefined}>
                      {visitor.name}
                    </span>
                    {visitor.hasFamily ? (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        Family
                      </Badge>
                    ) : null}
                  </div>
                  {visitor.familyMembers.length > 0 ? (
                    <ul className="ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
                      {visitor.familyMembers.map((member) => (
                        <li key={`${visitor.personId}-${member}`}>{member}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
