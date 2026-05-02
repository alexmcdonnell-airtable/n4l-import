import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAppSettings,
  getGetAppSettingsQueryKey,
  useUpdateAppSettings,
} from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const qc = useQueryClient();
  const settings = useGetAppSettings({
    query: { queryKey: getGetAppSettingsQueryKey() },
  });
  const updateMut = useUpdateAppSettings();

  async function toggle(v: boolean) {
    try {
      await updateMut.mutateAsync({ data: { orderWindowOpen: v } });
      qc.invalidateQueries({ queryKey: getGetAppSettingsQueryKey() });
      toast({
        title: v ? "Order window opened" : "Order window closed",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast({ title: msg, variant: "destructive" });
    }
  }

  const open = settings.data?.orderWindowOpen ?? false;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Global controls for the operations portal.
        </p>
      </header>

      <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
        <div className="flex items-start gap-4">
          <span
            className={
              "inline-flex w-10 h-10 rounded-lg items-center justify-center " +
              (open
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-muted text-muted-foreground")
            }
          >
            {open ? (
              <Unlock className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </span>
          <div className="flex-1">
            <Label
              htmlFor="window-toggle"
              className="text-base font-medium cursor-pointer"
            >
              Order window {open ? "open" : "closed"}
            </Label>
            <p className="text-sm text-muted-foreground mt-1 max-w-prose">
              When the window is open, schools can adjust quantities and
              confirm their weekly order via their portal link. When closed,
              the menu is read-only — but coordinators can still leave notes
              on existing orders.
            </p>
          </div>
          <Switch
            id="window-toggle"
            checked={open}
            disabled={settings.isLoading || updateMut.isPending}
            onCheckedChange={toggle}
            data-testid="switch-order-window"
          />
        </div>
      </div>
    </div>
  );
}
