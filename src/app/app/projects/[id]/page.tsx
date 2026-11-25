import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { KanbanBoard } from "@/components/kanban-board";
import { ProjectSetup } from "@/components/project-setup";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { reviewInvites } from "@/db/schema";
import { getProjectInWorkspace, listTickets } from "@/lib/tickets";
import { requireWorkspace } from "@/lib/workspace";
import { desc, eq } from "drizzle-orm";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const project = await getProjectInWorkspace(id, workspace.id);
  if (!project) notFound();

  const [cards, invites] = await Promise.all([
    listTickets({ workspaceId: workspace.id, projectId: id }),
    db.query.reviewInvites.findMany({
      where: eq(reviewInvites.projectId, id),
      orderBy: [desc(reviewInvites.createdAt)],
    }),
  ]);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3456";

  const boardCards = cards.map((card) => ({
    id: card.id,
    status: card.status,
    position: card.position,
    githubIssueUrl: card.githubIssueUrl,
    feedback: {
      id: card.feedbackItem.id,
      authorName: card.feedbackItem.authorName,
      comment: card.feedbackItem.comment,
      pageUrl: card.feedbackItem.pageUrl,
      pageTitle: card.feedbackItem.pageTitle,
      screenshotUrl: card.feedbackItem.screenshotUrl,
      openUrl: `${appUrl}/go/${card.feedbackItem.id}`,
      highlight: card.feedbackItem.highlight,
      createdAt: card.feedbackItem.createdAt,
      replies: card.feedbackItem.replies,
    },
  }));

  return (
    <AppShell
      title={project.name}
      actions={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/app" />}
        >
          All projects
        </Button>
      }
    >
      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="mt-4">
          {boardCards.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 px-6 py-14 text-center">
              <h2 className="font-heading text-lg font-semibold">
                Waiting for feedback
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Install the embed, create a review invite under Setup, and ask
                your client to leave pins on the live site.
              </p>
            </div>
          ) : (
            <KanbanBoard projectId={project.id} initialCards={boardCards} />
          )}
        </TabsContent>
        <TabsContent value="setup" className="mt-4">
          <ProjectSetup
            projectId={project.id}
            publicKey={project.publicKey}
            siteUrl={project.siteUrl}
            githubRepo={project.githubRepo}
            githubProjectUrl={project.githubProjectUrl}
            initialInvites={invites}
            appUrl={appUrl}
          />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
