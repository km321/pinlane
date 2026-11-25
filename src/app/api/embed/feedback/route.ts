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
import { createFeedbackWithCard } from "@/lib/tickets";
import { buildPinDeepLink, pinOpenPath } from "@/lib/branding";

export function OPTIONS(req: Request) {
  return optionsResponse(req);
}

const schema = z.object({
  publicKey: z.string().min(1),
  token: z.string().min(1),
  pageUrl: z.string().url(),
  pageTitle: z.string().optional(),
  comment: z.string().min(1).max(5000),
  highlight: z.object({
    type: z.enum(["pin", "rect"]),
    x: z.number(),
    y: z.number(),
    w: z.number().optional(),
    h: z.number().optional(),
    selector: z.string().optional(),
    ox: z.number().optional(),
    oy: z.number().optional(),
  }),
  screenshotUrl: z
    .string()
    .max(1_500_000)
    .optional()
    .refine(
      (v) => !v || v.startsWith("data:image/") || /^https?:\/\//i.test(v),
      { message: "screenshot must be a data URL or http(s) URL" },
    ),
});

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const headers = embedCorsHeaders(origin);

  try {
    const body = schema.parse(await req.json());

    const project = await db.query.projects.findFirst({
      where: eq(projects.publicKey, body.publicKey),
    });
    if (!project) {
      return NextResponse.json(
        { error: "Unknown project" },
        { status: 404, headers },
      );
    }

    const session = await db.query.reviewSessions.findFirst({
      where: eq(reviewSessions.token, body.token),
    });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
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
        { error: "Invite not valid for this project" },
        { status: 401, headers },
      );
    }

    const result = await createFeedbackWithCard({
      projectId: project.id,
      sessionId: session.id,
      authorType: "guest",
      authorName: session.guestName,
      pageUrl: body.pageUrl,
      pageTitle: body.pageTitle,
      comment: body.comment,
      highlight: body.highlight,
      screenshotUrl: body.screenshotUrl,
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";

    return NextResponse.json(
      {
        feedbackId: result.feedback.id,
        cardId: result.card.id,
        openUrl: appUrl ? `${appUrl}${pinOpenPath(result.feedback.id)}` : null,
        deepLink: buildPinDeepLink(body.pageUrl, result.feedback.id),
        pin: {
          id: result.feedback.id,
          authorName: result.feedback.authorName,
          comment: result.feedback.comment,
          pageUrl: result.feedback.pageUrl,
          highlight: result.feedback.highlight,
          screenshotUrl: result.feedback.screenshotUrl,
          createdAt: result.feedback.createdAt,
          mine: true,
        },
      },
      { status: 201, headers },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", details: error.flatten() },
        { status: 400, headers },
      );
    }
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500, headers },
    );
  }
}
