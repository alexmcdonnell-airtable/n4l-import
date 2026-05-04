import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListWeeklyOrders,
  getListWeeklyOrdersQueryKey,
  useGetWeeklyOrder,
  getGetWeeklyOrderQueryKey,
  useOpenOrCreateWeeklyOrder,
  useUpdateWeeklyOrder,
  useAddWeeklyOrderItem,
  useUpdateWeeklyOrderItem,
  useRemoveWeeklyOrderItem,
  useListProducts,
  getListProductsQueryKey,
  useListRouteInstances,
  getListRouteInstancesQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  CircleDot,
  Download,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function getApiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function mondayOf(d: Date): string {
  const u = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = u.getUTCDay();
  const offset = (dow + 6) % 7;
  u.setUTCDate(u.getUTCDate() - offset);
  return u.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + deltaWeeks * 7);
  return u.toISOString().slice(0, 10);
}

function fmtWeek(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  return `Week of ${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    { ...opts, year: "numeric" },
  )}`;
}

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  confirmed: "Confirmed",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmed
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge className="bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-200">
        <CircleDot className="w-3 h-3 mr-1" /> In progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Circle className="w-3 h-3 mr-1" /> Not started
    </Badge>
  );
}

export default function WeeklyOrdersPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "manifests">("orders");
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOf(new Date()),
  );

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Weekly orders
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage orders and download route manifests for warehouse staff.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-medium tabular-nums px-2 min-w-[14rem] text-center">
            {fmtWeek(weekStart)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(shiftWeek(weekStart, +1))}
            data-testid="button-next-week"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(mondayOf(new Date()))}
            data-testid="button-this-week"
          >
            This week
          </Button>
        </div>
      </header>

      <div className="flex gap-1 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("orders")}
        >
          Orders
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "manifests"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveTab("manifests")}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Manifests
        </button>
      </div>

      {activeTab === "orders" && <OrdersTab weekStart={weekStart} />}
      {activeTab === "manifests" && <ManifestsTab weekStart={weekStart} />}
    </div>
  );
}

function OrdersTab({ weekStart }: { weekStart: string }) {
  const qc = useQueryClient();
  const { data: auth } = useAuth();
  const isAdmin = auth?.role === "admin";

  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const [openSchool, setOpenSchool] = useState<{
    schoolId: string;
    schoolName: string;
  } | null>(null);

  const list = useListWeeklyOrders(
    { weekStart },
    {
      query: {
        queryKey: getListWeeklyOrdersQueryKey({ weekStart }),
      },
    },
  );

  const openMut = useOpenOrCreateWeeklyOrder();

  async function handleOpen(row: {
    schoolId: string;
    schoolName: string;
    orderId?: string | null;
  }) {
    setOpenSchool({ schoolId: row.schoolId, schoolName: row.schoolName });
    if (row.orderId) {
      setOpenOrderId(row.orderId);
      return;
    }
    try {
      const created = await openMut.mutateAsync({
        data: { schoolId: row.schoolId, weekStart },
      });
      setOpenOrderId(created.id);
      qc.invalidateQueries({
        queryKey: getListWeeklyOrdersQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to open order";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <>
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">School</th>
              <th className="text-left font-medium px-4 py-2.5">Route</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-4 py-2.5">Items</th>
              <th className="text-left font-medium px-4 py-2.5">Notes</th>
              <th className="text-right font-medium px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Loading orders…
                </td>
              </tr>
            )}
            {!list.isLoading && (list.data?.length ?? 0) === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No schools yet.
                </td>
              </tr>
            )}
            {(list.data ?? []).map((row) => (
              <tr
                key={row.schoolId}
                className="border-t border-border align-top"
                data-testid={`row-week-order-${row.schoolId}`}
              >
                <td className="px-4 py-3 font-medium">{row.schoolName}</td>
                <td className="px-4 py-3">
                  {row.routeName ? (
                    <div>
                      <span className="text-xs font-medium">{row.routeName}</span>
                      {row.truckName && (
                        <div className="text-xs text-muted-foreground">{row.truckName}</div>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground/70">
                      Unrouted
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 tabular-nums">{row.itemCount}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-sm">
                  {row.notesPreview || (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpen(row)}
                    data-testid={`button-open-order-${row.schoolId}`}
                  >
                    {row.orderId ? "Open" : "Create"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OrderEditor
        orderId={openOrderId}
        weekStart={weekStart}
        schoolName={openSchool?.schoolName ?? ""}
        isAdmin={isAdmin}
        onClose={() => {
          setOpenOrderId(null);
          setOpenSchool(null);
        }}
      />
    </>
  );
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function ManifestsTab({ weekStart }: { weekStart: string }) {
  const instances = useListRouteInstances(
    { weekStart },
    { query: { queryKey: getListRouteInstancesQueryKey({ weekStart }) } },
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function downloadPdf(instanceId: string, routeName: string) {
    setDownloadingId(instanceId);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/api/route-instances/${instanceId}/manifest.pdf`,
        { credentials: "include" },
      );
      if (!resp.ok) throw new Error("Failed to download PDF");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `manifest-${routeName.replace(/\s+/g, "-")}-${weekStart}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Download failed",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  }

  const instanceList = instances.data ?? [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Download a packing manifest PDF for each route. Generate instances on
        the Routes &amp; Trucks page if none appear below.
      </p>
      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Route</th>
              <th className="text-left font-medium px-4 py-2.5">Day</th>
              <th className="text-left font-medium px-4 py-2.5">Truck</th>
              <th className="text-left font-medium px-4 py-2.5">Driver</th>
              <th className="text-left font-medium px-4 py-2.5">Stops</th>
              <th className="text-right font-medium px-4 py-2.5">Manifest</th>
            </tr>
          </thead>
          <tbody>
            {instances.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!instances.isLoading && instanceList.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No route instances for this week. Go to Routes &amp; Trucks
                  and click "Generate instances" first.
                </td>
              </tr>
            )}
            {instanceList.map((inst) => (
              <tr key={inst.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-medium">{inst.routeName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {DAY_NAMES[inst.dayOfWeek] ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inst.truckName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {inst.driverName ?? (
                    <span className="text-muted-foreground/50">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-0.5">
                    {inst.stops.length === 0 && (
                      <span className="text-muted-foreground/50 text-xs">
                        No stops
                      </span>
                    )}
                    {inst.stops
                      .slice()
                      .sort((a, b) => a.stopOrder - b.stopOrder)
                      .map((s) => (
                        <div
                          key={s.id}
                          className={`text-xs ${s.skipped ? "line-through text-muted-foreground/50" : ""}`}
                        >
                          {s.stopOrder + 1}. {s.schoolName}
                          {s.skipped && (
                            <Badge
                              variant="outline"
                              className="ml-1 text-xs py-0"
                            >
                              skipped
                            </Badge>
                          )}
                        </div>
                      ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadPdf(inst.id, inst.routeName)}
                    disabled={downloadingId === inst.id}
                    title="Download manifest PDF"
                  >
                    <Download
                      className={`w-4 h-4 mr-1.5 ${downloadingId === inst.id ? "animate-pulse" : ""}`}
                    />
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderEditor({
  orderId,
  weekStart,
  schoolName,
  isAdmin,
  onClose,
}: {
  orderId: string | null;
  weekStart: string;
  schoolName: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const products = useListProducts({
    query: { queryKey: getListProductsQueryKey() },
  });
  const order = useGetWeeklyOrder(orderId ?? "", {
    query: {
      enabled: !!orderId,
      queryKey: getGetWeeklyOrderQueryKey(orderId ?? ""),
    },
  });
  const updateMut = useUpdateWeeklyOrder();
  const addItemMut = useAddWeeklyOrderItem();
  const updateItemMut = useUpdateWeeklyOrderItem();
  const removeItemMut = useRemoveWeeklyOrderItem();

  const [addProductId, setAddProductId] = useState("");
  const [addQty, setAddQty] = useState("");
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  const activeProducts = useMemo(
    () => (products.data ?? []).filter((p) => p.active),
    [products.data],
  );

  const isOpen = !!orderId;
  const data = order.data;
  // Sync notes when the underlying order changes.
  if (data && !notesDirty && (data.notes ?? "") !== notes) {
    setNotes(data.notes ?? "");
  }

  const invalidate = () => {
    if (orderId) {
      qc.invalidateQueries({ queryKey: getGetWeeklyOrderQueryKey(orderId) });
    }
    qc.invalidateQueries({
      queryKey: getListWeeklyOrdersQueryKey({ weekStart }),
    });
  };

  async function handleAdd() {
    if (!orderId || !addProductId) return;
    const qty = Math.max(0, Number.parseInt(addQty || "0", 10));
    if (Number.isNaN(qty)) {
      toast({ title: "Quantity must be a number", variant: "destructive" });
      return;
    }
    try {
      await addItemMut.mutateAsync({
        id: orderId,
        data: { productId: addProductId, quantity: qty },
      });
      setAddProductId("");
      setAddQty("");
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function updateQty(itemId: string, qty: number) {
    if (!orderId) return;
    try {
      await updateItemMut.mutateAsync({
        id: orderId,
        itemId,
        data: { quantity: qty },
      });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function removeRow(itemId: string) {
    if (!orderId) return;
    try {
      await removeItemMut.mutateAsync({ id: orderId, itemId });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function saveNotes() {
    if (!orderId) return;
    try {
      await updateMut.mutateAsync({
        id: orderId,
        data: { notes: notes.trim() === "" ? null : notes },
      });
      setNotesDirty(false);
      invalidate();
      toast({ title: "Notes saved" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function setStatus(status: "in_progress" | "confirmed") {
    if (!orderId) return;
    try {
      await updateMut.mutateAsync({ id: orderId, data: { status } });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{schoolName}</DialogTitle>
          <DialogDescription>
            {fmtWeek(weekStart)}
            {data ? (
              <span className="ml-2">
                <StatusBadge status={data.status} />
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {order.isLoading && (
          <div className="text-muted-foreground text-sm py-6">Loading…</div>
        )}

        {data && (
          <div className="space-y-4">
            <div className="space-y-2">
              {data.items.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No items yet.
                </div>
              )}
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2"
                  data-testid={`row-order-item-${item.id}`}
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
                        updateQty(item.id, v);
                      }
                    }}
                    data-testid={`input-order-qty-${item.id}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(item.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <Select value={addProductId} onValueChange={setAddProductId}>
                  <SelectTrigger
                    className="flex-1"
                    data-testid="select-add-order-product"
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
                  data-testid="button-add-order-item"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Add
                </Button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <label className="text-sm font-medium">Order notes</label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setNotesDirty(true);
                }}
                placeholder="Anything the kitchen or driver should know"
                data-testid="textarea-order-notes"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!notesDirty}
                  onClick={saveNotes}
                  data-testid="button-save-notes"
                >
                  Save notes
                </Button>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {data.status !== "confirmed" ? (
                  <Button
                    size="sm"
                    onClick={() => setStatus("confirmed")}
                    data-testid="button-confirm-order"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Mark confirmed
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("in_progress")}
                    data-testid="button-unconfirm-order"
                  >
                    Reopen for edits
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
