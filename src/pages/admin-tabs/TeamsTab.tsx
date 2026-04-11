import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { Id } from "../../../convex/_generated/dataModel";

type Props = { sessionToken: string };

export function TeamsTab({ sessionToken }: Props) {
  const teams = useQuery(api.teams.listTeams, { sessionToken });

  const createTeam = useMutation(api.teams.createTeam);
  const deleteTeam = useMutation(api.teams.deleteTeam);
  const renameTeam = useMutation(api.teams.renameTeam);

  const [teamName, setTeamName] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTeamId, setRenameTeamId] = useState<Id<"teams"> | null>(null);
  const [renameValue, setRenameValue] = useState("");

  if (!teams) return null;

  return (
    <>
      <TabsContent value="teams">
        <Card>
          <CardHeader>
            <CardTitle>Cell groups</CardTitle>
            <CardDescription>
              Cell groups (CG) can be assigned to people from the People tab.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!teamName.trim()) return;
                await createTeam({ sessionToken, name: teamName.trim() });
                setTeamName("");
              }}
            >
              <Input
                placeholder="New cell group name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="sm:max-w-xs"
              />
              <Button type="submit">Add cell group</Button>
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cell group name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRenameTeamId(t._id);
                            setRenameValue(t.name);
                            setRenameOpen(true);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (
                              confirm(
                                `Delete cell group "${t.name}"? People in this cell group will be unassigned.`,
                              )
                            ) {
                              deleteTeam({ sessionToken, teamId: t._id });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Rename dialog ── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename cell group</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!renameTeamId || !renameValue.trim()) return;
                await renameTeam({
                  sessionToken,
                  teamId: renameTeamId,
                  name: renameValue.trim(),
                });
                setRenameOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
