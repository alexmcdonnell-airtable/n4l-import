import { Link } from "wouter";
import {
  useListSchools,
  getListSchoolsQueryKey,
  useListStaff,
  getListStaffQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { School, Users, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { data } = useAuth();
  const isAdmin = data?.role === "admin";
  const schools = useListSchools({
    query: { queryKey: getListSchoolsQueryKey(), enabled: isAdmin },
  });
  const staff = useListStaff({
    query: { queryKey: getListStaffQueryKey(), enabled: isAdmin },
  });
  const firstName = data?.user?.firstName || "there";

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">
          Hello, {firstName}.
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          The Nutrition for Learning operations portal. Keep school records
          accurate, share private portal links, and manage your team.
        </p>
      </header>

      {isAdmin ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/schools"
            className="group block bg-card border border-card-border rounded-xl p-6 shadow-sm hover-elevate"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex w-10 h-10 rounded-lg bg-primary/10 text-primary items-center justify-center">
                <School className="w-5 h-5" />
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {schools.isLoading ? "—" : schools.data?.length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Partner schools
            </div>
          </Link>
          <Link
            href="/staff"
            className="group block bg-card border border-card-border rounded-xl p-6 shadow-sm hover-elevate"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="inline-flex w-10 h-10 rounded-lg bg-accent/15 text-accent-foreground items-center justify-center">
                <Users className="w-5 h-5" />
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="text-3xl font-semibold tabular-nums">
              {staff.isLoading ? "—" : staff.data?.length ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Team members
            </div>
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold mb-1">You're signed in as staff</h2>
          <p className="text-sm text-muted-foreground">
            Admin features (Schools and Staff management) are not available on
            your account. Reach out to an administrator if you need elevated
            access.
          </p>
        </div>
      )}

      {isAdmin && (
        <div className="bg-sidebar border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-2">Quick start</h2>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>Add a new partner school and copy its private portal link.</li>
            <li>Reset a school's link if it has been shared by mistake.</li>
            <li>Promote a teammate to admin or deactivate a former member.</li>
          </ul>
          <div className="flex gap-2 mt-4">
            <Button asChild size="sm">
              <Link href="/schools">Manage schools</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/staff">Manage staff</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
