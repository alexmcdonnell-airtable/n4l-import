import {
  useGetSchoolByToken,
  getGetSchoolByTokenQueryKey,
} from "@workspace/api-client-react";
import { Sprout, Mail, MapPin, User, NotebookText, Link as LinkIcon } from "lucide-react";

export default function SchoolPortalPage({ token }: { token: string }) {
  const q = useGetSchoolByToken(token, {
    query: {
      enabled: !!token,
      queryKey: getGetSchoolByTokenQueryKey(token),
      retry: false,
    },
  });

  if (q.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (q.isError || !q.data) {
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

  const s = q.data;

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

      <main className="max-w-3xl mx-auto px-6 py-10">
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
        <p className="text-xs text-muted-foreground text-center mt-6">
          This is a private, read-only view of your school's profile. To
          request changes, reply to your most recent message from our team.
        </p>
      </main>
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
