import { Package } from "lucide-react";

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track stock levels and manage warehouse items.
        </p>
      </header>
      <div className="bg-card border border-card-border rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-flex w-10 h-10 rounded-lg bg-primary/10 text-primary items-center justify-center">
            <Package className="w-5 h-5" />
          </span>
          <h2 className="text-lg font-semibold">Coming soon</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">
          The Inventory page is on its way. You'll be able to manage products,
          set min/max thresholds, and see what's on hand at a glance.
        </p>
      </div>
    </div>
  );
}
