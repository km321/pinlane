import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  feedbackItems,
  projects,
  reviewInvites,
  reviewSessions,
} from "@/db/schema";
import { newId, newToken } from "@/lib/ids";
import { requireWorkspace } from "@/lib/workspace";

/**
 * Team shortcut: open a pin on the live site with a short-lived review session
 * so highlights render in the embed.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ feedbackId: string }> },
) {
  const { feedbackId } = await ctx.params;
  const { workspace, user } = await requireWorkspace();

  const feedback = await db.query.feedbackItems.findFirst({
    where: eq(feedbackItems.id, feedbackId),
  });
  if (!feedback) {
    return NextResponse.redirect(new URL("/app", absoluteAppUrl()));
  }

  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, feedback.projectId),
      eq(projects.workspaceId, workspace.id),
    ),
  });
  if (!project) {
    return NextResponse.redirect(new URL("/app", absoluteAppUrl()));
  }

  let invite = await db.query.reviewInvites.findFirst({
    where: and(
      eq(reviewInvites.projectId, project.id),
      isNull(reviewInvites.revokedAt),
      eq(reviewInvites.label, "Team viewer"),
    ),
  });

  if (!invite) {
    const [created] = await db
      .insert(reviewInvites)
      .values({
        id: newId("inv"),
        projectId: project.id,
        token: newToken(18),
        label: "Team viewer",
        assignedName: "Team",
      })
      .returning();
    invite = created;
  }

  const sessionToken = newToken(24);
  await db.insert(reviewSessions).values({
    id: newId("ses"),
    inviteId: invite.id,
    token: sessionToken,
    guestName: user.name || "Team",
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });

  const target = new URL(feedback.pageUrl);
  target.searchParams.set("pinlane", sessionToken);
  target.hash = `pinlane-pin=${feedback.id}`;

  return NextResponse.redirect(target.toString());
}

function absoluteAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3456"
  );
}
