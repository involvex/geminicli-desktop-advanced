import React from "react";
import { Card } from "../components/ui/card";
import { list_projects, ProjectListItem } from "../lib/webApi";
import { ArrowLeft } from "lucide-react";

type Project = ProjectListItem;

function truncateId(id: string): string {
  if (!id) return "";
  return id.length > 20 ? id.slice(0, 20) : id;
}

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  const [limit] = React.useState<number>(25);
  const [offset] = React.useState<number>(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await list_projects({ limit, offset });
        if (!cancelled) setProjects(resp.items);
      } catch (e) {
        if (!cancelled) setError("Failed to load projects.");
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          aria-label="Back to Home"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-2 text-muted-foreground">
          All of your previous discussions with Gemini Desktop, right here.
        </p>

        {/* Content area */}
        <div className="mt-6">
          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : projects === null ? (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer transition hover:shadow"
                  onClick={() => window.location.assign(`/projects/${p.id}`)}
                >
                  <div className="p-4">
                    <div className="font-medium">{truncateId(p.id)}</div>
                    <div className="mt-1 text-sm text-muted-foreground flex flex-col gap-0.5">
                      {p.title && <span>"{p.title}"</span>}
                      {p.lastActivityAt ? (
                        <span>Last activity: {new Date(p.lastActivityAt).toLocaleString()}</span>
                      ) : null}
                      {typeof p.logCount === "number" ? <span>Logs: {p.logCount}</span> : null}
                      {p.status ? <span>Status: {p.status}</span> : null}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}