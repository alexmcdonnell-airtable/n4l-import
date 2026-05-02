import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { defaultPathForRole } from "@/lib/roles";

export default function NoAccessPage() {
  const { data } = useAuth();
  const homePath = defaultPathForRole(data?.role);
  return (
    <div className="max-w-md mx-auto bg-card border border-card-border rounded-xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex w-10 h-10 rounded-lg bg-muted text-muted-foreground items-center justify-center">
          <Lock className="w-5 h-5" />
        </span>
        <h1 className="text-lg font-semibold">You don't have access</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        This page isn't available for your role. If you think you should have
        access, ask an administrator to update your role.
      </p>
      <Button asChild variant="outline">
        <Link href={homePath}>Back to your home page</Link>
      </Button>
    </div>
  );
}
