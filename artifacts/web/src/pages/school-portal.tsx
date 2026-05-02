import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSchoolByToken,
  getGetSchoolByTokenQueryKey,
  useGetSchoolPortalOrder,
  getGetSchoolPortalOrderQueryKey,
  useAddPortalOrderItem,
  useUpdatePortalOrderItem,
  useRemovePortalOrderItem,
  useUpdatePortalOrderNotes,
  useConfirmPortalOrder,
} from "@workspace/api-client-react";
import {
  Sprout,
  Mail,
  MapPin,
  User,
  NotebookText,
  Link as LinkIcon,
  Lock,
  Unlock,
  CheckCircle2,
  Plus,
  Trash2,
  Circle,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString(
    "en-US",
    { ...opts, year: "numeric" },
  )}`;
}

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

export default function SchoolPortalPage({ token }: { token: string }) {
  const profile = useGetSchoolByToken(token, {
    query: {
      enabled: !!token,
      queryKey: getGetSchoolByTokenQueryKey(token),
      retry: false,
    },
  });

  if (profile.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sidebar px-6">
        <div className="max-w-md bg-card border border-card-border rounded-xl p-8 shadow-md text-center">
          <span className="inline-flex w-12 h-12 rounded-lg bg-muted text-muted-foreground items-center justify-center mb-4">
            <LinkIcon className="w-6 h-6" />
          </span>
          <h1 className="text-lg font-semibold mb-1">
            This link is no longer valid
          </h1>
          <p className="text-sm text-muted-foreground">
            The portal link you used has expired or was reset. Please contact
            your Nutrition for Learning representative for an updated link.
          </p>
        </div>
      </div>
    );
  }

  const s = profile.data;

  return (
    <div className="min-h-screen bg-sidebar">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center gap-2">
          <span className="inline-flex w-8 h-8 rounded-md bg-primary text-primary-foreground items-center justify-center">
            <Sprout className="w-4 h-4" />
          </span>
          <span className="font-semibold">Nutrition for Learning</span>
          <span className="text-muted-foreground text-sm ml-auto">
            School portal
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-8 py-7 border-b border-border bg-gradient-to-br from-primary/5 to-accent/10">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Partner school
            </p>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">
              {s.name}
            </h1>
          </div>
          <dl className="divide-y divide-border">
            <Row icon={<User className="w-4 h-4" />} label="Primary contact">
              {s.contactName || <Empty />}
            </Row>
            <Row icon={<Mail className="w-4 h-4" />} label="Contact email">
              {s.contactEmail ? (
                <a
                  className="text-primary underline-offset-2 hover:underline"
                  href={`mailto:${s.contactEmail}`}
                >
                  {s.contactEmail}
                </a>
              ) : (
                <Empty />
              )}
            </Row>
            <Row icon={<MapPin className="w-4 h-4" />} label="Address">
              {s.address || <Empty />}
            </Row>
            <Row icon={<NotebookText className="w-4 h-4" />} label="Notes">
              {s.notes ? (
                <p className="whitespace-pre-wrap leading-relaxed">{s.notes}</p>
              ) : (
                <Empty />
              )}
            </Row>
          </dl>
        </div>

        <OrderSection token={token} />

        <p className="text-xs text-muted-foreground text-center">
          To request changes to your profile, reply to your most recent
          message from our team.
        </p>
      </main>
    </div>
  );
}

function OrderSection({ token }: { token: string }) {
  const qc = useQueryClient();
  const view = useGetSchoolPortalOrder(token, {
    query: {
      enabled: !!token,
      queryKey: getGetSchoolPortalOrderQueryKey(token),
    },
  });
  const addItem = useAddPortalOrderItem();
  const updateItem = useUpdatePortalOrderItem();
  const removeItem = useRemovePortalOrderItem();
  const updateNotes = useUpdatePortalOrderNotes();
  const confirmMut = useConfirmPortalOrder();

  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const data = view.data;
  // Sync notes from data when it loads.
  const liveNotes = data?.order?.notes ?? "";
  if (data && !notesDirty && notes !== liveNotes) {
    setNotes(liveNotes);
  }

  const isOpen = data?.orderWindowOpen ?? false;
  const order = data?.order ?? null;
  const isConfirmed = order?.status === "confirmed";
  const canEditQuantities = isOpen && !isConfirmed;

  const sortedItems = useMemo(
    () =>
      [...(order?.items ?? [])].sort((a, b) =>
        a.product.name.localeCompare(b.product.name),
      ),
    [order?.items],
  );

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getGetSchoolPortalOrderQueryKey(token) });

  async function updateQty(itemId: string, qty: number) {
    try {
      await updateItem.mutateAsync({
        token,
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
    try {
      await removeItem.mutateAsync({ token, itemId });
      invalidate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  async function saveNotes() {
    try {
      await updateNotes.mutateAsync({
        token,
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

  async function handleConfirm() {
    try {
      await confirmMut.mutateAsync({ token });
      setConfirmOpen(false);
      invalidate();
      toast({ title: "Order confirmed. Thank you!" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  if (view.isLoading) {
    return (
      <div className="bg-card border border-card-border rounded-xl shadow-sm p-6 text-muted-foreground text-sm">
        Loading this week's order…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Weekly order
          </div>
          <div className="font-semibold">Week of {fmtWeek(data.weekStart)}</div>
        </div>
        <div className="flex items-center gap-2">
          {order && <StatusBadge status={order.status} />}
          {isOpen ? (
            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200">
              <Unlock className="w-3 h-3 mr-1" />
              Window open
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              <Lock className="w-3 h-3 mr-1" />
              Window closed
            </Badge>
          )}
        </div>
      </div>

      {!order ? (
        <div className="px-6 py-10 text-center text-muted-foreground text-sm">
          The ordering window for this week isn't open yet. Please check back
          when our team announces the next order period.
        </div>
      ) : (
        <div className="p-6 space-y-5">
          {sortedItems.length === 0 && (
            <div className="text-sm text-muted-foreground">
              {canEditQuantities
                ? "Your default menu is empty. Reach out to our team to set defaults."
                : "No items on this week's order."}
            </div>
          )}
          {sortedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3"
              data-testid={`row-portal-item-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.product.name}</div>
                <div className="text-xs text-muted-foreground">
                  {[item.product.category, item.product.unit]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </div>
                {item.product.allergens && (
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    Allergens: {item.product.allergens}
                  </div>
                )}
              </div>
              <Input
                type="number"
                min={0}
                defaultValue={item.quantity}
                disabled={!canEditQuantities}
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
                data-testid={`input-portal-qty-${item.id}`}
              />
              {canEditQuantities && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(item.id)}
                  data-testid={`button-portal-remove-${item.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}

          <div className="grid gap-1.5 pt-3 border-t border-border">
            <label className="text-sm font-medium">Notes for our team</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setNotesDirty(true);
              }}
              placeholder="Anything we should know about this week's delivery"
              data-testid="textarea-portal-notes"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                disabled={!notesDirty}
                onClick={saveNotes}
                data-testid="button-portal-save-notes"
              >
                Save notes
              </Button>
            </div>
          </div>

          {canEditQuantities && (
            <div className="pt-3 border-t border-border flex justify-end">
              <Button
                onClick={() => setConfirmOpen(true)}
                data-testid="button-portal-confirm"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Confirm this week's order
              </Button>
            </div>
          )}
          {isConfirmed && (
            <div className="text-xs text-emerald-700 dark:text-emerald-400 text-center pt-1">
              Confirmed — our team has been notified.
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm this week's order?</AlertDialogTitle>
            <AlertDialogDescription>
              Once confirmed, you won't be able to change quantities. You can
              still add notes if anything changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Yes, confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-8 py-5 grid grid-cols-[160px_1fr] gap-6 items-start">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="text-muted-foreground/70">{icon}</span>
        {label}
      </div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}
