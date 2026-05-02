import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListStaff,
  getListStaffQueryKey,
  useUpdateStaff,
  useInviteStaff,
  useRemoveStaff,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { UserPlus, Trash2 } from "lucide-react";
import type { Role } from "@/lib/roles";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "staff", label: "Staff" },
  { value: "warehouse", label: "Warehouse" },
];

function StatusBadge({ status }: { status: string }) {
  if (status === "invited") {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
        Invited
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-muted text-muted-foreground">
      Inactive
    </Badge>
  );
}

export default function StaffPage() {
  const qc = useQueryClient();
  const { data: auth } = useAuth();
  const list = useListStaff({ query: { queryKey: getListStaffQueryKey() } });
  const updateMut = useUpdateStaff();
  const inviteMut = useInviteStaff();
  const removeMut = useRemoveStaff();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("staff");
  const [inviting, setInviting] = useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListStaffQueryKey() });

  async function update(
    id: string,
    body: { role?: Role; active?: boolean },
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

  async function updateInvitedRole(email: string, role: Role) {
    try {
      await inviteMut.mutateAsync({ data: { email, role } });
      toast({ title: "Role updated" });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Update failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      await inviteMut.mutateAsync({ data: { email, role: inviteRole } });
      toast({ title: `${email} added to the access list` });
      setInviteEmail("");
      setInviteRole("staff" as Role);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add staff member";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(id: string, label: string) {
    if (!window.confirm(`Remove ${label} from the access list? They will no longer be able to sign in.`)) {
      return;
    }
    try {
      await removeMut.mutateAsync({ id });
      toast({ title: `${label} removed` });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Remove failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage who can access this portal. Only allowlisted emails can sign
          in. The first person to sign in is automatically made admin.
        </p>
      </header>

      {/* Add Staff Form */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm p-5">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          Add staff member
        </h2>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs text-muted-foreground mb-1">
              Email address
            </label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              className="h-9"
            />
          </div>
          <div className="w-36">
            <label className="block text-xs text-muted-foreground mb-1">
              Role
            </label>
            <Select
              value={inviteRole}
              onValueChange={(v) => setInviteRole(v as Role)}
            >
              <SelectTrigger className="h-9" data-testid="select-invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviting} className="h-9">
            {inviting ? "Adding…" : "Add"}
          </Button>
        </form>
      </div>

      {/* Staff Table */}
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Member</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Role</th>
              <th className="text-left font-medium px-4 py-2.5">Last sign in</th>
              <th className="text-center font-medium px-4 py-2.5">Active</th>
              <th className="text-right font-medium px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Loading team…
                </td>
              </tr>
            )}
            {!list.isLoading && (list.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No team members yet.
                </td>
              </tr>
            )}
            {list.data?.map((m) => {
              const isInvited = m.status === "invited";
              const fullName = isInvited
                ? (m.email ?? m.id)
                : [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email || m.id;
              const isSelf = m.id === auth?.user?.id;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{fullName}</div>
                    {!isInvited && m.email && (
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
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.role}
                      onValueChange={(v) => {
                        if (isInvited && m.email) {
                          updateInvitedRole(m.email, v as Role);
                        } else {
                          update(m.id, { role: v as Role });
                        }
                      }}
                      disabled={isSelf}
                    >
                      <SelectTrigger
                        className="w-36"
                        data-testid={`select-role-${m.id}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.lastLoginAt
                      ? new Date(m.lastLoginAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <Switch
                        checked={m.active}
                        disabled={isSelf || isInvited}
                        onCheckedChange={(v) => update(m.id, { active: v })}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        disabled={isSelf}
                        onClick={() => handleRemove(m.id, m.email ?? m.id)}
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
