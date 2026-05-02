import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMenuTemplates,
  getListMenuTemplatesQueryKey,
  useCreateMenuTemplate,
  useUpdateMenuTemplate,
  useDeleteMenuTemplate,
  useAddMenuTemplateItem,
  useUpdateMenuTemplateItem,
  useRemoveMenuTemplateItem,
  useListProducts,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type Item = {
  id: string;
  templateId: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    unit: string | null;
    category: string | null;
  };
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  items: Item[];
};

function nullable(v: string): string | null {
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export default function MenuTemplatesPage() {
  const qc = useQueryClient();
  const list = useListMenuTemplates({
    query: { queryKey: getListMenuTemplatesQueryKey() },
  });
  const products = useListProducts({
    query: { queryKey: getListProductsQueryKey() },
  });
  const createMut = useCreateMenuTemplate();
  const updateMut = useUpdateMenuTemplate();
  const deleteMut = useDeleteMenuTemplate();
  const addItemMut = useAddMenuTemplateItem();
  const updateItemMut = useUpdateMenuTemplateItem();
  const removeItemMut = useRemoveMenuTemplateItem();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [addRow, setAddRow] = useState<
    Record<string, { productId: string; quantity: string }>
  >({});

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListMenuTemplatesQueryKey() });

  const activeProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.active),
    [products.data],
  );

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "" });
    setEditorOpen(true);
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({ name: t.name, description: t.description ?? "" });
    setEditorOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const body = {
      name: form.name.trim(),
      description: nullable(form.description),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: body });
        toast({ title: "Template updated" });
      } else {
        const created = await createMut.mutateAsync({ data: body });
        setExpanded((s) => ({ ...s, [created.id]: true }));
        toast({ title: "Template created — now add some items." });
      }
      setEditorOpen(false);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleDelete(t: Template) {
    try {
      await deleteMut.mutateAsync({ id: t.id });
      toast({ title: `${t.name} deleted` });
      setConfirmDelete(null);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleAddItem(t: Template) {
    const row = addRow[t.id];
    if (!row?.productId) {
      toast({ title: "Pick a product first", variant: "destructive" });
      return;
    }
    const qty = Math.max(0, Number.parseInt(row.quantity || "0", 10));
    if (Number.isNaN(qty)) {
      toast({ title: "Quantity must be a number", variant: "destructive" });
      return;
    }
    try {
      await addItemMut.mutateAsync({
        id: t.id,
        data: { productId: row.productId, quantity: qty },
      });
      setAddRow((s) => ({ ...s, [t.id]: { productId: "", quantity: "" } }));
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add item";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function updateItemQty(t: Template, item: Item, qty: number) {
    try {
      await updateItemMut.mutateAsync({
        id: t.id,
        itemId: item.id,
        data: { quantity: qty },
      });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function removeItem(t: Template, item: Item) {
    try {
      await removeItemMut.mutateAsync({ id: t.id, itemId: item.id });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Menu templates
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable menus you can stamp onto a school as their default order.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-template">
          <Plus className="w-4 h-4 mr-1.5" /> New template
        </Button>
      </div>

      <div className="space-y-3">
        {list.isLoading && (
          <div className="bg-card border border-card-border rounded-xl p-10 text-center text-muted-foreground">
            Loading templates…
          </div>
        )}
        {!list.isLoading && (list.data?.length ?? 0) === 0 && (
          <div className="bg-card border border-card-border rounded-xl p-10 text-center text-muted-foreground">
            No templates yet. Create your first reusable menu.
          </div>
        )}
        {(list.data ?? []).map((t) => {
          const isExpanded = expanded[t.id] ?? false;
          const ar = addRow[t.id] ?? { productId: "", quantity: "" };
          return (
            <div
              key={t.id}
              className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden"
              data-testid={`card-template-${t.id}`}
            >
              <div className="px-4 py-3 flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-1 mt-0.5"
                  onClick={() =>
                    setExpanded((s) => ({ ...s, [t.id]: !isExpanded }))
                  }
                  data-testid={`button-toggle-template-${t.id}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="font-medium">{t.name}</div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    {t.items.length} item{t.items.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(t)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border bg-secondary/30 px-4 py-4 space-y-3">
                  {t.items.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No items yet.
                    </div>
                  )}
                  {t.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2"
                      data-testid={`row-template-item-${item.id}`}
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {item.product.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[item.product.category, item.product.unit]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        defaultValue={item.quantity}
                        className="w-24"
                        onBlur={(e) => {
                          const v = Math.max(
                            0,
                            Number.parseInt(e.target.value || "0", 10),
                          );
                          if (!Number.isNaN(v) && v !== item.quantity) {
                            updateItemQty(t, item, v);
                          }
                        }}
                        data-testid={`input-template-item-qty-${item.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(t, item)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    <Select
                      value={ar.productId}
                      onValueChange={(v) =>
                        setAddRow((s) => ({
                          ...s,
                          [t.id]: { ...ar, productId: v },
                        }))
                      }
                    >
                      <SelectTrigger
                        className="flex-1"
                        data-testid={`select-add-product-${t.id}`}
                      >
                        <SelectValue placeholder="Pick a product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                            {p.unit ? ` (${p.unit})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Qty"
                      value={ar.quantity}
                      onChange={(e) =>
                        setAddRow((s) => ({
                          ...s,
                          [t.id]: { ...ar, quantity: e.target.value },
                        }))
                      }
                      className="w-24"
                    />
                    <Button
                      onClick={() => handleAddItem(t)}
                      data-testid={`button-add-template-item-${t.id}`}
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Add
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit template" : "New template"}
            </DialogTitle>
            <DialogDescription>
              Give this menu a memorable name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-template-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="t-desc">Description</Label>
              <Textarea
                id="t-desc"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
              data-testid="button-save-template"
            >
              {editing ? "Save changes" : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be removed. Schools that have already
              had it stamped will keep their copy of the items.
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
