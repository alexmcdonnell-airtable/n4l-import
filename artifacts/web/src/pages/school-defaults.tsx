import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSchools,
  getListSchoolsQueryKey,
  useGetSchoolDefaultMenu,
  getGetSchoolDefaultMenuQueryKey,
  useAddSchoolDefaultMenuItem,
  useUpdateSchoolDefaultMenuItem,
  useRemoveSchoolDefaultMenuItem,
  useStampTemplateOntoSchool,
  useListMenuTemplates,
  getListMenuTemplatesQueryKey,
  useListProducts,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Trash2, Stamp } from "lucide-react";

export default function SchoolDefaultsPage() {
  const qc = useQueryClient();
  const schools = useListSchools({
    query: { queryKey: getListSchoolsQueryKey() },
  });
  const templates = useListMenuTemplates({
    query: { queryKey: getListMenuTemplatesQueryKey() },
  });
  const products = useListProducts({
    query: { queryKey: getListProductsQueryKey() },
  });

  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const effectiveId =
    selectedSchoolId || schools.data?.[0]?.id || "";

  const menu = useGetSchoolDefaultMenu(effectiveId, {
    query: {
      enabled: !!effectiveId,
      queryKey: getGetSchoolDefaultMenuQueryKey(effectiveId),
    },
  });

  const addMut = useAddSchoolDefaultMenuItem();
  const updateMut = useUpdateSchoolDefaultMenuItem();
  const removeMut = useRemoveSchoolDefaultMenuItem();
  const stampMut = useStampTemplateOntoSchool();

  const [pendingTemplate, setPendingTemplate] = useState<string>("");
  const [confirmStamp, setConfirmStamp] = useState<{
    templateId: string;
    templateName: string;
    schoolName: string;
  } | null>(null);
  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("");

  const activeProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.active),
    [products.data],
  );

  const invalidateMenu = () =>
    qc.invalidateQueries({
      queryKey: getGetSchoolDefaultMenuQueryKey(effectiveId),
    });

  async function handleStamp() {
    if (!confirmStamp) return;
    try {
      await stampMut.mutateAsync({
        id: effectiveId,
        data: { templateId: confirmStamp.templateId },
      });
      toast({
        title: `Stamped "${confirmStamp.templateName}" onto ${confirmStamp.schoolName}`,
      });
      setConfirmStamp(null);
      setPendingTemplate("");
      invalidateMenu();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stamp failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleAdd() {
    if (!effectiveId || !addProductId) {
      toast({ title: "Pick a product", variant: "destructive" });
      return;
    }
    const qty = Math.max(0, Number.parseInt(addQty || "0", 10));
    if (Number.isNaN(qty)) {
      toast({ title: "Quantity must be a number", variant: "destructive" });
      return;
    }
    try {
      await addMut.mutateAsync({
        id: effectiveId,
        data: { productId: addProductId, quantity: qty },
      });
      setAddProductId("");
      setAddQty("");
      invalidateMenu();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to add";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleUpdate(itemId: string, qty: number) {
    try {
      await updateMut.mutateAsync({
        id: effectiveId,
        itemId,
        data: { quantity: qty },
      });
      invalidateMenu();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to update";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function handleRemove(itemId: string) {
    try {
      await removeMut.mutateAsync({ id: effectiveId, itemId });
      invalidateMenu();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to remove";
      toast({ title: msg, variant: "destructive" });
    }
  }

  const selectedSchool = (schools.data ?? []).find(
    (s) => s.id === effectiveId,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          School default menus
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Stamp a template onto a school, or fine-tune their defaults
          individually. Defaults are the starting point for each new weekly
          order.
        </p>
      </header>

      <div className="bg-card border border-card-border rounded-xl shadow-sm p-4 grid sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">School</label>
          <Select
            value={effectiveId}
            onValueChange={setSelectedSchoolId}
          >
            <SelectTrigger data-testid="select-school">
              <SelectValue placeholder="Pick a school…" />
            </SelectTrigger>
            <SelectContent>
              {(schools.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden sm:block self-center text-muted-foreground text-xs px-2">
          and / or
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium">Stamp a template</label>
          <Select
            value={pendingTemplate}
            onValueChange={setPendingTemplate}
            disabled={!effectiveId}
          >
            <SelectTrigger data-testid="select-template">
              <SelectValue placeholder="Pick a template…" />
            </SelectTrigger>
            <SelectContent>
              {(templates.data ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} ({t.items.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={!pendingTemplate || !effectiveId}
          onClick={() => {
            const t = (templates.data ?? []).find(
              (x) => x.id === pendingTemplate,
            );
            if (!t || !selectedSchool) return;
            setConfirmStamp({
              templateId: t.id,
              templateName: t.name,
              schoolName: selectedSchool.name,
            });
          }}
          data-testid="button-stamp"
        >
          <Stamp className="w-4 h-4 mr-1.5" />
          Stamp
        </Button>
      </div>

      {!effectiveId && (
        <div className="text-center text-muted-foreground py-12">
          Add a school first.
        </div>
      )}

      {effectiveId && (
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-medium">{selectedSchool?.name}</div>
            <div className="text-xs text-muted-foreground">
              Default menu — {(menu.data ?? []).length} item
              {(menu.data ?? []).length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="p-4 space-y-3">
            {menu.isLoading && (
              <div className="text-muted-foreground text-sm">Loading…</div>
            )}
            {!menu.isLoading &&
              (menu.data ?? []).length === 0 && (
                <div className="text-muted-foreground text-sm">
                  No default items yet. Stamp a template above or add
                  products one at a time below.
                </div>
              )}
            {(menu.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2"
                data-testid={`row-default-item-${item.id}`}
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
                      handleUpdate(item.id, v);
                    }
                  }}
                  data-testid={`input-default-qty-${item.id}`}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(item.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <Select value={addProductId} onValueChange={setAddProductId}>
                <SelectTrigger
                  className="flex-1"
                  data-testid="select-add-default-product"
                >
                  <SelectValue placeholder="Add a product…" />
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
                value={addQty}
                onChange={(e) => setAddQty(e.target.value)}
                className="w-24"
              />
              <Button
                onClick={handleAdd}
                data-testid="button-add-default-item"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!confirmStamp}
        onOpenChange={(o) => !o && setConfirmStamp(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this school's defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              Stamping "{confirmStamp?.templateName}" onto{" "}
              {confirmStamp?.schoolName} will replace all of their current
              default menu items. Any in-progress weekly order keeps its own
              items — only future weeks start from the new defaults.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStamp}>
              Replace defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
