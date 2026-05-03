import { useMutation } from "convex/react";
import { LogOut } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "../../convex/_generated/api";
import { SESSION_KEY } from "@/lib/utils";
import { AttendanceTab } from "./admin-tabs/AttendanceTab";
import { PeopleTab } from "./admin-tabs/PeopleTab";
import { TeamsTab } from "./admin-tabs/TeamsTab";
import { TodayStats } from "./admin-tabs/TodayStats";
import { VisitorsTab } from "./admin-tabs/VisitorsTab";

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const sessionToken = localStorage.getItem(SESSION_KEY);

  useEffect(() => {
    if (!sessionToken) {
      navigate("/admin/login", { replace: true });
    }
  }, [sessionToken, navigate]);

  const logout = useMutation(api.sessions.logout);

  async function handleLogout() {
    if (!sessionToken) return;
    await logout({ sessionToken });
    localStorage.removeItem(SESSION_KEY);
    navigate("/admin/login", { replace: true });
  }

  if (!sessionToken) {
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
              People, visitors, cell groups, attendance
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
        <TodayStats sessionToken={sessionToken} />
        <Tabs defaultValue="people" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 sm:inline-flex sm:w-auto">
            <TabsTrigger value="people">People</TabsTrigger>
            <TabsTrigger value="visitors">Visitors</TabsTrigger>
            <TabsTrigger value="teams">Cell groups</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <PeopleTab sessionToken={sessionToken} />
          <VisitorsTab sessionToken={sessionToken} />
          <TeamsTab sessionToken={sessionToken} />
          <AttendanceTab sessionToken={sessionToken} />
        </Tabs>
      </main>
    </div>
  );
}
