import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  reviewInvites,
  reviewSessions,
  workspaces,
  type Project,
  type ReviewInvite,
  type Workspace,
} from "@/db/schema";
import { newId, newToken } from "@/lib/ids";

export type LoadedReviewInvite = {
  ok: true;
  invite: ReviewInvite;
  project: Project;
  workspace: Workspace | null | undefined;
};

export type LoadReviewInviteResult =
  | LoadedReviewInvite
  | { ok: false; error: string; status: number };

export async function loadReviewInvite(
  token: string,
): Promise<LoadReviewInviteResult> {
  const invite = await db.query.reviewInvites.findFirst({
    where: and(eq(reviewInvites.token, token), isNull(reviewInvites.revokedAt)),
  });
  if (!invite) return { ok: false, error: "Invite not found", status: 404 };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { ok: false, error: "Invite expired", status: 410 };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, invite.projectId),
  });
  if (!project) return { ok: false, error: "Project missing", status: 404 };

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, project.workspaceId),
  });

  return { ok: true, invite, project, workspace };
}

export async function createReviewSession(
  inviteId: string,
  guestName: string,
  projectSiteUrl: string,
  publicKey: string,
) {
  const sessionToken = newToken(24);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await db.insert(reviewSessions).values({
    id: newId("ses"),
    inviteId,
    token: sessionToken,
    guestName: guestName.trim(),
    expiresAt,
  });

  const site = new URL(projectSiteUrl);
  site.searchParams.set("pinlane", sessionToken);

  return {
    sessionToken,
    redirectUrl: site.toString(),
    publicKey,
  };
}
