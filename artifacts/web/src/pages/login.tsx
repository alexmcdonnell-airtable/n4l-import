import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const returnTo =
    typeof window !== "undefined" ? window.location.pathname : "/";
  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-6">
      <div className="w-full max-w-md bg-card border border-card-border rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-flex w-10 h-10 rounded-lg bg-primary text-primary-foreground items-center justify-center">
            <Sprout className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Nutrition for Learning
            </h1>
            <p className="text-sm text-muted-foreground">Operations portal</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Sign in with your Replit account to manage partner schools and staff.
          Access is limited to internal team members.
        </p>
        <Button asChild className="w-full">
          <a href={`/api/login?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in with Replit
          </a>
        </Button>
      </div>
    </div>
  );
}
