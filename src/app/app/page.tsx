import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { requireWorkspace } from "@/lib/workspace";
import { listProjectsForWorkspace } from "@/lib/tickets";

export default async function AppHomePage() {
  const { workspace } = await requireWorkspace();
  const projects = await listProjectsForWorkspace(workspace.id);

  return (
    <AppShell title="Projects" actions={<CreateProjectDialog />}>
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white/70 px-6 py-16 text-center">
          <h2 className="font-heading text-xl font-semibold">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create a project for a client site, install the embed snippet, and
            send a review link.
          </p>
          <div className="mt-6 flex justify-center">
            <CreateProjectDialog />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
              className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="font-heading text-lg font-semibold">
                {project.name}
              </h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {project.siteUrl}
              </p>
              {project.githubRepo && (
                <p className="mt-3 text-xs text-[#1f8a70]">
                  GitHub · {project.githubRepo}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
