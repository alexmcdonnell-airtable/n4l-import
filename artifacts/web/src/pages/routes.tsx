import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTrucks,
  getListTrucksQueryKey,
  useCreateTruck,
  useUpdateTruck,
  useListRoutes,
  getListRoutesQueryKey,
  useCreateRoute,
  useUpdateRoute,
  useDeleteRoute,
  useSetRouteStops,
  useListRouteInstances,
  getListRouteInstancesQueryKey,
  useMaterializeRouteInstances,
  useUpdateRouteInstance,
  useUpdateRouteInstanceStop,
  useSetRouteInstanceStops,
  useMoveSchoolToInstance,
  useListStaff,
  getListStaffQueryKey,
  useListSchools,
  getListSchoolsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
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
  Truck,
  Navigation,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  GripVertical,
  X,
} from "lucide-react";
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function mondayOf(d: Date): string {
  const u = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dow = u.getUTCDay();
  const offset = (dow + 6) % 7;
  u.setUTCDate(u.getUTCDate() - offset);
  return u.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, delta: number): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const u = new Date(Date.UTC(y, m - 1, d));
  u.setUTCDate(u.getUTCDate() + delta * 7);
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
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function getApiBase(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.replace(/\/$/, "")}/api`;
}

export default function RoutesPage() {
  const [tab, setTab] = useState<"schedule" | "week">("schedule");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Routes & Trucks
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage delivery trucks, default route schedules, and per-week
            manifests.
          </p>
        </div>
        <div className="flex gap-1 border rounded-lg p-1 bg-secondary/40">
          <button
            onClick={() => setTab("schedule")}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "schedule" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Navigation className="w-4 h-4 inline mr-1.5" />
            Default schedule
          </button>
          <button
            onClick={() => setTab("week")}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === "week" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Truck className="w-4 h-4 inline mr-1.5" />
            This week
          </button>
        </div>
      </div>

      {tab === "schedule" && <ScheduleTab />}
      {tab === "week" && <WeekTab />}
    </div>
  );
}

function ScheduleTab() {
  const qc = useQueryClient();
  const [truckDialogOpen, setTruckDialogOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<{
    id: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [truckName, setTruckName] = useState("");

  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<null | {
    id: string;
    name: string;
    truckId: string;
    dayOfWeek: number;
    defaultDriverId: string | null;
    active: boolean;
  }>(null);
  const [routeForm, setRouteForm] = useState({
    name: "",
    truckId: "",
    dayOfWeek: 1,
    defaultDriverId: "",
  });

  const [stopsDialogRoute, setStopsDialogRoute] = useState<null | {
    id: string;
    name: string;
    stops: { schoolId: string; schoolName: string; stopOrder: number }[];
  }>(null);
  const [stopsSchoolIds, setStopsSchoolIds] = useState<string[]>([]);

  const [confirmDeleteRoute, setConfirmDeleteRoute] = useState<null | {
    id: string;
    name: string;
  }>(null);

  const trucks = useListTrucks({
    query: { queryKey: getListTrucksQueryKey() },
  });
  const routes = useListRoutes({
    query: { queryKey: getListRoutesQueryKey() },
  });
  const staff = useListStaff({
    query: { queryKey: getListStaffQueryKey() },
  });
  const schools = useListSchools({
    query: { queryKey: getListSchoolsQueryKey() },
  });

  const createTruckMut = useCreateTruck();
  const updateTruckMut = useUpdateTruck();
  const createRouteMut = useCreateRoute();
  const updateRouteMut = useUpdateRoute();
  const deleteRouteMut = useDeleteRoute();
  const setStopsMut = useSetRouteStops();

  const drivers = useMemo(
    () => (staff.data ?? []).filter((s) => s.active),
    [staff.data],
  );

  function openCreateTruck() {
    setEditingTruck(null);
    setTruckName("");
    setTruckDialogOpen(true);
  }

  function openEditTruck(t: { id: string; name: string; active: boolean }) {
    setEditingTruck(t);
    setTruckName(t.name);
    setTruckDialogOpen(true);
  }

  async function handleSaveTruck() {
    if (!truckName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    try {
      if (editingTruck) {
        await updateTruckMut.mutateAsync({
          id: editingTruck.id,
          data: { name: truckName.trim() },
        });
        toast({ title: "Truck updated" });
      } else {
        await createTruckMut.mutateAsync({ data: { name: truckName.trim() } });
        toast({ title: "Truck created" });
      }
      setTruckDialogOpen(false);
      qc.invalidateQueries({ queryKey: getListTrucksQueryKey() });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    }
  }

  async function handleToggleTruck(t: {
    id: string;
    name: string;
    active: boolean;
  }) {
    try {
      await updateTruckMut.mutateAsync({
        id: t.id,
        data: { active: !t.active },
      });
      qc.invalidateQueries({ queryKey: getListTrucksQueryKey() });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Update failed",
        variant: "destructive",
      });
    }
  }

  function openCreateRoute() {
    setEditingRoute(null);
    setRouteForm({ name: "", truckId: "", dayOfWeek: 1, defaultDriverId: "" });
    setRouteDialogOpen(true);
  }

  function openEditRoute(r: {
    id: string;
    name: string;
    truckId: string;
    dayOfWeek: number;
    defaultDriverId: string | null;
    active: boolean;
  }) {
    setEditingRoute(r);
    setRouteForm({
      name: r.name,
      truckId: r.truckId,
      dayOfWeek: r.dayOfWeek,
      defaultDriverId: r.defaultDriverId ?? "",
    });
    setRouteDialogOpen(true);
  }

  async function handleSaveRoute() {
    if (!routeForm.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!routeForm.truckId) {
      toast({ title: "Truck is required", variant: "destructive" });
      return;
    }
    const body = {
      name: routeForm.name.trim(),
      truckId: routeForm.truckId,
      dayOfWeek: routeForm.dayOfWeek,
      defaultDriverId: routeForm.defaultDriverId || null,
    };
    try {
      if (editingRoute) {
        await updateRouteMut.mutateAsync({ id: editingRoute.id, data: body });
        toast({ title: "Route updated" });
      } else {
        await createRouteMut.mutateAsync({ data: body });
        toast({ title: "Route created" });
      }
      setRouteDialogOpen(false);
      qc.invalidateQueries({ queryKey: getListRoutesQueryKey() });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteRoute() {
    if (!confirmDeleteRoute) return;
    try {
      await deleteRouteMut.mutateAsync({ id: confirmDeleteRoute.id });
      toast({ title: `Route "${confirmDeleteRoute.name}" deleted` });
      setConfirmDeleteRoute(null);
      qc.invalidateQueries({ queryKey: getListRoutesQueryKey() });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Delete failed",
        variant: "destructive",
      });
    }
  }

  function openStopsDialog(r: {
    id: string;
    name: string;
    stops: { schoolId: string; schoolName: string; stopOrder: number }[];
  }) {
    setStopsDialogRoute(r);
    setStopsSchoolIds(
      r.stops
        .slice()
        .sort((a, b) => a.stopOrder - b.stopOrder)
        .map((s) => s.schoolId),
    );
  }

  function moveStop(idx: number, dir: -1 | 1) {
    const next = [...stopsSchoolIds];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setStopsSchoolIds(next);
  }

  function removeStop(schoolId: string) {
    setStopsSchoolIds((prev) => prev.filter((id) => id !== schoolId));
  }

  function addStop(schoolId: string) {
    if (!stopsSchoolIds.includes(schoolId)) {
      setStopsSchoolIds((prev) => [...prev, schoolId]);
    }
  }

  async function handleSaveStops() {
    if (!stopsDialogRoute) return;
    try {
      await setStopsMut.mutateAsync({
        id: stopsDialogRoute.id,
        data: { schoolIds: stopsSchoolIds },
      });
      toast({ title: "Stops saved" });
      setStopsDialogRoute(null);
      qc.invalidateQueries({ queryKey: getListRoutesQueryKey() });
      qc.invalidateQueries({ queryKey: getListSchoolsQueryKey() });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    }
  }

  const schoolsOnRoute = useMemo(() => {
    if (!stopsDialogRoute) return [];
    const ids = new Set(stopsSchoolIds);
    const schoolMap = new Map(
      (schools.data ?? []).map((s) => [s.id, s.name]),
    );
    return stopsSchoolIds.map((id) => ({ id, name: schoolMap.get(id) ?? id }));
  }, [stopsSchoolIds, stopsDialogRoute, schools.data]);

  const availableSchools = useMemo(() => {
    const ids = new Set(stopsSchoolIds);
    return (schools.data ?? []).filter((s) => !ids.has(s.id));
  }, [schools.data, stopsSchoolIds]);

  const truckList = trucks.data ?? [];
  const routeList = routes.data ?? [];

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Truck className="w-5 h-5" /> Trucks
          </h2>
          <Button size="sm" onClick={openCreateTruck}>
            <Plus className="w-4 h-4 mr-1" /> Add truck
          </Button>
        </div>
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Name</th>
                <th className="text-left font-medium px-4 py-2.5">Status</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {trucks.isLoading && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!trucks.isLoading && truckList.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No trucks yet.
                  </td>
                </tr>
              )}
              {truckList.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3">
                    {t.active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-muted-foreground text-xs"
                      >
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditTruck(t)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleTruck(t)}
                        title={t.active ? "Deactivate" : "Activate"}
                      >
                        {t.active ? (
                          <X className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <RefreshCw className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <Navigation className="w-5 h-5" /> Default routes
          </h2>
          <Button size="sm" onClick={openCreateRoute}>
            <Plus className="w-4 h-4 mr-1" /> Add route
          </Button>
        </div>
        <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Route</th>
                <th className="text-left font-medium px-4 py-2.5">Day</th>
                <th className="text-left font-medium px-4 py-2.5">Truck</th>
                <th className="text-left font-medium px-4 py-2.5">Driver</th>
                <th className="text-left font-medium px-4 py-2.5">Stops</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.isLoading && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {!routes.isLoading && routeList.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No routes yet. Create one to get started.
                  </td>
                </tr>
              )}
              {routeList.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    {!r.active && (
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground mt-0.5"
                      >
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {DAY_NAMES[r.dayOfWeek]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.truckName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.defaultDriverName ?? (
                      <span className="text-muted-foreground/50">
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="text-primary text-xs hover:underline"
                      onClick={() => openStopsDialog(r)}
                    >
                      {r.stops.length} stop
                      {r.stops.length !== 1 ? "s" : ""}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRoute(r)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfirmDeleteRoute({ id: r.id, name: r.name })
                        }
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
      </section>

      <Dialog open={truckDialogOpen} onOpenChange={setTruckDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTruck ? "Edit truck" : "Add truck"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={truckName}
                onChange={(e) => setTruckName(e.target.value)}
                placeholder="e.g. Truck 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTruckDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTruck}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? "Edit route" : "Create route"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={routeForm.name}
                onChange={(e) =>
                  setRouteForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. North Route"
              />
            </div>
            <div className="space-y-1">
              <Label>Truck</Label>
              <Select
                value={routeForm.truckId}
                onValueChange={(v) =>
                  setRouteForm((f) => ({ ...f, truckId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {truckList
                    .filter((t) => t.active)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Day of week</Label>
              <Select
                value={String(routeForm.dayOfWeek)}
                onValueChange={(v) =>
                  setRouteForm((f) => ({ ...f, dayOfWeek: Number(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default driver</Label>
              <Select
                value={routeForm.defaultDriverId ?? ""}
                onValueChange={(v) =>
                  setRouteForm((f) => ({
                    ...f,
                    defaultDriverId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {[d.firstName, d.lastName].filter(Boolean).join(" ") ||
                        d.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRouteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveRoute}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!stopsDialogRoute}
        onOpenChange={(o) => !o && setStopsDialogRoute(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit stops — {stopsDialogRoute?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Current stop order</Label>
              {schoolsOnRoute.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No stops yet. Add schools below.
                </p>
              )}
              <div className="space-y-1">
                {schoolsOnRoute.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border bg-secondary/30 text-sm"
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 font-medium">{s.name}</span>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => moveStop(idx, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => moveStop(idx, 1)}
                      disabled={idx === schoolsOnRoute.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="text-destructive hover:text-destructive/80"
                      onClick={() => removeStop(s.id)}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {availableSchools.length > 0 && (
              <div>
                <Label className="mb-2 block">Add school</Label>
                <Select onValueChange={addStop}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select school to add…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSchools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStopsDialogRoute(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveStops}>Save stops</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmDeleteRoute}
        onOpenChange={(o) => !o && setConfirmDeleteRoute(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the route "
              {confirmDeleteRoute?.name}" and all its default stops. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={handleDeleteRoute}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WeekTab() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOf(new Date()),
  );

  const instances = useListRouteInstances(
    { weekStart },
    { query: { queryKey: getListRouteInstancesQueryKey({ weekStart }) } },
  );
  const materializeMut = useMaterializeRouteInstances();
  const updateInstanceMut = useUpdateRouteInstance();
  const updateStopMut = useUpdateRouteInstanceStop();
  const setStopsMut = useSetRouteInstanceStops();
  const moveSchoolMut = useMoveSchoolToInstance();

  const trucks = useListTrucks({
    query: { queryKey: getListTrucksQueryKey() },
  });
  const staff = useListStaff({
    query: { queryKey: getListStaffQueryKey() },
  });

  const [editInstanceId, setEditInstanceId] = useState<string | null>(null);
  const [instanceForm, setInstanceForm] = useState<{
    truckId: string;
    dayOfWeek: number;
    driverId: string;
  }>({ truckId: "", dayOfWeek: 1, driverId: "" });

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Move-school state: { fromInstanceId, stopId, schoolId, schoolName }
  const [moveSchool, setMoveSchool] = useState<{
    fromInstanceId: string;
    stopId: string;
    schoolId: string;
    schoolName: string;
  } | null>(null);

  async function toggleSkipStop(
    instanceId: string,
    stopId: string,
    currentSkipped: boolean,
  ) {
    try {
      await updateStopMut.mutateAsync({
        id: instanceId,
        stopId,
        data: { skipped: !currentSkipped },
      });
      qc.invalidateQueries({
        queryKey: getListRouteInstancesQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Failed to update stop",
        variant: "destructive",
      });
    }
  }

  async function handleMoveSchool(targetInstanceId: string) {
    if (!moveSchool) return;
    try {
      await moveSchoolMut.mutateAsync({
        id: moveSchool.fromInstanceId,
        data: { schoolId: moveSchool.schoolId, targetInstanceId },
      });
      toast({ title: `Moved ${moveSchool.schoolName} to new route` });
      setMoveSchool(null);
      qc.invalidateQueries({
        queryKey: getListRouteInstancesQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Move failed",
        variant: "destructive",
      });
    }
  }

  async function moveStop(
    instanceId: string,
    stops: { id: string; schoolId: string; stopOrder: number; skipped: boolean }[],
    idx: number,
    direction: -1 | 1,
  ) {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= stops.length) return;
    const reordered = stops.slice();
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const payload = reordered.map((s, i) => ({
      schoolId: s.schoolId,
      stopOrder: i,
      skipped: s.skipped,
    }));
    try {
      await setStopsMut.mutateAsync({ id: instanceId, data: { stops: payload } });
      qc.invalidateQueries({
        queryKey: getListRouteInstancesQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Failed to reorder stops",
        variant: "destructive",
      });
    }
  }

  async function handleMaterialize() {
    try {
      await materializeMut.mutateAsync({ data: { weekStart } });
      toast({ title: "Route instances created for this week" });
      qc.invalidateQueries({
        queryKey: getListRouteInstancesQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      });
    }
  }

  function openEditInstance(inst: {
    id: string;
    truckId: string;
    dayOfWeek: number;
    driverId: string | null;
  }) {
    setEditInstanceId(inst.id);
    setInstanceForm({
      truckId: inst.truckId,
      dayOfWeek: inst.dayOfWeek,
      driverId: inst.driverId ?? "",
    });
  }

  async function handleSaveInstance() {
    if (!editInstanceId) return;
    try {
      await updateInstanceMut.mutateAsync({
        id: editInstanceId,
        data: {
          truckId: instanceForm.truckId || null,
          dayOfWeek: instanceForm.dayOfWeek,
          driverId: instanceForm.driverId || null,
        },
      });
      toast({ title: "Instance updated" });
      setEditInstanceId(null);
      qc.invalidateQueries({
        queryKey: getListRouteInstancesQueryKey({ weekStart }),
      });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
    }
  }

  async function downloadPdf(instanceId: string, routeName: string) {
    setDownloadingId(instanceId);
    try {
      const apiBase = getApiBase();
      const resp = await fetch(
        `${apiBase}/route-instances/${instanceId}/manifest.pdf`,
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
  const truckList = trucks.data ?? [];
  const driverList = (staff.data ?? []).filter((s) => s.active);
  const editInst = instanceList.find((i) => i.id === editInstanceId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(shiftWeek(weekStart, -1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium px-1 min-w-[14rem] text-center">
          Week of {fmtWeek(weekStart)}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setWeekStart(shiftWeek(weekStart, +1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWeekStart(mondayOf(new Date()))}
        >
          This week
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleMaterialize}
            disabled={materializeMut.isPending}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${materializeMut.isPending ? "animate-spin" : ""}`}
            />
            Generate instances
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Route</th>
              <th className="text-left font-medium px-4 py-2.5">Day</th>
              <th className="text-left font-medium px-4 py-2.5">Truck</th>
              <th className="text-left font-medium px-4 py-2.5">Driver</th>
              <th className="text-left font-medium px-4 py-2.5">Schools</th>
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
                  No route instances for this week. Click "Generate instances"
                  to create them from the default schedule.
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
                  <div className="space-y-1">
                    {inst.stops.length === 0 && (
                      <span className="text-muted-foreground/50 text-xs">
                        No stops
                      </span>
                    )}
                    {inst.stops
                      .slice()
                      .sort((a, b) => a.stopOrder - b.stopOrder)
                      .map((s, idx, arr) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-1 group"
                        >
                          <div className="flex flex-col gap-0">
                            <button
                              className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 leading-none"
                              disabled={idx === 0}
                              onClick={() => moveStop(inst.id, arr, idx, -1)}
                              title="Move up"
                            >
                              ▴
                            </button>
                            <button
                              className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 leading-none"
                              disabled={idx === arr.length - 1}
                              onClick={() => moveStop(inst.id, arr, idx, 1)}
                              title="Move down"
                            >
                              ▾
                            </button>
                          </div>
                          <span
                            className={`text-xs flex-1 ${s.skipped ? "line-through text-muted-foreground/50" : ""}`}
                          >
                            {s.stopOrder + 1}. {s.schoolName}
                          </span>
                          <button
                            className={`text-xs px-1 rounded border ${
                              s.skipped
                                ? "border-amber-300 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                                : "border-transparent text-muted-foreground/40 hover:border-border hover:text-muted-foreground"
                            }`}
                            onClick={() =>
                              toggleSkipStop(inst.id, s.id, s.skipped)
                            }
                            title={s.skipped ? "Unskip" : "Skip"}
                          >
                            {s.skipped ? "unskip" : "skip"}
                          </button>
                          {instanceList.length > 1 && (
                            <button
                              className="text-xs px-1 rounded border border-transparent text-muted-foreground/40 hover:border-border hover:text-muted-foreground"
                              onClick={() =>
                                setMoveSchool({
                                  fromInstanceId: inst.id,
                                  stopId: s.id,
                                  schoolId: s.schoolId,
                                  schoolName: s.schoolName,
                                })
                              }
                              title="Move to another route"
                            >
                              move
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditInstance(inst)}
                      title="Override truck/day/driver"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadPdf(inst.id, inst.routeName)}
                      disabled={downloadingId === inst.id}
                      title="Download manifest PDF"
                    >
                      <Download
                        className={`w-4 h-4 ${downloadingId === inst.id ? "animate-pulse" : ""}`}
                      />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!editInstanceId}
        onOpenChange={(o) => !o && setEditInstanceId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override week settings — {editInst?.routeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Truck</Label>
              <Select
                value={instanceForm.truckId}
                onValueChange={(v) =>
                  setInstanceForm((f) => ({ ...f, truckId: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select truck" />
                </SelectTrigger>
                <SelectContent>
                  {truckList
                    .filter((t) => t.active)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Day of week</Label>
              <Select
                value={String(instanceForm.dayOfWeek)}
                onValueChange={(v) =>
                  setInstanceForm((f) => ({ ...f, dayOfWeek: Number(v) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((d, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Driver</Label>
              <Select
                value={instanceForm.driverId}
                onValueChange={(v) =>
                  setInstanceForm((f) => ({
                    ...f,
                    driverId: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {driverList.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {[d.firstName, d.lastName].filter(Boolean).join(" ") ||
                        d.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInstanceId(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveInstance}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move-school dialog */}
      <Dialog
        open={!!moveSchool}
        onOpenChange={(o) => !o && setMoveSchool(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Move {moveSchool?.schoolName} to another route
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              Select which route instance should serve this school for the week
              of {weekStart}.
            </p>
            {instanceList
              .filter((i) => i.id !== moveSchool?.fromInstanceId)
              .map((i) => (
                <button
                  key={i.id}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:bg-secondary transition-colors text-sm"
                  onClick={() => handleMoveSchool(i.id)}
                  disabled={moveSchoolMut.isPending}
                >
                  <div className="font-medium">{i.routeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {DAY_NAMES[i.dayOfWeek] ?? "Unknown"} · {i.truckName} ·{" "}
                    {i.driverName ?? "No driver"}
                  </div>
                </button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveSchool(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
