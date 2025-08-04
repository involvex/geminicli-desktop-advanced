import React from "react";
import { Card } from "../components/ui/card";
import { api } from "../App";
import { ArrowLeft } from "lucide-react";

type Discussion = {
  id: string;
  title: string;
  started_at_iso?: string;
  message_count?: number;
};

function truncateId(id: string): string {
  if (!id) return "";
  return id.length > 20 ? id.slice(0, 20) : id;
}

/**
 * Full-page Project Detail (Step 5).
 * Renders discussions for a given projectId using a temporary stub API.
 */
export default function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [discussions, setDiscussions] = React.useState<Discussion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.invoke<{ id: string; title: string; started_at_iso?: string; message_count?: number }[]>(
          "get_project_discussions",
          { projectId }
        );
        if (!cancelled) setDiscussions(data);
      } catch (e) {
        if (!cancelled) setError("Failed to load discussions.");
        // eslint-disable-next-line no-console
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

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
        <h1 className="text-3xl font-semibold tracking-tight">Project details</h1>
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{projectId}</code>
          <span>({truncateId(projectId)})</span>
        </div>

        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-medium">Previous discussions</h2>

          {error ? (
            <p className="text-sm text-muted-foreground">{error}</p>
          ) : discussions === null ? (
            <p className="text-sm text-muted-foreground">Loading discussions…</p>
          ) : discussions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No discussions found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {discussions.map((d) => (
                <Card key={d.id} className="p-4">
                  <div className="flex flex-col">
                    <div className="font-medium">{d.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {d.started_at_iso ? (
                        <span>Started {new Date(d.started_at_iso).toLocaleString()}</span>
                      ) : (
                        <span className="opacity-70">Start time unavailable</span>
                      )}
                      {typeof d.message_count === "number" ? (
                        <span>{d.message_count} messages</span>
                      ) : (
                        <span className="opacity-70">Messages: —</span>
                      )}
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