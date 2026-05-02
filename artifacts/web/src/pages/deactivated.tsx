import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-sidebar">
      <div className="w-full max-w-md bg-card border border-card-border rounded-xl p-8 shadow-md">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex w-10 h-10 rounded-lg bg-destructive/10 text-destructive items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </span>
          <h1 className="text-lg font-semibold">Account deactivated</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Your account is no longer active. If you believe this is a mistake,
          contact an administrator on your team.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/api/logout">Sign out</a>
        </Button>
      </div>
    </div>
  );
}
