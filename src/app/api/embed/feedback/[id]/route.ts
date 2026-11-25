import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  reviewInvites,
  reviewSessions,
} from "@/db/schema";
import { embedCorsHeaders, optionsResponse } from "@/lib/cors";
import { deleteGuestFeedback, updateGuestFeedback } from "@/lib/tickets";

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

async function resolveGuestSession(opts: {
  publicKey: string;
  token: string;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.publicKey, opts.publicKey),
  });
  if (!project) return { error: "Unknown project" as const, status: 404 as const };

  const session = await db.query.reviewSessions.findFirst({
    where: eq(reviewSessions.token, opts.token),
  });
  if (!session || session.expiresAt < new Date()) {
    return { error: "Invalid or expired session" as const, status: 401 as const };
  }

  const invite = await db.query.reviewInvites.findFirst({
    where: and(
      eq(reviewInvites.id, session.inviteId),
      isNull(reviewInvites.revokedAt),
    ),
  });
  if (!invite || invite.projectId !== project.id) {
    return { error: "Invite not valid for this project" as const, status: 401 as const };
  }

  return { project, session };
}

const patchSchema = z.object({
  publicKey: z.string().min(1),
  token: z.string().min(1),
  comment: z.string().min(1).max(5000),
});

const deleteSchema = z.object({
  publicKey: z.string().min(1),
  token: z.string().min(1),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get("origin");
  const headers = embedCorsHeaders(origin);
  const { id } = await ctx.params;

  try {
    const body = patchSchema.parse(await req.json());
    const resolved = await resolveGuestSession(body);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status, headers },
      );
    }

    const updated = await updateGuestFeedback({
      feedbackId: id,
      sessionId: resolved.session.id,
      projectId: resolved.project.id,
      comment: body.comment.trim(),
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Not found or not yours to edit" },
        { status: 404, headers },
      );
    }

    return NextResponse.json(
      {
        pin: {
          id: updated.id,
          authorName: updated.authorName,
          comment: updated.comment,
          pageUrl: updated.pageUrl,
          highlight: updated.highlight,
          screenshotUrl: updated.screenshotUrl,
          createdAt: updated.createdAt,
          mine: true,
        },
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400, headers },
      );
    }
    return NextResponse.json(
      { error: "Failed to update feedback" },
      { status: 500, headers },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const origin = req.headers.get("origin");
  const headers = embedCorsHeaders(origin);
  const { id } = await ctx.params;

  try {
    const body = deleteSchema.parse(await req.json());
    const resolved = await resolveGuestSession(body);
    if ("error" in resolved) {
      return NextResponse.json(
        { error: resolved.error },
        { status: resolved.status, headers },
      );
    }

    const ok = await deleteGuestFeedback({
      feedbackId: id,
      sessionId: resolved.session.id,
      projectId: resolved.project.id,
    });
    if (!ok) {
      return NextResponse.json(
        { error: "Not found or not yours to delete" },
        { status: 404, headers },
      );
    }

    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400, headers },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete feedback" },
      { status: 500, headers },
    );
  }
}
