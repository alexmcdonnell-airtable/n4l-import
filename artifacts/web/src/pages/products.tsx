import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts,
  getListProductsQueryKey,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  allergens: string | null;
  active: boolean;
  minInventory: number | null;
  maxInventory: number | null;
};

type FormState = {
  name: string;
  description: string;
  category: string;
  unit: string;
  sku: string;
  allergens: string;
  active: boolean;
  minInventory: string;
  maxInventory: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "",
  unit: "",
  sku: "",
  allergens: "",
  active: true,
  minInventory: "",
  maxInventory: "",
};

function nullable(v: string): string | null {
  const t = v.trim();
  return t.length === 0 ? null : t;
}

type InventoryParse =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

function parseInventory(v: string): InventoryParse {
  const t = v.trim();
  if (t.length === 0) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) {
    return { ok: false, error: "Must be a whole number ≥ 0." };
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Must be a whole number ≥ 0." };
  }
  return { ok: true, value: n };
}

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [sortBy, setSortBy] = useState<"minInventory" | "maxInventory" | null>(
    null,
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function toggleSort(key: "minInventory" | "maxInventory") {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  const list = useListProducts({
    query: { queryKey: getListProductsQueryKey() },
  });
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();

  const filtered = useMemo(() => {
    const data = list.data ?? [];
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q),
    );
  }, [list.data, search]);

  const sorted = useMemo(() => {
    if (!sortBy) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      // Nulls always sort last regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [filtered, sortBy, sortDir]);

  const minParse = parseInventory(form.minInventory);
  const maxParse = parseInventory(form.maxInventory);
  const minError = minParse.ok ? null : minParse.error;
  const maxError = maxParse.ok ? null : maxParse.error;
  const crossError =
    minParse.ok &&
    maxParse.ok &&
    minParse.value != null &&
    maxParse.value != null &&
    minParse.value > maxParse.value
      ? "Max inventory must be greater than or equal to min inventory."
      : null;

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListProductsQueryKey() });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "",
      unit: p.unit ?? "",
      sku: p.sku ?? "",
      allergens: p.allergens ?? "",
      active: p.active,
      minInventory: p.minInventory == null ? "" : String(p.minInventory),
      maxInventory: p.maxInventory == null ? "" : String(p.maxInventory),
    });
    setOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!minParse.ok || !maxParse.ok || crossError) {
      toast({
        title:
          minError ?? maxError ?? crossError ?? "Invalid inventory values",
        variant: "destructive",
      });
      return;
    }
    const body = {
      name: form.name.trim(),
      description: nullable(form.description),
      category: nullable(form.category),
      unit: nullable(form.unit),
      sku: nullable(form.sku),
      allergens: nullable(form.allergens),
      active: form.active,
      minInventory: minParse.value,
      maxInventory: maxParse.value,
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, data: body });
        toast({ title: "Product updated" });
      } else {
        await createMut.mutateAsync({ data: body });
        toast({ title: "Product created" });
      }
      setOpen(false);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleDelete(p: Product) {
    try {
      await deleteMut.mutateAsync({ id: p.id });
      toast({ title: `${p.name} deleted` });
      setConfirmDelete(null);
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  const formInvalid =
    !!minError || !!maxError || !!crossError || !form.name.trim();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catalog of items available for menu templates and weekly orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button onClick={openCreate} data-testid="button-new-product">
            <Plus className="w-4 h-4 mr-1.5" /> New product
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Product</th>
              <th className="text-left font-medium px-4 py-2.5">Category</th>
              <th className="text-left font-medium px-4 py-2.5">Unit / SKU</th>
              <th className="text-right font-medium px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("minInventory")}
                  className="inline-flex items-center gap-1 ml-auto hover:text-foreground"
                  data-testid="sort-min-inventory"
                  aria-label="Sort by minimum inventory"
                >
                  Min
                  {sortBy === "minInventory" &&
                    (sortDir === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
              </th>
              <th className="text-right font-medium px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => toggleSort("maxInventory")}
                  className="inline-flex items-center gap-1 ml-auto hover:text-foreground"
                  data-testid="sort-max-inventory"
                  aria-label="Sort by maximum inventory"
                >
                  Max
                  {sortBy === "maxInventory" &&
                    (sortDir === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
              </th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-right font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Loading products…
                </td>
              </tr>
            )}
            {!list.isLoading && filtered.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {search.trim()
                    ? "No products match your search."
                    : "No products yet. Add your first one to get started."}
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr
                key={p.id}
                className="border-t border-border align-top"
                data-testid={`row-product-${p.id}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{p.name}</div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-md">
                      {p.description}
                    </div>
                  )}
                  {p.allergens && (
                    <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Allergens: {p.allergens}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.category || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div>
                    {p.unit || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  {p.sku && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {p.sku}
                    </div>
                  )}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  data-testid={`cell-min-inventory-${p.id}`}
                >
                  {p.minInventory == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    p.minInventory
                  )}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  data-testid={`cell-max-inventory-${p.id}`}
                >
                  {p.maxInventory == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    p.maxInventory
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(p)}
                      data-testid={`button-edit-product-${p.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(p)}
                      data-testid={`button-delete-product-${p.id}`}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit product" : "New product"}
            </DialogTitle>
            <DialogDescription>
              Products appear in menu templates and weekly orders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="input-product-name"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-cat">Category</Label>
                <Input
                  id="p-cat"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-unit">Unit (e.g. case, pound)</Label>
                <Input
                  id="p-unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-sku">SKU / vendor code</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-all">Allergens</Label>
              <Input
                id="p-all"
                placeholder="e.g. dairy, peanuts"
                value={form.allergens}
                onChange={(e) =>
                  setForm({ ...form, allergens: e.target.value })
                }
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="p-min">Min inventory</Label>
                <Input
                  id="p-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="Leave blank if not configured"
                  value={form.minInventory}
                  onChange={(e) =>
                    setForm({ ...form, minInventory: e.target.value })
                  }
                  aria-invalid={!!minError}
                  data-testid="input-product-min-inventory"
                />
                {minError && (
                  <p
                    className="text-xs text-destructive"
                    data-testid="error-product-min-inventory"
                  >
                    {minError}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="p-max">Max inventory</Label>
                <Input
                  id="p-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  placeholder="Leave blank if not configured"
                  value={form.maxInventory}
                  onChange={(e) =>
                    setForm({ ...form, maxInventory: e.target.value })
                  }
                  aria-invalid={!!maxError || !!crossError}
                  data-testid="input-product-max-inventory"
                />
                {maxError && (
                  <p
                    className="text-xs text-destructive"
                    data-testid="error-product-max-inventory"
                  >
                    {maxError}
                  </p>
                )}
              </div>
            </div>
            {crossError && (
              <p
                className="text-xs text-destructive"
                data-testid="error-product-min-max-cross"
              >
                {crossError}
              </p>
            )}
            <div className="flex items-center gap-3 pt-1">
              <Switch
                id="p-active"
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              <Label htmlFor="p-active" className="cursor-pointer">
                Active (available for new orders)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMut.isPending || updateMut.isPending || formInvalid
              }
              data-testid="button-save-product"
            >
              {editing ? "Save changes" : "Create product"}
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
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be removed. If it's used by any menu
              template, default menu, or weekly order, the deletion will fail
              — deactivate it instead.
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
