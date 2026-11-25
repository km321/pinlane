import { NextResponse } from "next/server";
import { getProjectInWorkspace, listTickets } from "@/lib/tickets";
import { requireApiWorkspace } from "@/lib/session";
import type { BoardStatus } from "@/db/schema";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const auth = await requireApiWorkspace();
  if ("error" in auth) return auth.error;
  const { workspace } = auth;
  const project = await getProjectInWorkspace(id, workspace.id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const status = new URL(req.url).searchParams.get("status") as BoardStatus | null;
  const cards = await listTickets({
    workspaceId: workspace.id,
    projectId: id,
    status: status || undefined,
  });

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

  return NextResponse.json({
    project,
    cards: cards.map((card) => ({
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
        openUrl: appUrl ? `${appUrl}/go/${card.feedbackItem.id}` : null,
        highlight: card.feedbackItem.highlight,
        createdAt: card.feedbackItem.createdAt,
        replies: card.feedbackItem.replies,
      },
    })),
  });
}
