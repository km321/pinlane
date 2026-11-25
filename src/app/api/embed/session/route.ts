import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  reviewInvites,
  reviewSessions,
  workspaces,
} from "@/db/schema";
import { embedCorsHeaders, optionsResponse } from "@/lib/cors";

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");
  const headers = embedCorsHeaders(origin);
  const url = new URL(req.url);
  const publicKey = url.searchParams.get("publicKey");
  const token = url.searchParams.get("token");

  if (!publicKey || !token) {
    return NextResponse.json(
      { error: "publicKey and token required" },
      { status: 400, headers },
    );
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.publicKey, publicKey),
  });
  if (!project) {
    return NextResponse.json(
      { error: "Unknown project" },
      { status: 404, headers },
    );
  }

  const session = await db.query.reviewSessions.findFirst({
    where: eq(reviewSessions.token, token),
  });
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json(
      { active: false, error: "Invalid or expired session" },
      { status: 401, headers },
    );
  }

  const invite = await db.query.reviewInvites.findFirst({
    where: and(
      eq(reviewInvites.id, session.inviteId),
      isNull(reviewInvites.revokedAt),
    ),
  });
  if (!invite || invite.projectId !== project.id) {
    return NextResponse.json(
      { active: false, error: "Invite not valid for this project" },
      { status: 401, headers },
    );
  }
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return NextResponse.json(
      { active: false, error: "Invite expired" },
      { status: 401, headers },
    );
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, project.workspaceId),
  });

  return NextResponse.json(
    {
      active: true,
      guestName: session.guestName,
      project: {
        id: project.id,
        name: project.name,
        siteUrl: project.siteUrl,
      },
      branding: {
        name: workspace?.name ?? "Pinlane",
        logoUrl: workspace?.logoUrl ?? null,
        primaryColor: workspace?.primaryColor ?? "#E85D4C",
      },
    },
    { headers },
  );
}
