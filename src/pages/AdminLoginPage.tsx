import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { SESSION_KEY } from "@/lib/utils";

export function AdminLoginPage() {
  const navigate = useNavigate();
  const hasAdmin = useQuery(api.setup.hasAnyAdmin);
  const login = useAction(api.nodeAuth.login);
  const bootstrap = useAction(api.nodeAuth.bootstrapFirstAdmin);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await login({ username, password });
      if (!token) {
        setError("Invalid username or password.");
        return;
      }
      localStorage.setItem(SESSION_KEY, token);
      navigate("/admin", { replace: true });
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await bootstrap({ username, password });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      const token = await login({ username, password });
      if (token) {
        localStorage.setItem(SESSION_KEY, token);
        navigate("/admin", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  if (hasAdmin === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const isBootstrap = !hasAdmin;

  return (
    <div className="min-h-dvh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <Button variant="ghost" className="mb-6 -ml-2" asChild>
          <Link to="/">← Back to attendance</Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">
              {isBootstrap ? "Create admin account" : "Helper sign in"}
            </CardTitle>
            <CardDescription>
              {isBootstrap
                ? "No admin exists yet. Create the first account (username and password are stored securely)."
                : "Sign in to manage people, teams, and attendance."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={isBootstrap ? handleBootstrap : handleLogin}
            >
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={
                    isBootstrap ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isBootstrap ? 8 : undefined}
                  className="h-11"
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="h-11 w-full"
                disabled={loading}
              >
                {loading
                  ? "Please wait…"
                  : isBootstrap
                    ? "Create admin & sign in"
                    : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
