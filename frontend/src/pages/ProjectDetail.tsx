import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "../components/ui/card";
import { api } from "../App";
import { ArrowLeft } from "lucide-react";
import { EnrichedProject } from "../lib/webApi";

type Discussion = {
  id: string;
  title: string;
  started_at_iso?: string;
  message_count?: number;
};


/**
 * Full-page Project Detail (Step 5).
 * Renders discussions for a given projectId using a temporary stub API.
 */
export default function ProjectDetailPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [discussions, setDiscussions] = React.useState<Discussion[] | null>(null);
  const [projectData, setProjectData] = React.useState<EnrichedProject | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!projectId) {
    return <div>Invalid project ID</div>;
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // First, try to get enriched project data from the list
        const enrichedProjects = await api.invoke<EnrichedProject[]>("list_enriched_projects");
        const project = enrichedProjects.find(p => p.sha256 === projectId);
        if (!cancelled && project) {
          setProjectData(project);
        }
        
        // Then get discussions
        const data = await api.invoke<{ id: string; title: string; started_at_iso?: string; message_count?: number }[]>(
          "get_project_discussions",
          { projectId }
        );
        if (!cancelled) setDiscussions(data);
      } catch (e) {
        if (!cancelled) setError("Failed to load project data.");
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
          onClick={() => navigate("/projects")}
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          aria-label="Back to Projects"
        >
          <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
          <span>Back to Projects</span>
        </button>
        <h1 className="text-3xl font-semibold tracking-tight">Project details</h1>
        <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
          {projectData ? (
            <>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{projectData.metadata.path}</code>
              <span>({projectData.metadata.friendly_name})</span>
            </>
          ) : (
            <>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Loading...</code>
              <span>(Loading...)</span>
            </>
          )}
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