import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  reviewInvites,
  reviewSessions,
  workspaces,
} from "@/db/schema";
import { brandingFromWorkspace } from "@/lib/branding";
import { newId, newToken } from "@/lib/ids";

const schema = z.object({
  guestName: z.string().min(1).max(80).optional(),
});

async function loadInvite(token: string) {
  const invite = await db.query.reviewInvites.findFirst({
    where: and(eq(reviewInvites.token, token), isNull(reviewInvites.revokedAt)),
  });
  if (!invite) return { error: "Invite not found" as const, status: 404 as const };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { error: "Invite expired" as const, status: 410 as const };
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, invite.projectId),
  });
  if (!project) {
    return { error: "Project missing" as const, status: 404 as const };
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, project.workspaceId),
  });

  return { invite, project, workspace };
}

async function createSession(
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const loaded = await loadInvite(token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { invite, project, workspace } = loaded;
  const branding = brandingFromWorkspace(workspace);

  return NextResponse.json({
    invite: {
      label: invite.label,
      assignedName: invite.assignedName,
    },
    project: { name: project.name, siteUrl: project.siteUrl },
    branding,
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const body = schema.parse(await req.json().catch(() => ({})));

  const loaded = await loadInvite(token);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const { invite, project } = loaded;
  const guestName = (invite.assignedName || body.guestName || "").trim();
  if (!guestName) {
    return NextResponse.json(
      { error: "Name is required for this link" },
      { status: 400 },
    );
  }

  const session = await createSession(
    invite.id,
    guestName,
    project.siteUrl,
    project.publicKey,
  );

  return NextResponse.json(session);
}
