import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function NoAccessPage() {
  return (
    <div className="max-w-md mx-auto bg-card border border-card-border rounded-xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex w-10 h-10 rounded-lg bg-muted text-muted-foreground items-center justify-center">
          <Lock className="w-5 h-5" />
        </span>
        <h1 className="text-lg font-semibold">Admin access required</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        You don't have access to this page. Ask an administrator to grant you
        the admin role.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
