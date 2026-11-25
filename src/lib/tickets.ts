import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  BOARD_STATUSES,
  boardCards,
  feedbackItems,
  feedbackReplies,
  projects,
  type BoardStatus,
  type HighlightPayload,
} from "@/db/schema";
import { newId } from "@/lib/ids";

export async function listProjectsForWorkspace(workspaceId: string) {
  return db.query.projects.findMany({
    where: eq(projects.workspaceId, workspaceId),
    orderBy: [desc(projects.createdAt)],
  });
}

export async function getProjectInWorkspace(
  projectId: string,
  workspaceId: string,
) {
  return db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.workspaceId, workspaceId),
    ),
  });
}

export async function listTickets(opts: {
  workspaceId: string;
  projectId?: string;
  status?: BoardStatus;
}) {
  const projectList = await listProjectsForWorkspace(opts.workspaceId);
  const projectIds = opts.projectId
    ? projectList.filter((p) => p.id === opts.projectId).map((p) => p.id)
    : projectList.map((p) => p.id);

  if (projectIds.length === 0) return [];

  const conditions = [inArray(boardCards.projectId, projectIds)];
  if (opts.status) {
    conditions.push(eq(boardCards.status, opts.status));
  }

  return db.query.boardCards.findMany({
    where: and(...conditions),
    with: {
      feedbackItem: {
        with: { replies: true },
      },
      project: true,
    },
    orderBy: [asc(boardCards.position), desc(boardCards.createdAt)],
  });
}

export async function getTicket(cardId: string, workspaceId: string) {
  const card = await db.query.boardCards.findFirst({
    where: eq(boardCards.id, cardId),
    with: {
      feedbackItem: {
        with: { replies: true },
      },
      project: true,
    },
  });
  if (!card || card.project.workspaceId !== workspaceId) return null;
  return card;
}

export async function updateTicket(
  cardId: string,
  workspaceId: string,
  patch: {
    status?: BoardStatus;
    githubIssueUrl?: string | null;
    position?: number;
  },
) {
  const existing = await getTicket(cardId, workspaceId);
  if (!existing) return null;

  if (patch.status && !BOARD_STATUSES.includes(patch.status)) {
    throw new Error("Invalid status");
  }

  const [updated] = await db
    .update(boardCards)
    .set({
      status: patch.status ?? existing.status,
      githubIssueUrl:
        patch.githubIssueUrl === undefined
          ? existing.githubIssueUrl
          : patch.githubIssueUrl,
      position: patch.position ?? existing.position,
      updatedAt: new Date(),
    })
    .where(eq(boardCards.id, cardId))
    .returning();

  return getTicket(updated.id, workspaceId);
}

export async function addReply(opts: {
  feedbackItemId: string;
  workspaceId: string;
  authorType: string;
  authorName: string;
  authorUserId?: string;
  body: string;
}) {
  const item = await db.query.feedbackItems.findFirst({
    where: eq(feedbackItems.id, opts.feedbackItemId),
    with: { project: true },
  });
  if (!item || item.project.workspaceId !== opts.workspaceId) {
    return null;
  }

  const [reply] = await db
    .insert(feedbackReplies)
    .values({
      id: newId("rpl"),
      feedbackItemId: opts.feedbackItemId,
      authorType: opts.authorType,
      authorName: opts.authorName,
      authorUserId: opts.authorUserId,
      body: opts.body,
    })
    .returning();

  return reply;
}

export async function createFeedbackWithCard(opts: {
  projectId: string;
  sessionId?: string;
  authorType: "guest" | "member";
  authorName: string;
  pageUrl: string;
  pageTitle?: string;
  comment: string;
  highlight: HighlightPayload;
  screenshotUrl?: string;
}) {
  const feedbackId = newId("fb");
  const cardId = newId("card");

  const existingCards = await db.query.boardCards.findMany({
    where: and(
      eq(boardCards.projectId, opts.projectId),
      eq(boardCards.status, "open"),
    ),
  });
  const maxPos = existingCards.reduce((max, c) => Math.max(max, c.position), 0);

  const [feedback] = await db
    .insert(feedbackItems)
    .values({
      id: feedbackId,
      projectId: opts.projectId,
      sessionId: opts.sessionId,
      authorType: opts.authorType,
      authorName: opts.authorName,
      pageUrl: opts.pageUrl,
      pageTitle: opts.pageTitle,
      comment: opts.comment,
      highlight: opts.highlight,
      screenshotUrl: opts.screenshotUrl,
    })
    .returning();

  const [card] = await db
    .insert(boardCards)
    .values({
      id: cardId,
      projectId: opts.projectId,
      feedbackItemId: feedbackId,
      status: "open",
      position: maxPos + 1,
    })
    .returning();

  return { feedback, card };
}

export function formatTicketForAgent(
  card: NonNullable<Awaited<ReturnType<typeof getTicket>>>,
) {
  const fb = card.feedbackItem;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const openUrl = appUrl ? `${appUrl}/go/${fb.id}` : null;
  let deepLink = fb.pageUrl;
  try {
    const url = new URL(fb.pageUrl);
    url.hash = `pinlane-pin=${fb.id}`;
    deepLink = url.toString();
  } catch {
    /* keep pageUrl */
  }

  return {
    id: card.id,
    status: card.status,
    githubIssueUrl: card.githubIssueUrl,
    position: card.position,
    openUrl,
    deepLink,
    project: {
      id: card.project.id,
      name: card.project.name,
      siteUrl: card.project.siteUrl,
      githubRepo: card.project.githubRepo,
      githubProjectUrl: card.project.githubProjectUrl,
    },
    feedback: {
      id: fb.id,
      authorName: fb.authorName,
      comment: fb.comment,
      pageUrl: fb.pageUrl,
      pageTitle: fb.pageTitle,
      highlight: fb.highlight,
      screenshotUrl: fb.screenshotUrl,
      createdAt: fb.createdAt,
      replies: fb.replies.map((r) => ({
        id: r.id,
        authorName: r.authorName,
        authorType: r.authorType,
        body: r.body,
        createdAt: r.createdAt,
      })),
    },
  };
}
