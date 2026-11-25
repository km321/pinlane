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
import { newId, newToken } from "@/lib/ids";

const schema = z.object({
  guestName: z.string().min(1).max(80),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const invite = await db.query.reviewInvites.findFirst({
    where: and(eq(reviewInvites.token, token), isNull(reviewInvites.revokedAt)),
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, invite.projectId),
  });
  if (!project) {
    return NextResponse.json({ error: "Project missing" }, { status: 404 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, project.workspaceId),
  });

  return NextResponse.json({
    invite: { label: invite.label },
    project: { name: project.name, siteUrl: project.siteUrl },
    branding: {
      name: workspace?.name ?? "Pinlane",
      logoUrl: workspace?.logoUrl ?? null,
      primaryColor: workspace?.primaryColor ?? "#E85D4C",
    },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const body = schema.parse(await req.json());

  const invite = await db.query.reviewInvites.findFirst({
    where: and(eq(reviewInvites.token, token), isNull(reviewInvites.revokedAt)),
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invite expired" }, { status: 410 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, invite.projectId),
  });
  if (!project) {
    return NextResponse.json({ error: "Project missing" }, { status: 404 });
  }

  const sessionToken = newToken(24);
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await db.insert(reviewSessions).values({
    id: newId("ses"),
    inviteId: invite.id,
    token: sessionToken,
    guestName: body.guestName.trim(),
    expiresAt,
  });

  const site = new URL(project.siteUrl);
  site.searchParams.set("pinlane", sessionToken);

  return NextResponse.json({
    sessionToken,
    redirectUrl: site.toString(),
    publicKey: project.publicKey,
  });
}
