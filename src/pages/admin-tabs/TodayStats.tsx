import { useQuery } from "convex/react";
import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const stats = useMemo(() => {
    if (!todayRoster || !people) return null;
    const statusById = new Map(people.map((p) => [p._id, p.status]));
    let attending = 0;
    const newVisitors: string[] = [];

    for (const row of todayRoster.rows) {
      const isPresent = row.dayStatus?.[0] === "present";
      if (!isPresent) continue;
      const status = statusById.get(row.personId);
      if (status === "NV") {
        newVisitors.push(row.name);
      } else {
        attending++;
      }
    }

    return { attending, newVisitors };
  }, [todayRoster, people]);

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
            <ul className="space-y-0.5">
              {stats.newVisitors.map((name) => (
                <li key={name} className="text-sm font-medium">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
