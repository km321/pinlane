import { NextResponse } from "next/server";
import { z } from "zod";
import { brandingFromWorkspace } from "@/lib/branding";
import {
  createReviewSession,
  loadReviewInvite,
} from "@/lib/review-claim";

const schema = z.object({
  guestName: z.string().min(1).max(80).optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const loaded = await loadReviewInvite(token);
  if (!loaded.ok) {
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

  const loaded = await loadReviewInvite(token);
  if (!loaded.ok) {
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

  const session = await createReviewSession(
    invite.id,
    guestName,
    project.siteUrl,
    project.publicKey,
  );

  return NextResponse.json(session);
}
