import { NextResponse } from "next/server";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  feedbackItems,
  feedbackReplies,
  projects,
  reviewInvites,
  reviewSessions,
  workspaces,
  type BoardStatus,
} from "@/db/schema";
import { brandingFromWorkspace } from "@/lib/branding";
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
  const pageUrl = url.searchParams.get("pageUrl");

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

  const allPins = await db.query.feedbackItems.findMany({
    where: eq(feedbackItems.projectId, project.id),
    orderBy: [desc(feedbackItems.createdAt)],
    limit: 200,
    with: {
      boardCard: true,
      replies: {
        orderBy: [asc(feedbackReplies.createdAt)],
      },
    },
  });

  const mapped = allPins.map((pin) => ({
    id: pin.id,
    authorName: pin.authorName,
    comment: pin.comment,
    pageUrl: pin.pageUrl,
    pageTitle: pin.pageTitle,
    highlight: pin.highlight,
    screenshotUrl: pin.screenshotUrl,
    createdAt: pin.createdAt,
    mine: pin.sessionId === session.id,
    onThisPage: pageUrl ? samePage(pin.pageUrl, pageUrl) : true,
    status: (pin.boardCard?.status as BoardStatus) || "open",
    replies: pin.replies.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorType: r.authorType,
      body: r.body,
      createdAt: r.createdAt,
    })),
  }));

  return NextResponse.json(
    {
      active: true,
      guestName: session.guestName,
      project: {
        id: project.id,
        name: project.name,
        siteUrl: project.siteUrl,
      },
      branding: brandingFromWorkspace(workspace),
      // All project notes for the sidebar; markers use onThisPage.
      pins: mapped,
    },
    { headers },
  );
}

function samePage(a: string, b: string) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.origin === ub.origin &&
      ua.pathname.replace(/\/$/, "") === ub.pathname.replace(/\/$/, "")
    );
  } catch {
    return a.split("#")[0].split("?")[0] === b.split("#")[0].split("?")[0];
  }
}
