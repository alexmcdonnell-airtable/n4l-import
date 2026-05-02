import { useQueryClient } from "@tanstack/react-query";
import {
  useListStaff,
  getListStaffQueryKey,
  useUpdateStaff,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function StaffPage() {
  const qc = useQueryClient();
  const { data: auth } = useAuth();
  const list = useListStaff({ query: { queryKey: getListStaffQueryKey() } });
  const updateMut = useUpdateStaff();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListStaffQueryKey() });

  async function update(
    id: string,
    body: { role?: "admin" | "staff"; active?: boolean },
  ) {
    try {
      await updateMut.mutateAsync({ id, data: body });
      toast({ title: "Updated" });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Internal team members who can sign in. The first person to sign in
          was promoted to admin automatically.
        </p>
      </header>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Member</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Last sign in</th>
              <th className="text-right font-medium px-4 py-2.5">Active</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  Loading team…
                </td>
              </tr>
            )}
            {!list.isLoading && (list.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No team members yet.
                </td>
              </tr>
            )}
            {list.data?.map((m) => {
              const fullName =
                [m.firstName, m.lastName].filter(Boolean).join(" ") ||
                m.email ||
                m.id;
              const isSelf = m.id === auth?.user?.id;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{fullName}</div>
                    {m.email && (
                      <div className="text-xs text-muted-foreground">
                        {m.email}
                      </div>
                    )}
                    {isSelf && (
                      <Badge variant="secondary" className="mt-1">
                        You
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        update(m.id, { role: v as "admin" | "staff" })
                      }
                      disabled={isSelf}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.lastLoginAt
                      ? new Date(m.lastLoginAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Switch
                        checked={m.active}
                        disabled={isSelf}
                        onCheckedChange={(v) => update(m.id, { active: v })}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
