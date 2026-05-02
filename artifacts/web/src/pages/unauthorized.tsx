import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-6">
      <div className="w-full max-w-md bg-card border border-card-border rounded-xl shadow-md p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex w-10 h-10 rounded-lg bg-destructive/10 text-destructive items-center justify-center">
            <ShieldX className="w-5 h-5" />
          </span>
          <h1 className="text-lg font-semibold">You are not authorized to access this portal</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Your account is not on the access list. If you believe this is a
          mistake, please contact an administrator to have your email added.
        </p>
        <Button asChild variant="outline" className="w-full">
          <a href="/api/logout">Back to sign-in</a>
        </Button>
      </div>
    </div>
  );
}
