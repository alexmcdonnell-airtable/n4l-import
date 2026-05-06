import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSchools,
  getListSchoolsQueryKey,
  useCreateSchool,
  useUpdateSchool,
  useDeleteSchool,
  useResetSchoolToken,
  useUpdateSchoolRoute,
  useListRoutes,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Copy,
  RotateCcw,
  Pencil,
  Trash2,
  AlertTriangle,
} from "lucide-react";

type School = {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  address: string | null;
  notes: string | null;
  accessUrl: string;
  tokenLastResetAt: string;
  routeId?: string | null;
  routeName?: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  contactName: string;
  contactEmail: string;
  address: string;
  notes: string;
  routeId: string | null;
};

const emptyForm: FormState = {
  name: "",
  contactName: "",
  contactEmail: "",
  address: "",
  notes: "",
  routeId: null,
};

const NO_ROUTE = "__none__";

function toFormState(s: School): FormState {
  return {
    name: s.name,
    contactName: s.contactName ?? "",
    contactEmail: s.contactEmail ?? "",
    address: s.address ?? "",
    notes: s.notes ?? "",
    routeId: s.routeId ?? null,
  };
}

function nullable(v: string): string | null {
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export default function SchoolsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tokenDialog, setTokenDialog] = useState<{
    schoolName: string;
    token: string;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null);
  const [confirmReset, setConfirmReset] = useState<School | null>(null);

  const list = useListSchools({ query: { queryKey: getListSchoolsQueryKey() } });
  const routesList = useListRoutes();
  const createMut = useCreateSchool();
  const updateMut = useUpdateSchool();
  const deleteMut = useDeleteSchool();
  const resetMut = useResetSchoolToken();
  const routeMut = useUpdateSchoolRoute();

  const filtered = useMemo(() => {
    const data = list.data ?? [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactName ?? "").toLowerCase().includes(q) ||
        (s.contactEmail ?? "").toLowerCase().includes(q),
    );
  }, [list.data, search]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setCreateOpen(true);
  }

  function openEdit(s: School) {
    setForm(toFormState(s));
    setEditing(s);
    setCreateOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const body = {
      name: form.name.trim(),
      contactName: nullable(form.contactName),
      contactEmail: nullable(form.contactEmail),
      address: nullable(form.address),
      notes: nullable(form.notes),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: body });
        if ((editing.routeId ?? null) !== (form.routeId ?? null)) {
          await routeMut.mutateAsync({
            id: editing.id,
            data: { routeId: form.routeId },
          });
        }
        toast({ title: "School updated" });
      } else {
        await createMut.mutateAsync({ data: body });
        toast({ title: "School created" });
      }
      setCreateOpen(false);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }

  async function handleReset(s: School) {
    try {
      const updated = await resetMut.mutateAsync({ id: s.id });
      setConfirmReset(null);
      setTokenDialog({ schoolName: updated.name, token: updated.accessToken });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Reset failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleDelete(s: School) {
    try {
      await deleteMut.mutateAsync({ id: s.id });
      setConfirmDelete(null);
      toast({ title: `${s.name} deleted` });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage partner school records and their private portal links.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search schools"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1.5" />
            New school
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Name</th>
              <th className="text-left font-medium px-4 py-2.5">Contact</th>
              <th className="text-left font-medium px-4 py-2.5">Route</th>
              <th className="text-left font-medium px-4 py-2.5">Access link</th>
              <th className="text-right font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading schools…
                </td>
              </tr>
            )}
            {!list.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  {search.trim()
                    ? "No schools match your search."
                    : "No schools yet. Add your first one to get started."}
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{s.name}</div>
                  {s.address && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.address}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div>{s.contactName || <span className="text-muted-foreground">—</span>}</div>
                  {s.contactEmail && (
                    <div className="text-xs text-muted-foreground">
                      {s.contactEmail}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {s.routeName ? (
                    <span className="text-xs font-medium text-foreground">
                      {s.routeName}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {s.accessUrl}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyText(s.accessUrl, "Access link")}
                      title="Copy masked link"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmReset(s)}
                      title="Reset access token"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(s)}
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(s)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit school" : "New school"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the school's profile."
                : "Create a school record. A private portal link will be generated automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name">School name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="cn">Contact name</Label>
                <Input
                  id="cn"
                  value={form.contactName}
                  onChange={(e) =>
                    setForm({ ...form, contactName: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ce">Contact email</Label>
                <Input
                  id="ce"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) =>
                    setForm({ ...form, contactEmail: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="addr">Address</Label>
              <Input
                id="addr"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {editing && (
              <div className="grid gap-1.5">
                <Label htmlFor="route">Default route</Label>
                <Select
                  value={form.routeId ?? NO_ROUTE}
                  onValueChange={(v) =>
                    setForm({ ...form, routeId: v === NO_ROUTE ? null : v })
                  }
                >
                  <SelectTrigger id="route">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ROUTE}>Unassigned</SelectItem>
                    {(routesList.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The route this school is delivered on by default. Changes
                  apply to the current week's order if one exists.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMut.isPending ||
                updateMut.isPending ||
                routeMut.isPending
              }
            >
              {editing ? "Save changes" : "Create school"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!tokenDialog}
        onOpenChange={(o) => !o && setTokenDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save this access link now</DialogTitle>
            <DialogDescription>
              For {tokenDialog?.schoolName}. This is the only time the full link
              will be shown. After closing this dialog you'll only see a masked
              version.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-secondary/60 border border-border rounded-md p-3 font-mono text-xs break-all">
            {tokenDialog
              ? `${window.location.origin}/s/${tokenDialog.token}`
              : ""}
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-accent/10 border border-accent/30 rounded-md p-3">
            <AlertTriangle className="w-4 h-4 text-accent-foreground/80 flex-shrink-0 mt-0.5" />
            <span>
              Treat this link like a password. Anyone with the link can view
              this school's profile. You can reset it any time.
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                tokenDialog && copyText(tokenDialog.token, "Token")
              }
            >
              Copy token only
            </Button>
            <Button
              onClick={() =>
                tokenDialog &&
                copyText(
                  `${window.location.origin}/s/${tokenDialog.token}`,
                  "Full URL",
                )
              }
            >
              <Copy className="w-4 h-4 mr-1.5" /> Copy full URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmReset}
        onOpenChange={(o) => !o && setConfirmReset(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset access link?</AlertDialogTitle>
            <AlertDialogDescription>
              The current link for {confirmReset?.name} will stop working
              immediately. A new link will be generated and shown once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReset && handleReset(confirmReset)}
            >
              Reset link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this school?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be permanently removed. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && handleDelete(confirmDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
